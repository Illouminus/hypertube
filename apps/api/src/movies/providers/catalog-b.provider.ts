import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { MovieProvider } from './movie-provider.interface';
import { ProviderMovieHit } from '../types';

// Catalog B has a different data structure
interface CatalogBEntry {
  entry_id: string;
  movie_title: string;
  release_year: number;
  imdb_id?: string;
  torrent_magnet?: string;
  seeds?: number;
  peers?: number;
  file_size?: string;
  audio_language?: string;
}

interface CatalogBData {
  catalog_name: string;
  catalog_id: string;
  entries: CatalogBEntry[];
}

@Injectable()
export class CatalogBProvider implements MovieProvider, OnModuleInit {
  private readonly logger = new Logger(CatalogBProvider.name);
  readonly name = 'catalogB';
  private entries: CatalogBEntry[] = [];

  onModuleInit() {
    this.loadCatalog();
  }

  private loadCatalog() {
    try {
      const dataPath = join(__dirname, 'data', 'catalog-b.json');
      const rawData = readFileSync(dataPath, 'utf-8');
      const catalog: CatalogBData = JSON.parse(rawData);
      this.entries = catalog.entries;
      this.logger.log(`Loaded ${this.entries.length} entries from ${catalog.catalog_name}`);
    } catch (error) {
      this.logger.error('Failed to load catalog-b.json', error);
      this.entries = [];
    }
  }

  // Normalize from catalog B's structure to the common ProviderMovieHit
  private toProviderHit(entry: CatalogBEntry): ProviderMovieHit {
    return {
      provider: this.name,
      externalId: entry.entry_id,
      title: entry.movie_title,
      year: entry.release_year,
      imdbId: entry.imdb_id,
      magnet: entry.torrent_magnet,
      seeders: entry.seeds,
      leechers: entry.peers,
      size: entry.file_size,
      language: entry.audio_language,
    };
  }

  async search(
    query: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: ProviderMovieHit[]; total: number }> {
    const lowerQuery = query.toLowerCase();
    const filtered = this.entries.filter(
      (e) =>
        e.movie_title.toLowerCase().includes(lowerQuery) ||
        e.release_year?.toString().includes(query),
    );

    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize).map((e) => this.toProviderHit(e));

    return { items, total: filtered.length };
  }

  async popular(
    page: number,
    pageSize: number,
  ): Promise<{ items: ProviderMovieHit[]; total: number }> {
    // Sort by seeds descending for "popularity"
    const sorted = [...this.entries].sort((a, b) => (b.seeds ?? 0) - (a.seeds ?? 0));
    const start = (page - 1) * pageSize;
    const items = sorted.slice(start, start + pageSize).map((e) => this.toProviderHit(e));

    return { items, total: this.entries.length };
  }

  async getById(externalId: string): Promise<ProviderMovieHit | null> {
    const entry = this.entries.find((e) => e.entry_id === externalId);
    return entry ? this.toProviderHit(entry) : null;
  }
}
