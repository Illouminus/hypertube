import { ProviderMovieHit } from '../types';

/**
 * Interface for movie content providers
 * Each provider must implement search and popular methods
 */
export interface MovieProvider {
  /** Unique identifier for this provider */
  readonly name: string;

  /**
   * Search for movies matching a query
   * @param query - Search query string
   * @param page - Page number (1-indexed)
   * @param pageSize - Number of results per page
   */
  search(
    query: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: ProviderMovieHit[]; total: number }>;

  /**
   * Get popular/featured movies
   * @param page - Page number (1-indexed)
   * @param pageSize - Number of results per page
   */
  popular(
    page: number,
    pageSize: number,
  ): Promise<{ items: ProviderMovieHit[]; total: number }>;

  /**
   * Get a specific movie by external ID
   * @param externalId - The provider-specific ID
   */
  getById(externalId: string): Promise<ProviderMovieHit | null>;
}

/** Token for injecting all movie providers */
export const MOVIE_PROVIDERS = Symbol('MOVIE_PROVIDERS');
