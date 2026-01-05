/**
 * Movie types for the catalog/library feature
 */

// Provider-level hit (raw result from a content provider)
export interface ProviderMovieHit {
  provider: string;
  externalId: string;
  title: string;
  year?: number;
  imdbId?: string;
  magnet?: string;
  seeders?: number;
  leechers?: number;
  size?: string;
  language?: string;
}

// OMDb enrichment data
export interface OmdbMetadata {
  posterUrl?: string;
  imdbRating?: string;
  plot?: string;
  genre?: string;
  runtime?: string;
  director?: string;
  actors?: string;
  imdbId?: string;
}

// Movie list item (returned in search/popular results)
export interface MovieListItem {
  id: string; // Stable internal ID
  title: string;
  year?: number;
  posterUrl?: string;
  imdbRating?: string;
  genre?: string;
  providers: string[]; // Which providers have this movie
}

// Detailed movie (returned by /movies/:id)
export interface MovieDetails extends MovieListItem {
  plot?: string;
  runtime?: string;
  director?: string;
  actors?: string;
  sources: MovieSource[];
}

// A single source/torrent for a movie
export interface MovieSource {
  provider: string;
  externalId: string;
  magnet?: string;
  seeders?: number;
  leechers?: number;
  size?: string;
  language?: string;
}

// Paginated response shape
export interface PaginatedMovies {
  items: MovieListItem[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  totalApprox?: number;
}
