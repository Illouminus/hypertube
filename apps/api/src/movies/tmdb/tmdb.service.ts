import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { OmdbMetadata } from '../types';

/**
 * TMDB API response types
 */
interface TmdbSearchResponse {
    page: number;
    results: TmdbMovie[];
    total_results: number;
}

interface TmdbMovie {
    id: number;
    title: string;
    original_title: string;
    release_date: string;
    poster_path: string | null;
    backdrop_path: string | null;
    overview: string;
    vote_average: number;
    genre_ids: number[];
}

interface TmdbMovieDetails {
    id: number;
    imdb_id: string | null;
    title: string;
    original_title: string;
    release_date: string;
    poster_path: string | null;
    backdrop_path: string | null;
    overview: string;
    vote_average: number;
    runtime: number | null;
    genres: { id: number; name: string }[];
}

interface TmdbCredits {
    cast: { name: string; character: string; order: number }[];
    crew: { name: string; job: string; department: string }[];
}

@Injectable()
export class TmdbService {
    private readonly logger = new Logger(TmdbService.name);
    private readonly apiToken: string;
    private readonly baseUrl = 'https://api.themoviedb.org/3';
    private readonly imageBaseUrl = 'https://image.tmdb.org/t/p';
    private readonly cacheTtlDays = 7;

    constructor(
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
    ) {
        this.apiToken = this.configService.get<string>('TMDB_API_TOKEN', '');
        if (!this.apiToken) {
            this.logger.warn('TMDB_API_TOKEN not configured - TMDB metadata disabled');
        }
    }

    /**
     * Get metadata for a movie by IMDb ID or title+year
     */
    async getMetadata(
        titleOrImdbId: string,
        year?: number,
    ): Promise<OmdbMetadata | null> {
        if (!this.apiToken) {
            return null;
        }

        const cacheKey = this.buildCacheKey(titleOrImdbId, year);

        // Check cache first
        const cached = await this.getFromCache(cacheKey);
        if (cached) {
            return cached;
        }

        // Fetch from TMDB API
        const metadata = await this.fetchFromApi(titleOrImdbId, year);
        if (metadata) {
            await this.saveToCache(cacheKey, metadata);
        }

        return metadata;
    }

    private buildCacheKey(titleOrImdbId: string, year?: number): string {
        if (titleOrImdbId.startsWith('tt')) {
            return `tmdb:imdb:${titleOrImdbId}`;
        }
        const normalizedTitle = titleOrImdbId.toLowerCase().replace(/[^a-z0-9]/g, '');
        return year ? `tmdb:title:${normalizedTitle}:${year}` : `tmdb:title:${normalizedTitle}`;
    }

    private async getFromCache(cacheKey: string): Promise<OmdbMetadata | null> {
        try {
            const cached = await this.prisma.movieMetadataCache.findUnique({
                where: { cacheKey },
            });

            if (cached && cached.expiresAt > new Date()) {
                this.logger.debug(`TMDB cache hit for ${cacheKey}`);
                return cached.data as OmdbMetadata;
            }

            if (cached) {
                await this.prisma.movieMetadataCache.delete({ where: { cacheKey } });
            }

            return null;
        } catch (error) {
            this.logger.error(`TMDB cache read error for ${cacheKey}`, error);
            return null;
        }
    }

    private async saveToCache(cacheKey: string, metadata: OmdbMetadata): Promise<void> {
        try {
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + this.cacheTtlDays);

            await this.prisma.movieMetadataCache.upsert({
                where: { cacheKey },
                update: {
                    data: metadata as object,
                    fetchedAt: new Date(),
                    expiresAt,
                },
                create: {
                    cacheKey,
                    data: metadata as object,
                    expiresAt,
                },
            });

            this.logger.debug(`TMDB cached metadata for ${cacheKey}`);
        } catch (error) {
            this.logger.error(`TMDB cache write error for ${cacheKey}`, error);
        }
    }

    private async fetchFromApi(
        titleOrImdbId: string,
        year?: number,
    ): Promise<OmdbMetadata | null> {
        try {
            let movieId: number | null = null;

            // If IMDb ID, find TMDB movie by external ID
            if (titleOrImdbId.startsWith('tt')) {
                movieId = await this.findByImdbId(titleOrImdbId);
            } else {
                // Search by title
                movieId = await this.searchMovie(titleOrImdbId, year);
            }

            if (!movieId) {
                return null;
            }

            // Get full movie details + credits
            const [details, credits] = await Promise.all([
                this.getMovieDetails(movieId),
                this.getMovieCredits(movieId),
            ]);

            if (!details) {
                return null;
            }

            return this.mapToMetadata(details, credits);
        } catch (error) {
            this.logger.error(`TMDB API error for ${titleOrImdbId}`, error);
            return null;
        }
    }

    private async findByImdbId(imdbId: string): Promise<number | null> {
        const response = await this.apiRequest(`/find/${imdbId}?external_source=imdb_id`);
        if (!response.ok) return null;

        const data = await response.json();
        const movie = data.movie_results?.[0];
        return movie?.id || null;
    }

    private async searchMovie(title: string, year?: number): Promise<number | null> {
        const params = new URLSearchParams({ query: title });
        if (year) {
            params.set('year', year.toString());
        }

        const response = await this.apiRequest(`/search/movie?${params.toString()}`);
        if (!response.ok) return null;

        const data: TmdbSearchResponse = await response.json();
        return data.results[0]?.id || null;
    }

    private async getMovieDetails(movieId: number): Promise<TmdbMovieDetails | null> {
        const response = await this.apiRequest(`/movie/${movieId}`);
        if (!response.ok) return null;
        return response.json();
    }

    private async getMovieCredits(movieId: number): Promise<TmdbCredits | null> {
        const response = await this.apiRequest(`/movie/${movieId}/credits`);
        if (!response.ok) return null;
        return response.json();
    }

    private async apiRequest(endpoint: string): Promise<Response> {
        const url = `${this.baseUrl}${endpoint}`;
        const separator = endpoint.includes('?') ? '&' : '?';

        return fetch(`${url}${separator}language=en-US`, {
            headers: {
                Authorization: `Bearer ${this.apiToken}`,
                Accept: 'application/json',
            },
        });
    }

    private mapToMetadata(
        details: TmdbMovieDetails,
        credits: TmdbCredits | null,
    ): OmdbMetadata {
        // Get director from crew
        const director = credits?.crew.find((c) => c.job === 'Director')?.name;

        // Get top 4 cast members
        const actors = credits?.cast
            .slice(0, 4)
            .map((c) => c.name)
            .join(', ');

        // Format runtime
        const runtime = details.runtime ? `${details.runtime} min` : undefined;

        // Build poster URL (w500 = 500px width)
        const posterUrl = details.poster_path
            ? `${this.imageBaseUrl}/w500${details.poster_path}`
            : undefined;

        return {
            posterUrl,
            imdbRating: details.vote_average ? details.vote_average.toFixed(1) : undefined,
            plot: details.overview || undefined,
            genre: details.genres.map((g) => g.name).join(', ') || undefined,
            runtime,
            director,
            actors,
            imdbId: details.imdb_id || undefined,
        };
    }
}
