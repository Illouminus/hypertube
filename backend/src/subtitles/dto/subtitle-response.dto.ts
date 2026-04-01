import { ApiProperty } from '@nestjs/swagger';
import { Prisma } from '../../../generated/prisma/client';

export type SubtitleModel = Prisma.MovieSubtitleGetPayload<{}>;

export class SubtitleResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  movieId: string;

  @ApiProperty({ example: 'en' })
  languageCode: string;

  @ApiProperty({ example: 'vtt' })
  format: string;

  @ApiProperty({ example: 'READY' })
  status: string;

  @ApiProperty({ nullable: true, example: '/movies/<movieId>/subtitles/<subtitleId>/file' })
  src: string | null;

  @ApiProperty({ example: false })
  isDefault: boolean;

  constructor(subtitle: SubtitleModel, isDefault = false) {
    this.id = subtitle.id;
    this.movieId = subtitle.movieId;
    this.languageCode = subtitle.languageCode;
    this.format = subtitle.format;
    this.status = subtitle.status;
    this.src = subtitle.status === 'READY' ? `/movies/${subtitle.movieId}/subtitles/${subtitle.id}/file` : null;
    this.isDefault = isDefault;
  }
}
