import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CommentItem, PaginatedComments } from './types';

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List comments for a movie with pagination
   */
  async listComments(
    movieId: string,
    page: number,
    pageSize: number,
    currentUserId: string,
  ): Promise<PaginatedComments> {
    // Fetch one extra to determine hasMore
    const comments = await this.prisma.comment.findMany({
      where: { movieId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize + 1,
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    const hasMore = comments.length > pageSize;
    const items = comments.slice(0, pageSize).map((comment) =>
      this.toCommentItem(comment, currentUserId),
    );

    return {
      items,
      page,
      pageSize,
      hasMore,
    };
  }

  /**
   * Create a new comment
   */
  async createComment(
    movieId: string,
    userId: string,
    body: string,
  ): Promise<CommentItem> {
    const comment = await this.prisma.comment.create({
      data: {
        movieId,
        body,
        user: { connect: { id: userId } },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    return this.toCommentItem(comment, userId);
  }

  /**
   * Delete a comment (owner only)
   */
  async deleteComment(commentId: string, currentUserId: string): Promise<void> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { userId: true },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.userId !== currentUserId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    await this.prisma.comment.delete({
      where: { id: commentId },
    });
  }

  /**
   * Transform database comment to API response shape
   */
  private toCommentItem(
    comment: {
      id: string;
      body: string;
      createdAt: Date;
      user: { id: string; username: string };
    },
    currentUserId: string,
  ): CommentItem {
    return {
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      user: {
        id: comment.user.id,
        username: comment.user.username,
      },
      isOwner: comment.user.id === currentUserId,
    };
  }
}
