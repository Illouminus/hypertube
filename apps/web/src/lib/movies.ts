import { api } from './api';

// Types matching API responses
export interface MovieListItem {
  id: string;
  title: string;
  year?: number;
  posterUrl?: string;
  imdbRating?: string;
  genre?: string;
  providers: string[];
}

export interface MovieSource {
  provider: string;
  externalId: string;
  magnet?: string;
  seeders?: number;
  leechers?: number;
  size?: string;
  language?: string;
}

export interface MovieDetails extends MovieListItem {
  plot?: string;
  runtime?: string;
  director?: string;
  actors?: string;
  sources: MovieSource[];
}

export interface PaginatedMovies {
  items: MovieListItem[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  totalApprox?: number;
}

/**
 * Search movies by query
 */
export async function searchMovies(
  q: string,
  page = 1,
  pageSize = 20,
): Promise<PaginatedMovies> {
  const params = new URLSearchParams({
    q,
    page: page.toString(),
    pageSize: pageSize.toString(),
  });
  return api.get<PaginatedMovies>(`/movies/search?${params.toString()}`);
}

/**
 * Get popular movies
 */
export async function getPopularMovies(
  page = 1,
  pageSize = 20,
): Promise<PaginatedMovies> {
  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
  });
  return api.get<PaginatedMovies>(`/movies/popular?${params.toString()}`);
}

/**
 * Get movie details by ID
 */
export async function getMovieById(id: string): Promise<MovieDetails> {
  return api.get<MovieDetails>(`/movies/${id}`);
}
