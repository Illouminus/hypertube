import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CommentsService } from './comments.service';
import { ListCommentsDto, CreateCommentDto } from './dto';
import { PaginatedComments, CommentItem } from './types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SafeUser } from '../users/users.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  /**
   * GET /movies/:id/comments
   * List comments for a movie with pagination
   */
  @Get('movies/:id/comments')
  async listComments(
    @Param('id') movieId: string,
    @Query() dto: ListCommentsDto,
    @CurrentUser() user: SafeUser,
  ): Promise<PaginatedComments> {
    return this.commentsService.listComments(
      movieId,
      dto.page ?? 1,
      dto.pageSize ?? 20,
      user.id,
    );
  }

  /**
   * POST /movies/:id/comments
   * Create a new comment (rate limited: 10/min)
   */
  @Post('movies/:id/comments')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async createComment(
    @Param('id') movieId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: SafeUser,
  ): Promise<CommentItem> {
    if (!user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.commentsService.createComment(movieId, user.id, dto.body);
  }

  /**
   * DELETE /comments/:id
   * Delete a comment (owner only)
   */
  @Delete('comments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteComment(
    @Param('id') commentId: string,
    @CurrentUser() user: SafeUser,
  ): Promise<void> {
    await this.commentsService.deleteComment(commentId, user.id);
  }
}
