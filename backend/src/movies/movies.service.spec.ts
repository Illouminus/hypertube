import { Test, TestingModule } from '@nestjs/testing';
import { MoviesService } from './movies.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MoviesSortBy, SortOrder } from './dto/movies-sort.enum';

describe('MoviesService', () => {
  let service: MoviesService;
  let prisma: {
    $transaction: jest.Mock;
    movie: {
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(),
      movie: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      movieView: {
        upsert: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MoviesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<MoviesService>(MoviesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('uses defaults for pagination and sorting', async () => {
    prisma.movie.findMany.mockReturnValue('findManyCall');
    prisma.movie.count.mockReturnValue('countCall');
    prisma.$transaction.mockResolvedValue([[], 0]);

    const result = await service.getMovies({}, 'user-id-123');

    expect(prisma.movie.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        orderBy: [{ torrents: { _count: 'desc' } }, { rating: 'desc' }],
        skip: 0,
        take: 20,
        include: {
          torrents: true,
          movieViews: {
            where: { userId: 'user-id-123' },
            select: { id: true },
          },
        },
      }),
    );
    expect(prisma.movie.count).toHaveBeenCalledWith({ where: {} });
    expect(prisma.$transaction).toHaveBeenCalledWith(['findManyCall', 'countCall']);
    expect(result).toEqual({
      data: [],
      meta: {
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      },
    });
  });

  it('maps filter dto to prisma query', async () => {
    prisma.movie.findMany.mockReturnValue('findManyCall');
    prisma.movie.count.mockReturnValue('countCall');
    prisma.$transaction.mockResolvedValue([[{ id: '1' }], 35]);

    const result = await service.getMovies({
      search: 'matrix',
      genre: 'Action',
      yearMin: 1990,
      yearMax: 2005,
      ratingMin: 7,
      sortBy: MoviesSortBy.YEAR,
      sortOrder: SortOrder.ASC,
      page: 2,
      limit: 10,
    }, 'user-id-123');

    expect(prisma.movie.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { title: { contains: 'matrix', mode: 'insensitive' } },
            { summary: { contains: 'matrix', mode: 'insensitive' } },
          ],
          genres: { has: 'Action' },
          year: { gte: 1990, lte: 2005 },
          rating: { gte: 7 },
        },
        orderBy: { year: 'asc' },
        skip: 10,
        take: 10,
        include: {
          torrents: true,
          movieViews: {
            where: { userId: 'user-id-123' },
            select: { id: true },
          },
        },
      }),
    );
    expect(result.meta).toEqual({
      total: 35,
      page: 2,
      limit: 10,
      totalPages: 4,
    });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toEqual(
      expect.objectContaining({
        id: '1',
        torrents: [],
        isWatched: false,
      }),
    );
  });

  it('sets isWatched to true when current user has viewed movie', async () => {
    prisma.movie.findMany.mockReturnValue('findManyCall');
    prisma.movie.count.mockReturnValue('countCall');
    prisma.$transaction.mockResolvedValue([
      [
        {
          id: 'movie-1',
          imdbId: 'tt0133093',
          title: 'The Matrix',
          year: 1999,
          rating: 8.7,
          runtime: 136,
          genres: ['Action'],
          summary: 'A hacker discovers reality.',
          coverImageUrl: 'https://example.com/poster.jpg',
          director: 'Lana Wachowski',
          cast: ['Keanu Reeves'],
          lastViewedAt: null,
          createdAt: new Date('2026-03-24T00:00:00.000Z'),
          updatedAt: new Date('2026-03-24T00:00:00.000Z'),
          torrents: [],
          movieViews: [{ id: 'view-1' }],
        },
      ],
      1,
    ]);

    const result = await service.getMovies({}, 'user-id-123');

    expect(result.data[0]).toEqual(
      expect.objectContaining({
        id: 'movie-1',
        isWatched: true,
      }),
    );
  });

  it('throws bad request when year range is invalid', async () => {
    await expect(
      service.getMovies({
        yearMin: 2020,
        yearMax: 2000,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns a movie by id', async () => {
    prisma.movie.findUnique.mockResolvedValue({
      id: '91af3be9-d9d0-4e82-a347-3ece7624d6ea',
      imdbId: 'tt0133093',
      title: 'The Matrix',
      year: 1999,
      rating: 8.7,
      runtime: 136,
      genres: ['Action'],
      summary: 'A hacker discovers reality.',
      coverImageUrl: 'https://example.com/poster.jpg',
      director: 'Lana Wachowski',
      cast: ['Keanu Reeves'],
      lastViewedAt: null,
      createdAt: new Date('2026-03-24T00:00:00.000Z'),
      updatedAt: new Date('2026-03-24T00:00:00.000Z'),
      torrents: [],
    });

    const result = await service.getMovieById('91af3be9-d9d0-4e82-a347-3ece7624d6ea');

    expect(prisma.movie.findUnique).toHaveBeenCalledWith({
      where: { id: '91af3be9-d9d0-4e82-a347-3ece7624d6ea' },
      include: { torrents: true },
    });
    expect(result).toEqual(
      expect.objectContaining({
        id: '91af3be9-d9d0-4e82-a347-3ece7624d6ea',
        title: 'The Matrix',
      }),
    );
  });

  it('throws not found when movie id is missing', async () => {
    prisma.movie.findUnique.mockResolvedValue(null);

    await expect(service.getMovieById('91af3be9-d9d0-4e82-a347-3ece7624d6ea')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('records a movie view and updates lastViewedAt', async () => {
    const movieId = '91af3be9-d9d0-4e82-a347-3ece7624d6ea';
    const userId = 'user-id-123';
    const viewDate = new Date();

    prisma.movie.findUnique.mockResolvedValue({ id: movieId });
    prisma.$transaction.mockResolvedValue([
      {
        id: 'view-id-123',
        userId,
        movieId,
        viewedAt: viewDate,
        createdAt: viewDate,
        updatedAt: viewDate,
      },
      { id: movieId, lastViewedAt: viewDate },
    ]);

    const result = await service.recordView(movieId, userId);

    expect(prisma.movie.findUnique).toHaveBeenCalledWith({ where: { id: movieId } });
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        id: 'view-id-123',
        userId,
        movieId,
      }),
    );
  });

  it('throws not found when recording view for non-existent movie', async () => {
    const movieId = '91af3be9-d9d0-4e82-a347-3ece7624d6ea';
    const userId = 'user-id-123';

    prisma.movie.findUnique.mockResolvedValue(null);

    await expect(service.recordView(movieId, userId)).rejects.toBeInstanceOf(NotFoundException);
  });
});
