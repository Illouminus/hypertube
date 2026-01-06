import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { MovieProvider, MOVIE_PROVIDERS } from './providers';
import { MetadataService } from './metadata';
import { PrismaService } from '../prisma/prisma.service';
import {
  MovieListItem,
  MovieDetails,
  MovieSource,
  PaginatedMovies,
  ProviderMovieHit,
} from './types';

@Injectable()
export class MoviesService {
  private readonly logger = new Logger(MoviesService.name);

  constructor(
    @Inject(MOVIE_PROVIDERS)
    private readonly providers: MovieProvider[],
    private readonly metadataService: MetadataService,
    private readonly prisma: PrismaService,
  ) {
    this.logger.log(`Initialized with ${this.providers.length} providers`);
  }

  /**
   * Search movies across all providers
   */
  async search(
    query: string,
    page: number,
    pageSize: number,
    userId?: string,
  ): Promise<PaginatedMovies> {
    // Query all providers in parallel
    const providerResults = await Promise.all(
      this.providers.map((provider) =>
        provider.search(query, page, pageSize).catch((error) => {
          this.logger.error(`Provider ${provider.name} search failed`, error);
          return { items: [], total: 0 };
        }),
      ),
    );

    // Merge and deduplicate results
    const allHits: ProviderMovieHit[] = [];
    let totalApprox = 0;

    for (const result of providerResults) {
      allHits.push(...result.items);
      totalApprox += result.total;
    }

    // Group by normalized title+year
    const grouped = this.groupMovies(allHits);

    // Paginate the grouped results (since we already got paged from providers,
    // we just take what we have)
    const items = await this.enrichMovies(grouped);

    // Sort by name (per subject requirements)
    items.sort((a, b) => a.title.localeCompare(b.title));

    // Add watched status if user is authenticated
    if (userId) {
      await this.addWatchedStatus(items, userId);
    }

    return {
      items,
      page,
      pageSize,
      hasMore: items.length === pageSize,
      totalApprox,
    };
  }

  /**
   * Get popular movies across all providers
   */
  async popular(
    page: number,
    pageSize: number,
    userId?: string,
  ): Promise<PaginatedMovies> {
    // Query all providers in parallel
    const providerResults = await Promise.all(
      this.providers.map((provider) =>
        provider.popular(page, pageSize).catch((error) => {
          this.logger.error(`Provider ${provider.name} popular failed`, error);
          return { items: [], total: 0 };
        }),
      ),
    );

    // Merge all hits
    const allHits: ProviderMovieHit[] = [];
    let totalApprox = 0;

    for (const result of providerResults) {
      allHits.push(...result.items);
      totalApprox += result.total;
    }

    // Sort merged results by seeders/downloads (best overall popularity)
    allHits.sort((a, b) => (b.seeders ?? 0) - (a.seeders ?? 0));

    // Take only pageSize items from merged results
    const paged = allHits.slice(0, pageSize);

    // Group by normalized title+year
    const grouped = this.groupMovies(paged);

    // Enrich with OMDb metadata
    const items = await this.enrichMovies(grouped);

    // Add watched status if user is authenticated
    if (userId) {
      await this.addWatchedStatus(items, userId);
    }

    return {
      items,
      page,
      pageSize,
      hasMore: allHits.length > pageSize,
      totalApprox,
    };
  }

  /**
   * Get movie details by internal ID
   */
  async getById(id: string, userId?: string): Promise<MovieDetails> {
    // Parse the ID to get provider and externalId
    const parsed = this.parseMovieId(id);

    if (!parsed) {
      throw new NotFoundException(`Movie ${id} not found`);
    }

    const { provider: providerName, externalId } = parsed;

    // Find the provider
    const provider = this.providers.find((p) => p.name === providerName);
    if (!provider) {
      throw new NotFoundException(`Provider ${providerName} not found`);
    }

    // Get the movie from provider
    const hit = await provider.getById(externalId);
    if (!hit) {
      throw new NotFoundException(`Movie ${id} not found`);
    }

    // Get metadata (TMDB first, OMDB fallback)
    const metadata = hit.imdbId
      ? await this.metadataService.getMetadata(hit.imdbId)
      : await this.metadataService.getMetadata(hit.title, hit.year);

    // Also check other providers for this movie (by title+year match)
    const sources: MovieSource[] = [this.hitToSource(hit)];

    // Check other providers for matching movies
    const otherProviders = this.providers.filter((p) => p.name !== providerName);
    const otherSearches = await Promise.all(
      otherProviders.map(async (p) => {
        try {
          const result = await p.search(hit.title, 1, 5);
          return result.items.filter(
            (h) =>
              h.title.toLowerCase() === hit.title.toLowerCase() &&
              h.year === hit.year,
          );
        } catch {
          return [];
        }
      }),
    );

    for (const matches of otherSearches) {
      for (const match of matches) {
        sources.push(this.hitToSource(match));
      }
    }

    // Check if watched by user
    let isWatched = false;
    if (userId) {
      const watched = await this.prisma.watchedMovie.findUnique({
        where: { userId_movieId: { userId, movieId: id } },
      });
      isWatched = !!watched;
    }

    return {
      id,
      title: hit.title,
      year: hit.year,
      posterUrl: metadata?.posterUrl,
      imdbRating: metadata?.imdbRating,
      genre: metadata?.genre,
      plot: metadata?.plot,
      runtime: metadata?.runtime,
      director: metadata?.director,
      actors: metadata?.actors,
      providers: [...new Set(sources.map((s) => s.provider))],
      sources,
      isWatched,
    };
  }

