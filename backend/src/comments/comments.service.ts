import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateMovieCommentDto } from './dto/create-movie-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { CommentResponseDto } from './dto/comment-response.dto';
import { GetCommentsQueryDto } from './dto/get-comments-query.dto';
import { CommentsListResponseDto } from './dto/comments-list-response.dto';

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async getLatestComments(query: GetCommentsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [comments, total] = await this.prisma.$transaction([
      this.prisma.comment.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              profilePictureUrl: true,
            },
          },
        },
      }),
      this.prisma.comment.count(),
    ]);

    return new CommentsListResponseDto({
      data: comments.map((comment) => new CommentResponseDto(comment)),
      total,
      page,
      limit,
    });
  }

  async getCommentById(id: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePictureUrl: true,
          },
        },
      },
    });

    if (!comment) {
      throw new NotFoundException(`Comment with id ${id} not found`);
    }

    return new CommentResponseDto(comment);
  }

  async getMovieComments(movieId: string, query: GetCommentsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [comments, total] = await this.prisma.$transaction([
      this.prisma.comment.findMany({
        where: { movieId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              profilePictureUrl: true,
            },
          },
        },
      }),
      this.prisma.comment.count({ where: { movieId } }),
    ]);

    return new CommentsListResponseDto({
      data: comments.map((comment) => new CommentResponseDto(comment)),
      total,
      page,
      limit,
    });
  }

  async createComment(createCommentDto: CreateCommentDto, userId: string) {
    return this.createCommentForMovie(createCommentDto.movieId, { content: createCommentDto.content }, userId);
  }

  async createCommentForMovie(movieId: string, dto: CreateMovieCommentDto, userId: string) {
    const movie = await this.prisma.movie.findUnique({ where: { id: movieId } });
    if (!movie) {
      throw new NotFoundException(`Movie with id ${movieId} not found`);
    }

    const comment = await this.prisma.comment.create({
      data: {
        movieId,
        userId,
        content: dto.content,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePictureUrl: true,
          },
        },
      },
    });

    return new CommentResponseDto(comment);
  }

  async updateComment(id: string, dto: UpdateCommentDto, userId: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment) {
      throw new NotFoundException(`Comment with id ${id} not found`);
    }

    if (comment.userId !== userId) {
      throw new ForbiddenException('You can only update your own comment');
    }

    const updated = await this.prisma.comment.update({
      where: { id },
      data: {
        ...(dto.content ? { content: dto.content } : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePictureUrl: true,
          },
        },
      },
    });

    return new CommentResponseDto(updated);
  }

  async deleteComment(id: string, userId: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment) {
      throw new NotFoundException(`Comment with id ${id} not found`);
    }

    if (comment.userId !== userId) {
      throw new ForbiddenException('You can only delete your own comment');
    }

    await this.prisma.comment.delete({ where: { id } });
    return { success: true };
  }
}
