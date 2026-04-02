import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from 'src/prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { rm } from 'node:fs/promises';
import { extname } from 'node:path';
import { TorrentService } from 'src/torrent/torrent.service';

type CleanupStats = {
    moviesFound: number;
    moviesDeleted: number;
    mediaDeleteAttempts: number;
    mediaDeleteSucceeded: number;
    mediaDeleteFailed: number;
};

@Injectable()
export class MoviesCronService {
    private readonly logger = new Logger(MoviesCronService.name);
    private readonly requestTimeoutMs = 10_000;
    private readonly minSeeders = 3;
    private readonly minPeers = 1;

    constructor(
        private readonly httpService: HttpService,
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
        private readonly torrentService: TorrentService,
    ) {}

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async cleanupStaleLibrary() {
        const stats: CleanupStats = {
            moviesFound: 0,
            moviesDeleted: 0,
            mediaDeleteAttempts: 0,
            mediaDeleteSucceeded: 0,
            mediaDeleteFailed: 0,
        };

        const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
        const cutoffDate = new Date(Date.now() - thirtyDaysInMs);

        const staleMovies = await this.prisma.movie.findMany({
            where: {
                OR: [
                    { lastViewedAt: { lt: cutoffDate } },
                    { lastViewedAt: null, createdAt: { lt: cutoffDate } },
                ],
            },
            include: {
                torrents: {
                    select: {
                        id: true,
                        filePath: true,
                    },
                },
                subtitles: {
                    select: {
                        filePath: true,
                    },
                },
            },
        });

        stats.moviesFound = staleMovies.length;

        if (staleMovies.length === 0) {
            this.logger.log('Library cleanup: no stale movies found.');
            return stats;
        }

        for (const movie of staleMovies) {
            for (const torrent of movie.torrents) {
                // Remove from Transmission daemon (also deletes files on disk)
                await this.torrentService.removeTorrentData(torrent.id);
                const result = await this.deleteLocalMediaArtifacts(torrent.filePath);
                stats.mediaDeleteAttempts += result.attempts;
                stats.mediaDeleteSucceeded += result.succeeded;
                stats.mediaDeleteFailed += result.failed;
            }

            for (const subtitle of movie.subtitles ?? []) {
                if (!subtitle.filePath) continue;
                const deleted = await this.safeRemove(subtitle.filePath);
                stats.mediaDeleteAttempts += 1;
                if (deleted) {
                    stats.mediaDeleteSucceeded += 1;
                } else {
                    stats.mediaDeleteFailed += 1;
                }
            }
        }

        const staleMovieIds = staleMovies.map((movie) => movie.id);
        await this.prisma.movie.deleteMany({
            where: {
                id: { in: staleMovieIds },
            },
        });
        stats.moviesDeleted = staleMovieIds.length;

        this.logger.log(
            `Library cleanup: deleted_movies=${stats.moviesDeleted}, media_delete_attempts=${stats.mediaDeleteAttempts}, media_delete_succeeded=${stats.mediaDeleteSucceeded}, media_delete_failed=${stats.mediaDeleteFailed}`,
        );
        return stats;
    }

