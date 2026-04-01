import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { SubtitleStatus } from '../../generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { firstValueFrom } from 'rxjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { SubtitleResponseDto } from './dto/subtitle-response.dto';

@Injectable()
export class SubtitlesService {
  private readonly logger = new Logger(SubtitlesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async ensureSubtitlesForMovie(movieId: string, preferredLanguage?: string, forceRefresh = false): Promise<void> {
    const movie = await this.prisma.movie.findUnique({
      where: { id: movieId },
      include: { subtitles: true },
    });

    if (!movie || !movie.imdbId) {
      return;
    }

    const targetLanguages = this.getTargetLanguages(preferredLanguage);

    for (const languageCode of targetLanguages) {
      const existing = movie.subtitles.find((subtitle) => subtitle.languageCode === languageCode);
      if (!forceRefresh && existing && (existing.status === SubtitleStatus.READY || existing.status === SubtitleStatus.PENDING)) {
        continue;
      }

      const subtitle = existing
        ? await this.prisma.movieSubtitle.update({
            where: { id: existing.id },
            data: { status: SubtitleStatus.PENDING, errorMessage: null },
          })
        : await this.prisma.movieSubtitle.create({
            data: {
              movieId,
              languageCode,
              status: SubtitleStatus.PENDING,
            },
          });

      void this.fetchAndStoreSubtitle(movie.id, movie.imdbId, languageCode, subtitle.id);
    }
  }

  async listSubtitles(movieId: string, preferredLanguage?: string) {
    const subtitles = await this.prisma.movieSubtitle.findMany({
      where: { movieId },
      orderBy: [{ status: 'asc' }, { languageCode: 'asc' }],
    });

    const normalizedPreferred = (preferredLanguage ?? '').trim().toLowerCase();
    const readySubtitles = subtitles.filter((subtitle) => subtitle.status === SubtitleStatus.READY);

    const defaultSubtitle =
      readySubtitles.find((subtitle) => subtitle.languageCode === normalizedPreferred) ??
      readySubtitles.find((subtitle) => subtitle.languageCode === 'en') ??
      readySubtitles[0];

    return subtitles.map(
      (subtitle) => new SubtitleResponseDto(subtitle, defaultSubtitle ? subtitle.id === defaultSubtitle.id : false),
    );
  }

  async getSubtitleFilePath(movieId: string, subtitleId: string): Promise<string> {
    const subtitle = await this.prisma.movieSubtitle.findFirst({
      where: {
        id: subtitleId,
        movieId,
        status: SubtitleStatus.READY,
      },
    });

    if (!subtitle?.filePath) {
      throw new NotFoundException('Subtitle file is not ready or does not exist');
    }

    return subtitle.filePath;
  }

  private getTargetLanguages(preferredLanguage?: string): string[] {
    const normalizedPreferred = (preferredLanguage ?? '').trim().toLowerCase();
    const values = ['en'];

    if (normalizedPreferred && normalizedPreferred !== 'en') {
      values.push(normalizedPreferred);
    }

    return values;
  }

  private async fetchAndStoreSubtitle(
    movieId: string,
    imdbId: string,
    languageCode: string,
    subtitleId: string,
  ): Promise<void> {
    try {
      const apiKey = this.configService.get<string>('OPENSUBTITLES_API_KEY');
      if (!apiKey) {
        await this.markAsFailed(subtitleId, 'OPENSUBTITLES_API_KEY is missing');
        return;
      }

      const normalizedImdb = imdbId.replace(/^tt/i, '');
      const searchResponse = await firstValueFrom(
        this.httpService.get('https://api.opensubtitles.com/api/v1/subtitles', {
          headers: {
            'Api-Key': apiKey,
            'User-Agent': 'hypertube v1',
          },
          params: {
            imdb_id: normalizedImdb,
            languages: languageCode,
          },
        }),
      );

      const firstSubtitle = searchResponse.data?.data?.[0];
      const fileMeta = firstSubtitle?.attributes?.files?.[0];
      const fileId = fileMeta?.file_id;

      if (!fileId) {
        await this.markAsFailed(subtitleId, `No subtitle found for language ${languageCode}`);
        return;
      }

      const downloadResponse = await firstValueFrom(
        this.httpService.post(
          'https://api.opensubtitles.com/api/v1/download',
          { file_id: fileId },
          {
            headers: {
              'Api-Key': apiKey,
              'User-Agent': 'hypertube v1',
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const downloadLink = downloadResponse.data?.link;
      if (!downloadLink) {
        await this.markAsFailed(subtitleId, `No download link returned for language ${languageCode}`);
        return;
      }

      const rawSubtitleResponse = await firstValueFrom(
        this.httpService.get(downloadLink, {
          responseType: 'text',
        }),
      );

      const rawContent = String(rawSubtitleResponse.data ?? '');
      if (!rawContent.trim()) {
        await this.markAsFailed(subtitleId, `Downloaded subtitle is empty for language ${languageCode}`);
        return;
      }

      const vttContent = this.convertToVtt(rawContent);
      const subtitlesDir = resolve(process.cwd(), '../downloads/subtitles');
      await mkdir(subtitlesDir, { recursive: true });

      const fileName = `${movieId}.${languageCode}.vtt`;
      const absolutePath = join(subtitlesDir, fileName);
      await writeFile(absolutePath, vttContent, 'utf8');

      await this.prisma.movieSubtitle.update({
        where: { id: subtitleId },
        data: {
          status: SubtitleStatus.READY,
          format: 'vtt',
          provider: 'opensubtitles',
          providerSubtitleId: String(fileId),
          filePath: absolutePath,
          errorMessage: null,
        },
      });
    } catch (error) {
      await this.markAsFailed(subtitleId, this.extractErrorMessage(error));
    }
  }

  private convertToVtt(content: string): string {
    const hasVttHeader = content.trimStart().startsWith('WEBVTT');
    if (hasVttHeader) {
      return content;
    }

    const convertedTiming = content.replace(
      /(\d{2}:\d{2}:\d{2}),(\d{3})\s-->\s(\d{2}:\d{2}:\d{2}),(\d{3})/g,
      '$1.$2 --> $3.$4',
    );

    return `WEBVTT\n\n${convertedTiming}`;
  }

  private async markAsFailed(subtitleId: string, message: string): Promise<void> {
    await this.prisma.movieSubtitle.update({
      where: { id: subtitleId },
      data: {
        status: SubtitleStatus.FAILED,
        errorMessage: message,
      },
    });
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
  }
}
