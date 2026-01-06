import { Controller, Get, Post, Delete, Param, Query, Body, UseGuards, Request } from '@nestjs/common';
import { MoviesService } from './movies.service';
import { SearchMoviesDto, PopularMoviesDto, MarkWatchedDto } from './dto';
import { PaginatedMovies, MovieDetails } from './types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('movies')
export class MoviesController {
  constructor(private readonly moviesService: MoviesService) { }

  /**
   * GET /movies/popular
   * Get popular movies with pagination
   */
  @Get('popular')
  @UseGuards(JwtAuthGuard)
  async getPopular(
    @Query() dto: PopularMoviesDto,
    @Request() req: { user: { sub: string } },
  ): Promise<PaginatedMovies> {
    return this.moviesService.popular(
      dto.page ?? 1,
      dto.pageSize ?? 20,
      req.user.sub,
    );
  }

  /**
   * GET /movies/search
   * Search movies by query
   */
  @Get('search')
  @UseGuards(JwtAuthGuard)
  async search(
    @Query() dto: SearchMoviesDto,
    @Request() req: { user: { sub: string } },
  ): Promise<PaginatedMovies> {
    return this.moviesService.search(
      dto.q,
      dto.page ?? 1,
      dto.pageSize ?? 20,
      req.user.sub,
    );
  }

  /**
   * GET /movies/:id
   * Get movie details by ID
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getById(
    @Param('id') id: string,
    @Request() req: { user: { sub: string } },
  ): Promise<MovieDetails> {
    return this.moviesService.getById(id, req.user.sub);
  }

  /**
   * POST /movies/:id/watched
   * Mark a movie as watched
   */
  @Post(':id/watched')
  @UseGuards(JwtAuthGuard)
  async markWatched(
    @Param('id') movieId: string,
    @Body() dto: MarkWatchedDto,
    @Request() req: { user: { sub: string } },
  ): Promise<{ success: boolean }> {
    await this.moviesService.markWatched(req.user.sub, movieId, dto.progress);
    return { success: true };
  }

  /**
   * DELETE /movies/:id/watched
   * Mark a movie as unwatched
   */
  @Delete(':id/watched')
  @UseGuards(JwtAuthGuard)
  async markUnwatched(
    @Param('id') movieId: string,
    @Request() req: { user: { sub: string } },
  ): Promise<{ success: boolean }> {
    await this.moviesService.markUnwatched(req.user.sub, movieId);
    return { success: true };
  }
}