    // @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT) // After testing, you can uncomment this line to run the job every day at midnight
    async fetchAndCacheJackettMovies() {
        const jackettUrl = this.configService.get<string>('JACKETT_URL');
        const jackettApiKey = this.configService.get<string>('JACKETT_API_KEY');
        const tmdbToken = this.configService.get<string>('TMDB_API_TOKEN');
        const canUseTmdb = Boolean(tmdbToken);

        if (!jackettUrl || !jackettApiKey) {
            this.logger.error('Jackett URL or API Key is missing in .env');
            return;
        }

        if (!canUseTmdb) {
            this.logger.warn('TMDB_API_TOKEN is missing. Falling back to minimal movie metadata.');
        }

        try {
            this.logger.log('Fetching latest movie torrents from Jackett...');
            
            // First, we get all movie torrents from Jackett (you can adjust the category or add more if needed)
            const jackettResponse = await firstValueFrom(
                this.httpService.get(`${jackettUrl}/api/v2.0/indexers/all/results`, {
                    timeout: this.requestTimeoutMs,
                    params: {
                        apikey: jackettApiKey,
                        'Category[]': 2000,
                    },
                }),
            );

            const results = jackettResponse.data?.Results;
            if (!results || results.length === 0) {
                this.logger.warn('No results found in Jackett. Check your indexers!');
                return;
            }

            this.logger.log(`Found ${results.length} torrents. Processing metadata...`);

            const qualityStats = {
                rejectedMissingCore: 0,
                rejectedInvalidImdb: 0,
                rejectedInvalidHash: 0,
                rejectedLowAvailability: 0,
                deduplicated: 0,
            };
            const candidates = new Map<
                string,
                {
                    title: string;
                    imdbId: string;
                    hash: string;
                    magnet: string;
                    quality: string;
                    size: string;
                    seeds: number;
                    peers: number;
                }
            >();

            for (const item of results) {
                if (!item?.Imdb || !item?.MagnetUri) {
                    qualityStats.rejectedMissingCore += 1;
                    continue;
                }

                const title = typeof item.Title === 'string' ? item.Title : 'Unknown title';
                const imdbId = this.normalizeImdbId(item.Imdb);
                if (!imdbId) {
                    qualityStats.rejectedInvalidImdb += 1;
                    continue;
                }

                if (typeof item.MagnetUri !== 'string') {
                    qualityStats.rejectedInvalidHash += 1;
                    continue;
                }

                const hash = this.extractHash(item.MagnetUri);
                if (!hash) {
                    qualityStats.rejectedInvalidHash += 1;
                    continue;
                }

                const seeds = this.toNonNegativeInt(item.Seeders);
                const peers = this.toNonNegativeInt(item.Peers);
                if (seeds < this.minSeeders || peers < this.minPeers) {
                    qualityStats.rejectedLowAvailability += 1;
                    continue;
                }

                const quality = this.detectQuality(title);
                const dedupKey = `${imdbId}:${quality}`;

                const nextCandidate = {
                    title,
                    imdbId,
                    hash,
                    magnet: item.MagnetUri,
                    quality,
                    size: this.formatSize(item.Size),
                    seeds,
                    peers,
                };

                const currentCandidate = candidates.get(dedupKey);
                if (!currentCandidate) {
                    candidates.set(dedupKey, nextCandidate);
                    continue;
                }

                qualityStats.deduplicated += 1;
                if (this.isBetterCandidate(nextCandidate, currentCandidate)) {
                    candidates.set(dedupKey, nextCandidate);
                }
            }

            const preparedCandidates = [...candidates.values()];
            if (preparedCandidates.length === 0) {
                this.logger.warn(
                    `No acceptable torrents after quality control. Rejected: missing_core=${qualityStats.rejectedMissingCore}, invalid_imdb=${qualityStats.rejectedInvalidImdb}, invalid_hash=${qualityStats.rejectedInvalidHash}, low_availability=${qualityStats.rejectedLowAvailability}`,
                );
                return;
            }

            this.logger.log(
                `Quality control: accepted=${preparedCandidates.length}, deduplicated=${qualityStats.deduplicated}, rejected_missing_core=${qualityStats.rejectedMissingCore}, rejected_invalid_imdb=${qualityStats.rejectedInvalidImdb}, rejected_invalid_hash=${qualityStats.rejectedInvalidHash}, rejected_low_availability=${qualityStats.rejectedLowAvailability}`,
            );

            // Cache movies by IMDb ID to avoid duplicate DB/TMDb work in one run.
            const movieByImdb = new Map<string, Awaited<ReturnType<PrismaService['movie']['findUnique']>>>();
            let enrichedFromTmdbCount = 0;
            let fallbackMovieCreatedCount = 0;
            let skippedInvalidItemCount = 0;

            for (const candidate of preparedCandidates) {
                try {
                    const { title, imdbId, hash } = candidate;

                    let movie = movieByImdb.get(imdbId);
                    if (movie === undefined) {
                        movie = await this.prisma.movie.findUnique({ where: { imdbId } });
                    }

                    const shouldFetchTmdb = canUseTmdb && (!movie || this.needsEnrichment(movie));
                    if (shouldFetchTmdb) {
                        try {
                            const tmdbResponse = await firstValueFrom(
                                this.httpService.get(`https://api.themoviedb.org/3/find/${imdbId}`, {
                                    timeout: this.requestTimeoutMs,
                                    headers: { Authorization: `Bearer ${tmdbToken}` },
                                    params: { external_source: 'imdb_id' },
                                }),
                            );

                            const movieData = tmdbResponse.data?.movie_results?.[0];
                            if (movieData) {
                                const tmdbMovieId = this.toNonNegativeInt(movieData.id);
                                const details = tmdbMovieId
                                    ? await this.fetchTmdbMovieDetails(tmdbMovieId, tmdbToken as string)
                                    : null;

                                const year = this.parseYear(details?.release_date ?? movieData.release_date);
                                const genres = this.extractGenreNames(details?.genres);
                                const cast = this.extractTopCast(details?.credits?.cast);
                                const director = this.extractDirector(details?.credits?.crew);

                                movie = await this.prisma.movie.upsert({
                                    where: { imdbId },
                                    update: {
                                        title: movieData.title || title,
                                        year,
                                        rating: details?.vote_average ?? movieData.vote_average ?? 0,
                                        runtime: this.toNonNegativeInt(details?.runtime),
                                        genres,
                                        summary: details?.overview || movieData.overview || '',
                                        coverImageUrl: (details?.poster_path || movieData.poster_path)
                                            ? `https://image.tmdb.org/t/p/w500${details?.poster_path || movieData.poster_path}`
                                            : 'https://via.placeholder.com/500x750?text=No+Poster',
                                        director,
                                        cast,
                                    },
                                    create: {
                                        imdbId,
                                        title: movieData.title || title,
                                        year,
                                        rating: details?.vote_average ?? movieData.vote_average ?? 0,
                                        runtime: this.toNonNegativeInt(details?.runtime),
                                        genres,
                                        summary: details?.overview || movieData.overview || '',
                                        coverImageUrl: (details?.poster_path || movieData.poster_path)
                                            ? `https://image.tmdb.org/t/p/w500${details?.poster_path || movieData.poster_path}`
                                            : 'https://via.placeholder.com/500x750?text=No+Poster',
                                        director,
                                        cast,
                                    },
                                });
                                enrichedFromTmdbCount += 1;
                            }
                        } catch (tmdbError) {
                            this.logger.warn(`TMDb API error for ${imdbId}: ${this.extractErrorMessage(tmdbError)}`);
                        }
                    }

                    if (!movie) {
                        // Keep torrent ingestion resilient even when TMDb data is unavailable.
                        movie = await this.prisma.movie.upsert({
                            where: { imdbId },
                            update: {
                                title,
                            },
                            create: {
                                imdbId,
                                title,
                                year: 0,
                                rating: 0,
                                runtime: 0,
                                genres: [],
                                summary: '',
                                coverImageUrl: 'https://via.placeholder.com/500x750?text=No+Poster',
                                director: null,
                                cast: [],
                            },
                        });
                        fallbackMovieCreatedCount += 1;
                    }

                    movieByImdb.set(imdbId, movie);

                    await this.prisma.torrent.upsert({
                        where: { hash },
                        update: {
                            magnet: candidate.magnet,
                            quality: candidate.quality,
                            size: candidate.size,
                            seeds: candidate.seeds,
                            peers: candidate.peers,
                            movieId: movie.id,
                        },
                        create: {
                            hash,
                            magnet: candidate.magnet,
                            quality: candidate.quality,
                            size: candidate.size,
                            seeds: candidate.seeds,
                            peers: candidate.peers,
                            movieId: movie.id,
                        },
                    });
                } catch (itemError) {
                    skippedInvalidItemCount += 1;
                    this.logger.warn(`Skipping invalid item: ${this.extractErrorMessage(itemError)}`);
                }
            }

            this.logger.log(
                `Run stats: tmdb_enriched=${enrichedFromTmdbCount}, fallback_created=${fallbackMovieCreatedCount}, skipped_invalid=${skippedInvalidItemCount}`,
            );
            this.logger.log('Scraping and Hydration completed successfully!');
        } catch (error) {
            this.logger.error('Failed to scrape from Jackett', error instanceof Error ? error.stack : String(error));
        }
    }

