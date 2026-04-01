import { Prisma } from '../../../generated/prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export type MovieWithTorrents = Prisma.MovieGetPayload<{
  include: { torrents: true };
}>;

export type MovieWithTorrentsAndViews = Prisma.MovieGetPayload<{
  include: {
    torrents: true;
    movieViews: {
      select: {
        id: true;
      };
    };
  };
}>;

type MovieListItem = MovieWithTorrents | MovieWithTorrentsAndViews;

export class TorrentResponseDto {
  @ApiProperty()
  hash: string;
  @ApiProperty()
  magnet: string;
  @ApiProperty()
  quality: string;
  @ApiProperty()
  size: string;
  @ApiProperty()
  seeds: number;
  @ApiProperty()
  peers: number;

  constructor(torrent: MovieWithTorrents['torrents'][number]) {
    this.hash = torrent.hash;
    this.magnet = torrent.magnet;
    this.quality = torrent.quality;
    this.size = torrent.size;
    this.seeds = torrent.seeds;
    this.peers = torrent.peers;
  }
}

export class MovieResponseDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  imdbId: string;
  @ApiProperty()
  title: string;
  @ApiProperty()
  year: number;
  @ApiProperty()
  rating: number;
  @ApiProperty()
  runtime: number;
  @ApiProperty({ type: [String] })
  genres: string[];
  @ApiProperty()
  summary: string;
  @ApiProperty()
  coverImageUrl: string;
  @ApiProperty({ nullable: true })
  director: string | null;
  @ApiProperty({ type: [String] })
  cast: string[];
  @ApiProperty({ nullable: true })
  lastViewedAt: Date | null;
  @ApiProperty()
  createdAt: Date;
  @ApiProperty()
  updatedAt: Date;
  @ApiProperty({ type: [TorrentResponseDto] })
  torrents: TorrentResponseDto[];
  @ApiProperty({
    description: 'Whether the current user has watched this movie',
    example: true,
    default: false,
  })
  isWatched: boolean;

  constructor(movie: MovieListItem) {
    this.id = movie.id;
    this.imdbId = movie.imdbId;
    this.title = movie.title;
    this.year = movie.year;
    this.rating = movie.rating;
    this.runtime = movie.runtime;
    this.genres = movie.genres ?? [];
    this.summary = movie.summary;
    this.coverImageUrl = movie.coverImageUrl;
    this.director = movie.director;
    this.cast = movie.cast ?? [];
    this.lastViewedAt = movie.lastViewedAt;
    this.createdAt = movie.createdAt;
    this.updatedAt = movie.updatedAt;
    this.torrents = (movie.torrents ?? []).map((torrent) => new TorrentResponseDto(torrent));
    this.isWatched = 'movieViews' in movie ? (movie.movieViews?.length ?? 0) > 0 : Boolean(movie.lastViewedAt);
  }
}

export class MoviesListResponseDto {
  @ApiProperty({ type: [MovieResponseDto] })
  data: MovieResponseDto[];
  @ApiProperty({
    type: 'object',
    properties: {
      total: { type: 'number' },
      page: { type: 'number' },
      limit: { type: 'number' },
      totalPages: { type: 'number' },
    },
  })
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };

  constructor(params: {
    data: MovieListItem[];
    total: number;
    page: number;
    limit: number;
  }) {
    this.data = params.data.map((movie) => new MovieResponseDto(movie));
    this.meta = {
      total: params.total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(params.total / params.limit),
    };
  }
}
