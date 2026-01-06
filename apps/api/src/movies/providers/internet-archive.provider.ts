import { Injectable, Logger } from '@nestjs/common';
import { MovieProvider } from './movie-provider.interface';
import { ProviderMovieHit } from '../types';

/**
 * Internet Archive API response types
 */
interface ArchiveSearchResponse {
    response: {
        numFound: number;
        start: number;
        docs: ArchiveDocument[];
    };
}

interface ArchiveDocument {
    identifier: string;
    title?: string;
    year?: number;
    date?: string;
    description?: string | string[];
    downloads?: number;
    mediatype?: string;
}

interface ArchiveMetadataResponse {
    metadata: {
        identifier: string;
        title?: string;
        year?: string;
        date?: string;
        description?: string;
    };
    files: ArchiveFile[];
}

interface ArchiveFile {
    name: string;
    format: string;
    size?: string;
}

/**
 * Internet Archive Provider
 * Queries feature_films collection for public domain movies with torrent files
 */
@Injectable()
export class InternetArchiveProvider implements MovieProvider {
    private readonly logger = new Logger(InternetArchiveProvider.name);
    readonly name = 'archive';

    private readonly baseUrl = 'https://archive.org';
    private readonly collection = 'feature_films';
    private readonly fields = [
        'identifier',
        'title',
        'year',
        'date',
        'description',
        'downloads',
    ].join(',');

    /**
     * Search for movies in Internet Archive
     */
    async search(
        query: string,
        page: number,
        pageSize: number,
    ): Promise<{ items: ProviderMovieHit[]; total: number }> {
        try {
            const searchQuery = `collection:${this.collection} AND mediatype:movies AND (title:"${query}" OR description:"${query}")`;

            const params = new URLSearchParams({
                q: searchQuery,
                fl: this.fields,
                rows: pageSize.toString(),
                page: page.toString(),
                output: 'json',
                sort: 'downloads desc',
            });

            const response = await fetch(`${this.baseUrl}/advancedsearch.php?${params}`);

            if (!response.ok) {
                this.logger.warn(`Archive.org search failed: ${response.status}`);
                return { items: [], total: 0 };
            }

            const data: ArchiveSearchResponse = await response.json();
            const items = await Promise.all(
                data.response.docs
                    .filter((doc) => doc.title)
                    .slice(0, pageSize)
                    .map((doc) => this.toProviderHit(doc)),
            );

            return {
                items: items.filter((item): item is ProviderMovieHit => item !== null),
                total: data.response.numFound,
            };
        } catch (error) {
            this.logger.error('Archive.org search error', error);
            return { items: [], total: 0 };
        }
    }

    /**
     * Get popular movies sorted by downloads
     */
    async popular(
        page: number,
        pageSize: number,
    ): Promise<{ items: ProviderMovieHit[]; total: number }> {
        try {
            const searchQuery = `collection:${this.collection} AND mediatype:movies`;

            const params = new URLSearchParams({
                q: searchQuery,
                fl: this.fields,
                rows: pageSize.toString(),
                page: page.toString(),
                output: 'json',
                sort: 'downloads desc',
            });

            const response = await fetch(`${this.baseUrl}/advancedsearch.php?${params}`);

            if (!response.ok) {
                this.logger.warn(`Archive.org popular failed: ${response.status}`);
                return { items: [], total: 0 };
            }

            const data: ArchiveSearchResponse = await response.json();
            const items = await Promise.all(
                data.response.docs
                    .filter((doc) => doc.title)
                    .slice(0, pageSize)
                    .map((doc) => this.toProviderHit(doc)),
            );

            return {
                items: items.filter((item): item is ProviderMovieHit => item !== null),
                total: data.response.numFound,
            };
        } catch (error) {
            this.logger.error('Archive.org popular error', error);
            return { items: [], total: 0 };
        }
    }

    /**
     * Get movie by Archive.org identifier
     */
    async getById(externalId: string): Promise<ProviderMovieHit | null> {
        try {
            const response = await fetch(`${this.baseUrl}/metadata/${externalId}`);

            if (!response.ok) {
                return null;
            }

            const data: ArchiveMetadataResponse = await response.json();
            if (!data.metadata) {
                return null;
            }

            // Find torrent file
            const torrentFile = data.files?.find((f) => f.name.endsWith('_archive.torrent'));
            const torrentUrl = torrentFile
                ? `${this.baseUrl}/download/${externalId}/${torrentFile.name}`
                : null;

            return {
                provider: this.name,
                externalId,
                title: data.metadata.title || externalId,
                year: this.parseYear(data.metadata.year || data.metadata.date),
                magnet: torrentUrl ?? undefined, // Using torrent URL as magnet field for now
                seeders: 0, // Archive.org doesn't provide seed counts
                language: 'en',
            };
        } catch (error) {
            this.logger.error(`Archive.org getById error for ${externalId}`, error);
            return null;
        }
    }

    /**
     * Convert Archive.org document to ProviderMovieHit
     */
    private async toProviderHit(doc: ArchiveDocument): Promise<ProviderMovieHit | null> {
        // Build torrent URL (Archive.org standard format)
        const torrentUrl = `${this.baseUrl}/download/${doc.identifier}/${doc.identifier}_archive.torrent`;

        return {
            provider: this.name,
            externalId: doc.identifier,
            title: doc.title || doc.identifier,
            year: this.parseYear(doc.year || doc.date),
            magnet: torrentUrl, // Torrent file URL
            seeders: doc.downloads || 0, // Use downloads as popularity proxy
            language: 'en',
        };
    }

    /**
     * Parse year from various date formats
     */
    private parseYear(yearOrDate: string | number | undefined): number | undefined {
        if (!yearOrDate) return undefined;

        if (typeof yearOrDate === 'number') {
            return yearOrDate;
        }

        const match = yearOrDate.match(/\b(19|20)\d{2}\b/);
        if (match) {
            return parseInt(match[0], 10);
        }

        return undefined;
    }
}
