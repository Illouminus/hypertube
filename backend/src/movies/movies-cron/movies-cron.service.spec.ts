import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of } from 'rxjs';
import { MoviesCronService } from './movies-cron.service';
import { PrismaService } from 'src/prisma/prisma.service';

describe('MoviesCronService', () => {
  let service: MoviesCronService;
  let httpService: { get: jest.Mock };
  let configService: { get: jest.Mock };
  let prisma: {
    movie: { findUnique: jest.Mock; upsert: jest.Mock };
    torrent: { upsert: jest.Mock };
  };

  beforeEach(async () => {
    httpService = { get: jest.fn() };
    configService = { get: jest.fn() };
    prisma = {
      movie: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      torrent: {
        upsert: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MoviesCronService,
        { provide: HttpService, useValue: httpService },
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<MoviesCronService>(MoviesCronService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns early if Jackett config is missing', async () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'JACKETT_URL') return '';
      if (key === 'JACKETT_API_KEY') return '';
      return undefined;
    });

    await service.fetchAndCacheJackettMovies();

    expect(httpService.get).not.toHaveBeenCalled();
    expect(prisma.torrent.upsert).not.toHaveBeenCalled();
  });

  it('creates fallback movie metadata when TMDB token is missing', async () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'JACKETT_URL') return 'http://jackett';
      if (key === 'JACKETT_API_KEY') return 'secret';
      if (key === 'TMDB_API_TOKEN') return undefined;
      return undefined;
    });

    httpService.get.mockImplementation((url: string) => {
      if (url.includes('/api/v2.0/indexers/all/results')) {
        return of({
          data: {
            Results: [
              {
                Imdb: 133093,
                MagnetUri: 'magnet:?xt=urn:btih:ABC123DEF456',
                Title: 'The Matrix 1080P BluRay',
                Size: 2 * 1024 * 1024 * 1024,
                Seeders: 12,
                Peers: 4,
              },
            ],
          },
        });
      }

      throw new Error('unexpected URL');
    });

    prisma.movie.findUnique.mockResolvedValue(null);
    prisma.movie.upsert.mockResolvedValue({ id: 'movie-1' });
    prisma.torrent.upsert.mockResolvedValue({ id: 'torrent-1' });

    await service.fetchAndCacheJackettMovies();

    expect(prisma.movie.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { imdbId: 'tt0133093' },
      }),
    );
    expect(prisma.torrent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          quality: '1080p',
          size: '2.00 GB',
          seeds: 12,
          peers: 4,
          movieId: 'movie-1',
        }),
      }),
    );
  });

  it('continues processing when one item is invalid', async () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'JACKETT_URL') return 'http://jackett';
      if (key === 'JACKETT_API_KEY') return 'secret';
      if (key === 'TMDB_API_TOKEN') return undefined;
      return undefined;
    });

    httpService.get.mockReturnValue(
      of({
        data: {
          Results: [
            {
              Imdb: 42,
              MagnetUri: 12345,
              Title: 'Broken',
              Size: 100,
            },
            {
              Imdb: 'tt0133093',
              MagnetUri: 'magnet:?xt=urn:btih:FFF111',
              Title: 'The Matrix 4k',
              Size: 1024 * 1024,
              Seeders: 7,
              Peers: 2,
            },
          ],
        },
      }),
    );

    prisma.movie.findUnique.mockResolvedValue(null);
    prisma.movie.upsert.mockResolvedValue({ id: 'movie-2' });
    prisma.torrent.upsert.mockResolvedValue({ id: 'torrent-2' });

    await service.fetchAndCacheJackettMovies();

    expect(prisma.torrent.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.torrent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ quality: '2160p' }),
      }),
    );
  });

  it('fetches TMDb details and stores genres, cast, director and runtime', async () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'JACKETT_URL') return 'http://jackett';
      if (key === 'JACKETT_API_KEY') return 'secret';
      if (key === 'TMDB_API_TOKEN') return 'tmdb-token';
      return undefined;
    });

    httpService.get.mockImplementation((url: string) => {
      if (url.includes('/api/v2.0/indexers/all/results')) {
        return of({
          data: {
            Results: [
              {
                Imdb: 133093,
                MagnetUri: 'magnet:?xt=urn:btih:AAAA1111',
                Title: 'The Matrix 1080p',
                Size: 1500 * 1024 * 1024,
                Seeders: 33,
                Peers: 10,
              },
            ],
          },
        });
      }

      if (url.includes('/find/tt0133093')) {
        return of({
          data: {
            movie_results: [
              {
                id: 603,
                title: 'The Matrix',
                release_date: '1999-03-31',
                vote_average: 8.2,
                overview: 'overview',
                poster_path: '/poster.jpg',
              },
            ],
          },
        });
      }

      if (url.includes('/movie/603')) {
        return of({
          data: {
            release_date: '1999-03-31',
            vote_average: 8.7,
            runtime: 136,
            overview: 'full overview',
            poster_path: '/poster-full.jpg',
            genres: [{ id: 28, name: 'Action' }, { id: 878, name: 'Science Fiction' }],
            credits: {
              cast: [
                { name: 'Keanu Reeves' },
                { name: 'Laurence Fishburne' },
                { name: 'Carrie-Anne Moss' },
              ],
              crew: [
                { job: 'Producer', name: 'Joel Silver' },
                { job: 'Director', name: 'Lana Wachowski' },
              ],
            },
          },
        });
      }

      throw new Error(`unexpected URL ${url}`);
    });

    prisma.movie.findUnique.mockResolvedValue(null);
    prisma.movie.upsert.mockResolvedValue({ id: 'movie-3' });
    prisma.torrent.upsert.mockResolvedValue({ id: 'torrent-3' });

    await service.fetchAndCacheJackettMovies();

    expect(prisma.movie.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { imdbId: 'tt0133093' },
        create: expect.objectContaining({
          runtime: 136,
          genres: ['Action', 'Science Fiction'],
          director: 'Lana Wachowski',
          cast: ['Keanu Reeves', 'Laurence Fishburne', 'Carrie-Anne Moss'],
        }),
      }),
    );
  });
});
