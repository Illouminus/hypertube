import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { PrismaService } from 'src/prisma/prisma.service';

describe('CommentsService', () => {
  let service: CommentsService;
  let prisma: {
    movie: { findUnique: jest.Mock };
    comment: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      movie: { findUnique: jest.fn() },
      comment: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CommentsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
  });

  it('returns movie comments with author', async () => {
    prisma.comment.findMany.mockResolvedValue([
      {
        id: 'comment-1',
        movieId: 'movie-1',
        userId: 'user-1',
        content: 'Nice',
        createdAt: new Date('2026-04-01T10:00:00.000Z'),
        updatedAt: new Date('2026-04-01T10:00:00.000Z'),
        user: {
          id: 'user-1',
          username: 'neo',
          firstName: 'Thomas',
          lastName: 'Anderson',
          profilePictureUrl: 'https://example.com/avatar.jpg',
        },
      },
    ]);

    const result = await service.getMovieComments('movie-1');

    expect(prisma.comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { movieId: 'movie-1' } }),
    );
    expect(result[0]).toEqual(
      expect.objectContaining({
        id: 'comment-1',
        author: expect.objectContaining({ username: 'neo' }),
      }),
    );
  });

  it('creates a comment for a movie', async () => {
    prisma.movie.findUnique.mockResolvedValue({ id: 'movie-1' });
    prisma.comment.create.mockResolvedValue({
      id: 'comment-1',
      movieId: 'movie-1',
      userId: 'user-1',
      content: 'Great one',
      createdAt: new Date('2026-04-01T10:00:00.000Z'),
      updatedAt: new Date('2026-04-01T10:00:00.000Z'),
      user: {
        id: 'user-1',
        username: 'neo',
        firstName: 'Thomas',
        lastName: 'Anderson',
        profilePictureUrl: 'https://example.com/avatar.jpg',
      },
    });

    const result = await service.createCommentForMovie('movie-1', { content: 'Great one' }, 'user-1');

    expect(result).toEqual(expect.objectContaining({ movieId: 'movie-1', userId: 'user-1' }));
  });

  it('throws not found when creating comment for unknown movie', async () => {
    prisma.movie.findUnique.mockResolvedValue(null);

    await expect(service.createCommentForMovie('movie-1', { content: 'test' }, 'user-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws forbidden when updating another user comment', async () => {
    prisma.comment.findUnique.mockResolvedValue({
      id: 'comment-1',
      userId: 'another-user',
    });

    await expect(service.updateComment('comment-1', { content: 'edit' }, 'user-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
