import { Module } from '@nestjs/common';
import { MoviesController } from './movies.controller';
import { MoviesService } from './movies.service';
import { OmdbService } from './omdb';
import {
  CatalogAProvider,
  CatalogBProvider,
  MOVIE_PROVIDERS,
} from './providers';

@Module({
  controllers: [MoviesController],
  providers: [
    MoviesService,
    OmdbService,
    CatalogAProvider,
    CatalogBProvider,
    // Inject all providers as an array
    {
      provide: MOVIE_PROVIDERS,
      useFactory: (catalogA: CatalogAProvider, catalogB: CatalogBProvider) => [
        catalogA,
        catalogB,
      ],
      inject: [CatalogAProvider, CatalogBProvider],
    },
  ],
  exports: [MoviesService],
})
export class MoviesModule {}