    private normalizeImdbId(rawImdb: unknown): string | null {
        if (rawImdb === null || rawImdb === undefined) return null;

        const raw = String(rawImdb).trim();
        if (!raw) return null;

        if (/^tt\d{7,8}$/i.test(raw)) {
            return raw.toLowerCase();
        }

        const digits = raw.replace(/\D/g, '');
        if (!digits) return null;

        return `tt${digits.padStart(7, '0')}`;
    }

    private extractHash(magnetUri: string): string | null {
        const hashMatch = magnetUri.match(/btih:([a-zA-Z0-9]+)/i);
        return hashMatch ? hashMatch[1].toLowerCase() : null;
    }

    private async fetchTmdbMovieDetails(movieId: number, token: string): Promise<any | null> {
        const response = await firstValueFrom(
            this.httpService.get(`https://api.themoviedb.org/3/movie/${movieId}`, {
                timeout: this.requestTimeoutMs,
                headers: { Authorization: `Bearer ${token}` },
                params: {
                    language: 'en-US',
                    append_to_response: 'credits',
                },
            }),
        );

        return response.data ?? null;
    }

    private needsEnrichment(movie: NonNullable<Awaited<ReturnType<PrismaService['movie']['findUnique']>>>): boolean {
        return (
            movie.runtime === 0 ||
            !movie.director ||
            !movie.genres ||
            movie.genres.length === 0 ||
            !movie.cast ||
            movie.cast.length === 0
        );
    }

