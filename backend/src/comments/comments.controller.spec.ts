import { Test, TestingModule } from '@nestjs/testing';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

describe('CommentsController', () => {
  let controller: CommentsController;
  let commentsService: {
    getLatestComments: jest.Mock;
    getCommentById: jest.Mock;
    createComment: jest.Mock;
    updateComment: jest.Mock;
    deleteComment: jest.Mock;
  };

  beforeEach(async () => {
    commentsService = {
      getLatestComments: jest.fn(),
      getCommentById: jest.fn(),
      createComment: jest.fn(),
      updateComment: jest.fn(),
      deleteComment: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommentsController],
      providers: [{ provide: CommentsService, useValue: commentsService }],
    }).compile();

    controller = module.get<CommentsController>(CommentsController);
  });

  it('returns latest comments', async () => {
    const query = { page: 2, limit: 10 };
    const response = { data: [{ id: 'comment-1' }], meta: { page: 2, limit: 10 } };
    commentsService.getLatestComments.mockResolvedValue(response);

    await expect(controller.getLatestComments(query)).resolves.toEqual(response);
    expect(commentsService.getLatestComments).toHaveBeenCalledWith(query);
  });

  it('returns comment by id', async () => {
    const response = { id: 'comment-1' };
    commentsService.getCommentById.mockResolvedValue(response);

    await expect(controller.getCommentById('comment-1')).resolves.toEqual(response);
  });

  it('creates comment', async () => {
    const user = { id: 'user-1' };
    const dto = { movieId: 'movie-1', content: 'text' };
    const response = { id: 'comment-1' };
    commentsService.createComment.mockResolvedValue(response);

    await expect(controller.createComment(dto as any, user as any)).resolves.toEqual(response);
    expect(commentsService.createComment).toHaveBeenCalledWith(dto, user.id);
  });

  it('updates comment', async () => {
    const user = { id: 'user-1' };
    const dto = { content: 'edited' };
    const response = { id: 'comment-1', content: 'edited' };
    commentsService.updateComment.mockResolvedValue(response);

    await expect(controller.updateComment('comment-1', dto, user as any)).resolves.toEqual(response);
    expect(commentsService.updateComment).toHaveBeenCalledWith('comment-1', dto, user.id);
  });

  it('deletes comment', async () => {
    const user = { id: 'user-1' };
    commentsService.deleteComment.mockResolvedValue({ success: true });

    await expect(controller.deleteComment('comment-1', user as any)).resolves.toEqual({ success: true });
    expect(commentsService.deleteComment).toHaveBeenCalledWith('comment-1', user.id);
  });
});
