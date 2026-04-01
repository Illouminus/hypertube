import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { ErrorResponseDto } from 'src/common/dto/error-response.dto';
import { UserEntity } from 'src/users/entities/user.entity';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CommentResponseDto } from './dto/comment-response.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { GetCommentsQueryDto } from './dto/get-comments-query.dto';
import { CommentsListResponseDto } from './dto/comments-list-response.dto';

@ApiTags('comments')
@UseGuards(JwtAuthGuard)
@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  @ApiOperation({ summary: 'Get latest comments' })
  @ApiOkResponse({ type: CommentsListResponseDto })
  @ApiUnauthorizedResponse({ description: 'Authentication required', type: ErrorResponseDto })
  getLatestComments(@Query() query: GetCommentsQueryDto) {
    return this.commentsService.getLatestComments(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one comment by id' })
  @ApiParam({ name: 'id', description: 'Comment UUID' })
  @ApiOkResponse({ type: CommentResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid comment id format', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Comment not found', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Authentication required', type: ErrorResponseDto })
  getCommentById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.commentsService.getCommentById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create comment (global endpoint)' })
  @ApiBody({ type: CreateCommentDto })
  @ApiOkResponse({ type: CommentResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed for comment payload', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Movie not found', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Authentication required', type: ErrorResponseDto })
  createComment(@Body() dto: CreateCommentDto, @CurrentUser() user: UserEntity) {
    return this.commentsService.createComment(dto, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update own comment' })
  @ApiParam({ name: 'id', description: 'Comment UUID' })
  @ApiBody({ type: UpdateCommentDto })
  @ApiOkResponse({ type: CommentResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid comment id format or payload', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Comment not found', type: ErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Cannot update another user comment', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Authentication required', type: ErrorResponseDto })
  updateComment(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCommentDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.commentsService.updateComment(id, dto, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete own comment' })
  @ApiParam({ name: 'id', description: 'Comment UUID' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid comment id format', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Comment not found', type: ErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Cannot delete another user comment', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Authentication required', type: ErrorResponseDto })
  deleteComment(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: UserEntity) {
    return this.commentsService.deleteComment(id, user.id);
  }
}