    private extractGenreNames(genres: unknown): string[] {
        if (!Array.isArray(genres)) return [];

        return genres
            .map((genre) => {
                if (!genre || typeof genre !== 'object') return null;
                const name = (genre as { name?: unknown }).name;
                return typeof name === 'string' && name.trim() ? name.trim() : null;
            })
            .filter((name): name is string => Boolean(name));
    }

    private extractTopCast(cast: unknown, limit = 10): string[] {
        if (!Array.isArray(cast)) return [];

        return cast
            .map((person) => {
                if (!person || typeof person !== 'object') return null;
                const name = (person as { name?: unknown }).name;
                return typeof name === 'string' && name.trim() ? name.trim() : null;
            })
            .filter((name): name is string => Boolean(name))
            .slice(0, limit);
    }

    private extractDirector(crew: unknown): string | null {
        if (!Array.isArray(crew)) return null;

        const director = crew.find((member) => {
            if (!member || typeof member !== 'object') return false;
            const job = (member as { job?: unknown }).job;
            return typeof job === 'string' && job.toLowerCase() === 'director';
        });

        if (!director || typeof director !== 'object') return null;
        const name = (director as { name?: unknown }).name;
        return typeof name === 'string' && name.trim() ? name.trim() : null;
    }

    private parseYear(releaseDate: unknown): number {
        if (typeof releaseDate !== 'string' || releaseDate.length < 4) return 0;
        const year = Number.parseInt(releaseDate.substring(0, 4), 10);
        return Number.isFinite(year) ? year : 0;
    }

    private detectQuality(title: string): string {
        const normalizedTitle = title.toLowerCase();
        if (normalizedTitle.includes('2160p') || normalizedTitle.includes('4k')) return '2160p';
        if (normalizedTitle.includes('1080p')) return '1080p';
        if (normalizedTitle.includes('720p')) return '720p';
        if (normalizedTitle.includes('3d')) return '3D';
        return 'Unknown';
    }

    private isBetterCandidate(
        nextCandidate: { seeds: number; peers: number },
        currentCandidate: { seeds: number; peers: number },
    ): boolean {
        if (nextCandidate.seeds !== currentCandidate.seeds) {
            return nextCandidate.seeds > currentCandidate.seeds;
        }

        return nextCandidate.peers > currentCandidate.peers;
    }

    private formatSize(sizeInBytes: unknown): string {
        const size = Number(sizeInBytes);
        if (!Number.isFinite(size) || size <= 0) {
            return 'Unknown';
        }

        const sizeMB = size / (1024 * 1024);
        return sizeMB > 1024 ? `${(sizeMB / 1024).toFixed(2)} GB` : `${sizeMB.toFixed(2)} MB`;
    }

    private toNonNegativeInt(value: unknown): number {
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed < 0) return 0;
        return Math.floor(parsed);
    }

    private extractErrorMessage(error: unknown): string {
        if (error instanceof Error) return error.message;
        return String(error);
    }

    private async deleteLocalMediaArtifacts(filePath: string | null): Promise<{ attempts: number; succeeded: number; failed: number }> {
        if (!filePath) return { attempts: 0, succeeded: 0, failed: 0 };

        let attempts = 0;
        let succeeded = 0;
        let failed = 0;

        attempts += 1;
        if (await this.safeRemove(filePath)) {
            succeeded += 1;
        } else {
            failed += 1;
        }

        const extension = extname(filePath);
        if (!extension) {
            return { attempts, succeeded, failed };
        }

        // Try common subtitle extensions generated near the video file.
        const basePath = filePath.slice(0, -extension.length);
        attempts += 1;
        if (await this.safeRemove(`${basePath}.srt`)) {
            succeeded += 1;
        } else {
            failed += 1;
        }

        attempts += 1;
        if (await this.safeRemove(`${basePath}.vtt`)) {
            succeeded += 1;
        } else {
            failed += 1;
        }

        return { attempts, succeeded, failed };
    }

    private async safeRemove(targetPath: string): Promise<boolean> {
        try {
            await rm(targetPath, { force: true });
            return true;
        } catch (error) {
            this.logger.warn(`Library cleanup: failed to remove ${targetPath}: ${this.extractErrorMessage(error)}`);
            return false;
        }
    }
}