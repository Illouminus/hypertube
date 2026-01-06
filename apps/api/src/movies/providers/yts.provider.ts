import { Injectable, Logger } from '@nestjs/common';
import { MovieProvider } from './movie-provider.interface';
import { ProviderMovieHit } from '../types';

/**
 * YTS API response types
 */
interface YtsApiResponse {
    status: string;
    status_message: string;
    data: {
        movie_count: number;
        limit: number;
        page_number: number;
        movies?: YtsMovie[];
        movie?: YtsMovie;
    };
}

interface YtsMovie {
    id: number;
    imdb_code: string;
    title: string;
    title_english: string;
    year: number;
    rating: number;
    runtime: number;
    genres: string[];
    synopsis: string;
    language: string;
    background_image: string;
    small_cover_image: string;
    medium_cover_image: string;
    large_cover_image: string;
    torrents: YtsTorrent[];
}

interface YtsTorrent {
    url: string;
    hash: string;
    quality: string;
    type: string;
    seeds: number;
    peers: number;
    size: string;
    size_bytes: number;
}

// Common BitTorrent trackers for magnet links
const TRACKERS = [
    'udp://tracker.opentrackr.org:1337/announce',
    'udp://tracker.openbittorrent.com:6969/announce',
    'udp://open.stealth.si:80/announce',
    'udp://tracker.torrent.eu.org:451/announce',
    'udp://exodus.desync.com:6969/announce',
];

/**
 * YTS Provider - Movie torrents from YTS API
 * Provides modern movies with magnet links
 */
@Injectable()
export class YtsProvider implements MovieProvider {
    private readonly logger = new Logger(YtsProvider.name);
    readonly name = 'yts';

    private readonly baseUrl = 'https://yts.torrentbay.st/api/v2';

    /**
     * Search movies by query
     */
    async search(
        query: string,
        page: number,
        pageSize: number,
    ): Promise<{ items: ProviderMovieHit[]; total: number }> {
        try {
            const params = new URLSearchParams({
                query_term: query,
                page: page.toString(),
                limit: Math.min(pageSize, 50).toString(),
                sort_by: 'seeds',
                order_by: 'desc',
            });

            const response = await fetch(`${this.baseUrl}/list_movies.json?${params}`);

            if (!response.ok) {
                this.logger.warn(`YTS search failed: ${response.status}`);
                return { items: [], total: 0 };
            }

            const data: YtsApiResponse = await response.json();

            if (data.status !== 'ok' || !data.data.movies) {
                return { items: [], total: 0 };
            }

            const items = data.data.movies
                .filter((m) => m.torrents && m.torrents.length > 0)
                .map((m) => this.toProviderHit(m));

            return {
                items,
                total: data.data.movie_count,
            };
        } catch (error) {
            this.logger.error('YTS search error', error);
            return { items: [], total: 0 };
        }
    }

    /**
     * Get popular movies sorted by seeds
     */
    async popular(
        page: number,
        pageSize: number,
    ): Promise<{ items: ProviderMovieHit[]; total: number }> {
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: Math.min(pageSize, 50).toString(),
                sort_by: 'seeds',
                order_by: 'desc',
            });

            const response = await fetch(`${this.baseUrl}/list_movies.json?${params}`);

            if (!response.ok) {
                this.logger.warn(`YTS popular failed: ${response.status}`);
                return { items: [], total: 0 };
            }

            const data: YtsApiResponse = await response.json();

            if (data.status !== 'ok' || !data.data.movies) {
                return { items: [], total: 0 };
            }

            const items = data.data.movies
                .filter((m) => m.torrents && m.torrents.length > 0)
                .map((m) => this.toProviderHit(m));

            return {
                items,
                total: data.data.movie_count,
            };
        } catch (error) {
            this.logger.error('YTS popular error', error);
            return { items: [], total: 0 };
        }
    }

    /**
     * Get movie by IMDB code or YTS ID
     */
    async getById(externalId: string): Promise<ProviderMovieHit | null> {
        try {
            // externalId can be IMDB code (tt1234567) or YTS numeric ID
            const isImdb = externalId.startsWith('tt');
            const params = new URLSearchParams({
                [isImdb ? 'imdb_id' : 'movie_id']: externalId,
                with_images: 'true',
                with_cast: 'true',
            });

            const response = await fetch(`${this.baseUrl}/movie_details.json?${params}`);

            if (!response.ok) {
                return null;
            }

            const data: YtsApiResponse = await response.json();

            if (data.status !== 'ok' || !data.data.movie) {
                return null;
            }

            return this.toProviderHit(data.data.movie);
        } catch (error) {
            this.logger.error(`YTS getById error for ${externalId}`, error);
            return null;
        }
    }

    /**
     * Convert YTS movie to our ProviderMovieHit format
     */
    private toProviderHit(movie: YtsMovie): ProviderMovieHit {
        // Get best torrent (prefer 1080p, then 720p)
        const sortedTorrents = [...movie.torrents].sort((a, b) => {
            const qualityOrder: Record<string, number> = { '2160p': 4, '1080p': 3, '720p': 2, '480p': 1 };
            return (qualityOrder[b.quality] || 0) - (qualityOrder[a.quality] || 0);
        });

        const bestTorrent = sortedTorrents[0];
        const magnet = this.buildMagnetLink(bestTorrent.hash, movie.title_english || movie.title);

        // Sum seeds from all torrents
        const totalSeeds = movie.torrents.reduce((sum, t) => sum + t.seeds, 0);
        const totalPeers = movie.torrents.reduce((sum, t) => sum + t.peers, 0);

        return {
            provider: this.name,
            externalId: movie.imdb_code || movie.id.toString(),
            title: movie.title_english || movie.title,
            year: movie.year,
            imdbId: movie.imdb_code,
            magnet,
            seeders: totalSeeds,
            leechers: totalPeers,
            size: bestTorrent.size,
            language: movie.language || 'en',
            // Store additional data for frontend
            coverUrl: movie.medium_cover_image || movie.small_cover_image,
            quality: bestTorrent.quality,
            allTorrents: movie.torrents.map((t) => ({
                hash: t.hash,
                quality: t.quality,
                size: t.size,
                seeds: t.seeds,
                peers: t.peers,
                magnet: this.buildMagnetLink(t.hash, movie.title_english || movie.title),
            })),
        } as ProviderMovieHit & { coverUrl?: string; quality?: string; allTorrents?: unknown[] };
    }

    /**
     * Build magnet link from torrent hash
     */
    private buildMagnetLink(hash: string, title: string): string {
        const encodedTitle = encodeURIComponent(title);
        const trackerParams = TRACKERS.map((t) => `&tr=${encodeURIComponent(t)}`).join('');
        return `magnet:?xt=urn:btih:${hash}&dn=${encodedTitle}${trackerParams}`;
    }
}