  /**
   * Mark a movie as watched for a user
   */
  async markWatched(userId: string, movieId: string, progress?: number): Promise<void> {
    await this.prisma.watchedMovie.upsert({
      where: { userId_movieId: { userId, movieId } },
      update: { watchedAt: new Date(), progress },
      create: { userId, movieId, progress },
    });
  }

  /**
   * Remove watched status for a movie
   */
  async markUnwatched(userId: string, movieId: string): Promise<void> {
    await this.prisma.watchedMovie.deleteMany({
      where: { userId, movieId },
    });
  }

  /**
   * Add watched status to movie list items (efficient batch query)
   */
  private async addWatchedStatus(items: MovieListItem[], userId: string): Promise<void> {
    if (items.length === 0) return;

    const movieIds = items.map((item) => item.id);
    const watchedRecords = await this.prisma.watchedMovie.findMany({
      where: {
        userId,
        movieId: { in: movieIds },
      },
      select: { movieId: true },
    });

    const watchedSet = new Set(watchedRecords.map((r: { movieId: string }) => r.movieId));
    for (const item of items) {
      item.isWatched = watchedSet.has(item.id);
    }
  }

  /**
   * Parse a movie ID back to provider and externalId
   */
  private encodeMovieId(provider: string, externalId: string): string {
    return Buffer.from(`${provider}:${externalId}`).toString('base64url');
  }

  private parseMovieId(id: string): { provider: string; externalId: string } | null {
    try {
      const decoded = Buffer.from(id, 'base64url').toString('utf-8');
      const [provider, ...rest] = decoded.split(':');
      const externalId = rest.join(':');
      if (provider && externalId) {
        return { provider, externalId };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Group provider hits by normalized title+year
   * Returns a map of movieId -> { hits, bestHit }
   */
  private groupMovies(
    hits: ProviderMovieHit[],
  ): Map<string, { id: string; hits: ProviderMovieHit[] }> {
    const grouped = new Map<string, { id: string; hits: ProviderMovieHit[] }>();

    for (const hit of hits) {
      // Generate stable ID using first provider's data
      const movieId = this.encodeMovieId(hit.provider, hit.externalId);

      // Try to find existing group with same title+year
      let found = false;
      for (const [, group] of grouped) {
        const existing = group.hits[0];
        if (
          existing.title.toLowerCase() === hit.title.toLowerCase() &&
          existing.year === hit.year
        ) {
          group.hits.push(hit);
          found = true;
          break;
        }
      }

      if (!found) {
        grouped.set(movieId, { id: movieId, hits: [hit] });
      }
    }

    return grouped;
  }

  /**
   * Enrich grouped movies with OMDb metadata
   */
  private async enrichMovies(
    grouped: Map<string, { id: string; hits: ProviderMovieHit[] }>,
  ): Promise<MovieListItem[]> {
    const items: MovieListItem[] = [];

    // Prepare batch metadata requests
    const metadataRequests: Array<{
      id: string;
      hit: ProviderMovieHit;
      titleOrImdbId: string;
      year?: number;
    }> = [];

    for (const [, group] of grouped) {
      const hit = group.hits[0]; // Use first hit as primary
      const titleOrImdbId = hit.imdbId || hit.title;
      metadataRequests.push({
        id: group.id,
        hit,
        titleOrImdbId,
        year: hit.year,
      });
    }

    // Fetch metadata in parallel (with batching in the service)
    const metadataPromises = metadataRequests.map(async (req) => {
      const metadata = await this.metadataService.getMetadata(
        req.titleOrImdbId,
        req.year,
      );
      return { req, metadata };
    });

    const results = await Promise.all(metadataPromises);

    for (const { req, metadata } of results) {
      const group = grouped.get(req.id)!;
      // Use metadata poster or fallback to provider's cover image
      const posterUrl = metadata?.posterUrl || req.hit.coverUrl;

      // Skip movies without poster - no point showing them
      if (!posterUrl) {
        continue;
      }

      items.push({
        id: req.id,
        title: req.hit.title,
        year: req.hit.year,
        posterUrl,
        imdbRating: metadata?.imdbRating,
        genre: metadata?.genre,
        providers: [...new Set(group.hits.map((h) => h.provider))],
      });
    }

    return items;
  }

  private hitToSource(hit: ProviderMovieHit): MovieSource {
    // For Archive.org, magnet field contains torrent URL
    const isArchive = hit.provider === 'archive';
    return {
      provider: hit.provider,
      externalId: hit.externalId,
      magnet: isArchive ? undefined : hit.magnet,
      torrentUrl: isArchive ? hit.magnet : undefined,
      quality: hit.quality,
      seeders: hit.seeders,
      leechers: hit.leechers,
      size: hit.size,
      language: hit.language,
    };
  }
}
