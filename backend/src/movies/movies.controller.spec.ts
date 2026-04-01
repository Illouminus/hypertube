import { Test, TestingModule } from '@nestjs/testing';
import { MoviesController } from './movies.controller';
import { MoviesService } from './movies.service';
import { MoviesCronService } from './movies-cron/movies-cron.service';

describe('MoviesController', () => {
  let controller: MoviesController;
  let moviesService: { getMovies: jest.Mock; getMovieById: jest.Mock; recordView: jest.Mock };
  let moviesCronService: { fetchAndCacheJackettMovies: jest.Mock; cleanupStaleLibrary: jest.Mock };

  beforeEach(async () => {
    moviesService = {
      getMovies: jest.fn(),
      getMovieById: jest.fn(),
      recordView: jest.fn(),
    };
    moviesCronService = {
      fetchAndCacheJackettMovies: jest.fn(),
      cleanupStaleLibrary: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MoviesController],
      providers: [
        { provide: MoviesService, useValue: moviesService },
        { provide: MoviesCronService, useValue: moviesCronService },
      ],
    }).compile();

    controller = module.get<MoviesController>(MoviesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('returns filtered movies from service', async () => {
    const filters = { search: 'matrix', page: 2, limit: 10 };
    const user = { id: 'user-123' };
    const response = {
      data: [],
      meta: { total: 0, page: 2, limit: 10, totalPages: 0 },
    };
    moviesService.getMovies.mockResolvedValue(response);

    await expect(controller.getMovies(filters, user as any)).resolves.toEqual(response);
    expect(moviesService.getMovies).toHaveBeenCalledWith(filters, user.id);
  });

  it('triggers scraper endpoint', async () => {
    await expect(controller.triggerScraper()).resolves.toEqual({
      message: 'Jackett scraping started in background!',
    });
    expect(moviesCronService.fetchAndCacheJackettMovies).toHaveBeenCalledTimes(1);
  });

  it('triggers cleanup endpoint', async () => {
    await expect(controller.cleanupLibrary()).resolves.toEqual({
      message: 'Library cleanup finished successfully.',
    });
    expect(moviesCronService.cleanupStaleLibrary).toHaveBeenCalledTimes(1);
  });

  it('returns one movie by id', async () => {
    const movieId = '91af3be9-d9d0-4e82-a347-3ece7624d6ea';
    const response = { id: movieId, title: 'The Matrix' };
    moviesService.getMovieById.mockResolvedValue(response);

    await expect(controller.getMovieById(movieId)).resolves.toEqual(response);
    expect(moviesService.getMovieById).toHaveBeenCalledWith(movieId);
  });

  it('records a movie view for authenticated user', async () => {
    const movieId = '91af3be9-d9d0-4e82-a347-3ece7624d6ea';
    const user = { id: 'user-123', email: 'user@example.com' };
    const response = {
      id: 'view-id-123',
      userId: user.id,
      movieId,
      viewedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    moviesService.recordView.mockResolvedValue(response);

    await expect(controller.recordMovieView(movieId, user as any)).resolves.toEqual(response);
    expect(moviesService.recordView).toHaveBeenCalledWith(movieId, user.id);
  });
});
