import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { MovieProvider } from './movie-provider.interface';
import { ProviderMovieHit } from '../types';

interface CatalogAMovie {
  id: string;
  title: string;
  year: number;
  imdbId?: string;
  magnet?: string;
  seeders?: number;
  leechers?: number;
  size?: string;
  language?: string;
}

interface CatalogAData {
  name: string;
  description: string;
  movies: CatalogAMovie[];
}

@Injectable()
export class CatalogAProvider implements MovieProvider, OnModuleInit {
  private readonly logger = new Logger(CatalogAProvider.name);
  readonly name = 'catalogA';
  private movies: CatalogAMovie[] = [];

  onModuleInit() {
    this.loadCatalog();
  }

  private loadCatalog() {
    try {
      const dataPath = join(__dirname, 'data', 'catalog-a.json');
      const rawData = readFileSync(dataPath, 'utf-8');
      const catalog: CatalogAData = JSON.parse(rawData);
      this.movies = catalog.movies;
      this.logger.log(`Loaded ${this.movies.length} movies from ${catalog.name}`);
    } catch (error) {
      this.logger.error('Failed to load catalog-a.json', error);
      this.movies = [];
    }
  }

  private toProviderHit(movie: CatalogAMovie): ProviderMovieHit {
    return {
      provider: this.name,
      externalId: movie.id,
      title: movie.title,
      year: movie.year,
      imdbId: movie.imdbId,
      magnet: movie.magnet,
      seeders: movie.seeders,
      leechers: movie.leechers,
      size: movie.size,
      language: movie.language,
    };
  }

  async search(
    query: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: ProviderMovieHit[]; total: number }> {
    const lowerQuery = query.toLowerCase();
    const filtered = this.movies.filter(
      (m) =>
        m.title.toLowerCase().includes(lowerQuery) ||
        m.year?.toString().includes(query),
    );

    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize).map((m) => this.toProviderHit(m));

    return { items, total: filtered.length };
  }

  async popular(
    page: number,
    pageSize: number,
  ): Promise<{ items: ProviderMovieHit[]; total: number }> {
    // Sort by seeders descending for "popularity"
    const sorted = [...this.movies].sort((a, b) => (b.seeders ?? 0) - (a.seeders ?? 0));
    const start = (page - 1) * pageSize;
    const items = sorted.slice(start, start + pageSize).map((m) => this.toProviderHit(m));

    return { items, total: this.movies.length };
  }

  async getById(externalId: string): Promise<ProviderMovieHit | null> {
    const movie = this.movies.find((m) => m.id === externalId);
    return movie ? this.toProviderHit(movie) : null;
  }
}
