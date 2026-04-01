import { Test, TestingModule } from '@nestjs/testing';
import { MoviesController } from './movies.controller';
import { MoviesService } from './movies.service';
import { MoviesCronService } from './movies-cron/movies-cron.service';
import { CommentsService } from 'src/comments/comments.service';
import { SubtitlesService } from 'src/subtitles/subtitles.service';

describe('MoviesController', () => {
  let controller: MoviesController;
  let moviesService: { getMovies: jest.Mock; getMovieById: jest.Mock; recordView: jest.Mock };
  let moviesCronService: { fetchAndCacheJackettMovies: jest.Mock; cleanupStaleLibrary: jest.Mock };
  let commentsService: { getMovieComments: jest.Mock; createCommentForMovie: jest.Mock };
  let subtitlesService: { ensureSubtitlesForMovie: jest.Mock; listSubtitles: jest.Mock; getSubtitleFilePath: jest.Mock };

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
    commentsService = {
      getMovieComments: jest.fn(),
      createCommentForMovie: jest.fn(),
    };
    subtitlesService = {
      ensureSubtitlesForMovie: jest.fn(),
      listSubtitles: jest.fn(),
      getSubtitleFilePath: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MoviesController],
      providers: [
        { provide: MoviesService, useValue: moviesService },
        { provide: MoviesCronService, useValue: moviesCronService },
        { provide: CommentsService, useValue: commentsService },
        { provide: SubtitlesService, useValue: subtitlesService },
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
    const stats = {
      moviesFound: 2,
      moviesDeleted: 2,
      mediaDeleteAttempts: 6,
      mediaDeleteSucceeded: 6,
      mediaDeleteFailed: 0,
    };
    moviesCronService.cleanupStaleLibrary.mockResolvedValue(stats);

    await expect(controller.cleanupLibrary()).resolves.toEqual({
      message: 'Library cleanup finished successfully.',
      stats,
    });
    expect(moviesCronService.cleanupStaleLibrary).toHaveBeenCalledTimes(1);
  });

  it('returns one movie by id', async () => {
    const movieId = '91af3be9-d9d0-4e82-a347-3ece7624d6ea';
    const user = { id: 'user-123', preferredLanguage: 'fr' };
    const response = { id: movieId, title: 'The Matrix' };
    moviesService.getMovieById.mockResolvedValue(response);

    await expect(controller.getMovieById(movieId, user as any)).resolves.toEqual(response);
    expect(moviesService.getMovieById).toHaveBeenCalledWith(movieId, user.preferredLanguage);
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

  it('returns movie comments', async () => {
    const movieId = '91af3be9-d9d0-4e82-a347-3ece7624d6ea';
    const query = { page: 1, limit: 20 };
    const response = {
      data: [{ id: 'comment-1', content: 'Great movie' }],
      meta: { total: 1, page: 1, limit: 20, totalPages: 1, hasNextPage: false, nextPage: null },
    };
    commentsService.getMovieComments.mockResolvedValue(response);

    await expect(controller.getMovieComments(movieId, query)).resolves.toEqual(response);
    expect(commentsService.getMovieComments).toHaveBeenCalledWith(movieId, query);
  });

  it('creates a movie comment', async () => {
    const movieId = '91af3be9-d9d0-4e82-a347-3ece7624d6ea';
    const user = { id: 'user-123' };
    const dto = { content: 'Amazing!' };
    const response = { id: 'comment-1', movieId, userId: user.id, content: 'Amazing!' };
    commentsService.createCommentForMovie.mockResolvedValue(response);

    await expect(controller.createMovieComment(movieId, dto, user as any)).resolves.toEqual(response);
    expect(commentsService.createCommentForMovie).toHaveBeenCalledWith(movieId, dto, user.id);
  });

  it('returns movie subtitles list', async () => {
    const movieId = '91af3be9-d9d0-4e82-a347-3ece7624d6ea';
    const user = { id: 'user-123', preferredLanguage: 'fr' };
    const response = [{ id: 'subtitle-1', languageCode: 'en', status: 'READY' }];
    subtitlesService.listSubtitles.mockResolvedValue(response);

    await expect(controller.getMovieSubtitles(movieId, user as any)).resolves.toEqual(response);
    expect(subtitlesService.ensureSubtitlesForMovie).toHaveBeenCalledWith(movieId, user.preferredLanguage);
    expect(subtitlesService.listSubtitles).toHaveBeenCalledWith(movieId, user.preferredLanguage);
  });

  it('forces subtitle refresh for movie', async () => {
    const movieId = '91af3be9-d9d0-4e82-a347-3ece7624d6ea';
    const user = { id: 'user-123', preferredLanguage: 'fr' };

    await expect(controller.refreshMovieSubtitles(movieId, user as any)).resolves.toEqual({
      success: true,
      message: 'Subtitle refresh has been started.',
    });
    expect(subtitlesService.ensureSubtitlesForMovie).toHaveBeenCalledWith(movieId, user.preferredLanguage, true);
  });
});
