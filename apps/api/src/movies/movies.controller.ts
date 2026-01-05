import { Controller, Get, Param, Query } from '@nestjs/common';
import { MoviesService } from './movies.service';
import { SearchMoviesDto, PopularMoviesDto } from './dto';
import { PaginatedMovies, MovieDetails } from './types';

@Controller('movies')
export class MoviesController {
  constructor(private readonly moviesService: MoviesService) {}

  /**
   * GET /movies/popular
   * Get popular movies with pagination
   */
  @Get('popular')
  async getPopular(@Query() dto: PopularMoviesDto): Promise<PaginatedMovies> {
    return this.moviesService.popular(dto.page ?? 1, dto.pageSize ?? 20);
  }

  /**
   * GET /movies/search
   * Search movies by query
   */
  @Get('search')
  async search(@Query() dto: SearchMoviesDto): Promise<PaginatedMovies> {
    return this.moviesService.search(dto.q, dto.page ?? 1, dto.pageSize ?? 20);
  }

  /**
   * GET /movies/:id
   * Get movie details by ID
   */
  @Get(':id')
  async getById(@Param('id') id: string): Promise<MovieDetails> {
    return this.moviesService.getById(id);
  }
}
