import { Injectable, Logger } from '@nestjs/common';
import { TmdbService } from '../tmdb';
import { OmdbService } from '../omdb';
import { OmdbMetadata } from '../types';

/**
 * Combined metadata service
 * Priority: TMDB (better posters, more data) -> OMDB (fallback)
 */
@Injectable()
export class MetadataService {
    private readonly logger = new Logger(MetadataService.name);

    constructor(
        private readonly tmdb: TmdbService,
        private readonly omdb: OmdbService,
    ) { }

    /**
     * Get metadata from TMDB first, fallback to OMDB if not found
     */
    async getMetadata(
        titleOrImdbId: string,
        year?: number,
    ): Promise<OmdbMetadata | null> {
        // Try TMDB first (better quality)
        let metadata = await this.tmdb.getMetadata(titleOrImdbId, year);

        if (metadata && metadata.posterUrl) {
            this.logger.debug(`Got metadata from TMDB for ${titleOrImdbId}`);
            return metadata;
        }

        // Fallback to OMDB
        const omdbMetadata = await this.omdb.getMetadata(titleOrImdbId, year);

        if (omdbMetadata) {
            this.logger.debug(`Got metadata from OMDB for ${titleOrImdbId}`);

            // Merge: prefer TMDB data but fill gaps with OMDB
            if (metadata) {
                return {
                    posterUrl: metadata.posterUrl || omdbMetadata.posterUrl,
                    imdbRating: metadata.imdbRating || omdbMetadata.imdbRating,
                    plot: metadata.plot || omdbMetadata.plot,
                    genre: metadata.genre || omdbMetadata.genre,
                    runtime: metadata.runtime || omdbMetadata.runtime,
                    director: metadata.director || omdbMetadata.director,
                    actors: metadata.actors || omdbMetadata.actors,
                    imdbId: metadata.imdbId || omdbMetadata.imdbId,
                };
            }
            return omdbMetadata;
        }

        // Return whatever TMDB had (even if partial)
        return metadata;
    }
}
