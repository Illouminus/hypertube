import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { OmdbMetadata } from '../types';

interface OmdbApiResponse {
  Response: 'True' | 'False';
  Error?: string;
  Title?: string;
  Year?: string;
  Poster?: string;
  imdbRating?: string;
  Plot?: string;
  Genre?: string;
  Runtime?: string;
  Director?: string;
  Actors?: string;
  imdbID?: string;
}

@Injectable()
export class OmdbService {
  private readonly logger = new Logger(OmdbService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://www.omdbapi.com/';
  private readonly cacheTtlDays = 7;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.apiKey = this.configService.get<string>('OMDB_API_KEY', '');
    if (!this.apiKey) {
      this.logger.warn('OMDB_API_KEY not configured - metadata enrichment disabled');
    }
  }

  /**
   * Get metadata for a movie, either by IMDb ID or title+year
   */
  async getMetadata(
    titleOrImdbId: string,
    year?: number,
  ): Promise<OmdbMetadata | null> {
    if (!this.apiKey) {
      return null;
    }

    const cacheKey = this.buildCacheKey(titleOrImdbId, year);

    // Check cache first
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from OMDb API
    const metadata = await this.fetchFromApi(titleOrImdbId, year);
    if (metadata) {
      await this.saveToCache(cacheKey, metadata);
    }

    return metadata;
  }

  /**
   * Batch fetch metadata for multiple movies in parallel
   */
  async getMetadataBatch(
    items: Array<{ titleOrImdbId: string; year?: number }>,
  ): Promise<Map<string, OmdbMetadata | null>> {
    const results = new Map<string, OmdbMetadata | null>();

    // Process in parallel with a concurrency limit
    const batchSize = 5;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const promises = batch.map(async (item) => {
        const key = this.buildCacheKey(item.titleOrImdbId, item.year);
        const metadata = await this.getMetadata(item.titleOrImdbId, item.year);
        results.set(key, metadata);
      });
      await Promise.all(promises);
    }

    return results;
  }

  private buildCacheKey(titleOrImdbId: string, year?: number): string {
    // If it looks like an IMDb ID, use it directly
    if (titleOrImdbId.startsWith('tt')) {
      return `imdb:${titleOrImdbId}`;
    }
    // Otherwise, normalize title + year
    const normalizedTitle = titleOrImdbId.toLowerCase().replace(/[^a-z0-9]/g, '');
    return year ? `title:${normalizedTitle}:${year}` : `title:${normalizedTitle}`;
  }

  private async getFromCache(cacheKey: string): Promise<OmdbMetadata | null> {
    try {
      const cached = await this.prisma.movieMetadataCache.findUnique({
        where: { cacheKey },
      });

      if (cached && cached.expiresAt > new Date()) {
        this.logger.debug(`Cache hit for ${cacheKey}`);
        return cached.data as OmdbMetadata;
      }

      // Delete expired entry if exists
      if (cached) {
        await this.prisma.movieMetadataCache.delete({ where: { cacheKey } });
      }

      return null;
    } catch (error) {
      this.logger.error(`Cache read error for ${cacheKey}`, error);
      return null;
    }
  }

  private async saveToCache(cacheKey: string, metadata: OmdbMetadata): Promise<void> {
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + this.cacheTtlDays);

      await this.prisma.movieMetadataCache.upsert({
        where: { cacheKey },
        update: {
          data: metadata as object,
          fetchedAt: new Date(),
          expiresAt,
        },
        create: {
          cacheKey,
          data: metadata as object,
          expiresAt,
        },
      });

      this.logger.debug(`Cached metadata for ${cacheKey}`);
    } catch (error) {
      this.logger.error(`Cache write error for ${cacheKey}`, error);
    }
  }

  private async fetchFromApi(
    titleOrImdbId: string,
    year?: number,
  ): Promise<OmdbMetadata | null> {
    try {
      const params = new URLSearchParams({
        apikey: this.apiKey,
        plot: 'short',
      });

      // Determine if it's an IMDb ID or title search
      if (titleOrImdbId.startsWith('tt')) {
        params.set('i', titleOrImdbId);
      } else {
        params.set('t', titleOrImdbId);
        if (year) {
          params.set('y', year.toString());
        }
      }

      const response = await fetch(`${this.baseUrl}?${params.toString()}`);

      if (!response.ok) {
        this.logger.warn(`OMDb API returned ${response.status}`);
        return null;
      }

      const data: OmdbApiResponse = await response.json();

      if (data.Response === 'False') {
        this.logger.debug(`OMDb: ${data.Error} for ${titleOrImdbId}`);
        return null;
      }

      return this.mapToMetadata(data);
    } catch (error) {
      this.logger.error(`OMDb API error for ${titleOrImdbId}`, error);
      return null;
    }
  }

  private mapToMetadata(data: OmdbApiResponse): OmdbMetadata {
    return {
      posterUrl: data.Poster !== 'N/A' ? data.Poster : undefined,
      imdbRating: data.imdbRating !== 'N/A' ? data.imdbRating : undefined,
      plot: data.Plot !== 'N/A' ? data.Plot : undefined,
      genre: data.Genre !== 'N/A' ? data.Genre : undefined,
      runtime: data.Runtime !== 'N/A' ? data.Runtime : undefined,
      director: data.Director !== 'N/A' ? data.Director : undefined,
      actors: data.Actors !== 'N/A' ? data.Actors : undefined,
      imdbId: data.imdbID,
    };
  }
}
