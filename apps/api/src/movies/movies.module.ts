import { Module } from '@nestjs/common';
import { MoviesController } from './movies.controller';
import { MoviesService } from './movies.service';
import { OmdbService } from './omdb';
import { TmdbService } from './tmdb';
import { MetadataService } from './metadata';
import {
  YtsProvider,
  InternetArchiveProvider,
  MOVIE_PROVIDERS,
} from './providers';

@Module({
  controllers: [MoviesController],
  providers: [
    MoviesService,
    OmdbService,
    TmdbService,
    MetadataService,
    YtsProvider,
    InternetArchiveProvider,
    // Inject all providers as an array
    {
      provide: MOVIE_PROVIDERS,
      useFactory: (
        yts: YtsProvider,
        archive: InternetArchiveProvider,
      ) => [yts, archive],
      inject: [YtsProvider, InternetArchiveProvider],
    },
  ],
  exports: [MoviesService],
})
export class MoviesModule { }
