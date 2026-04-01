import { ApiProperty } from '@nestjs/swagger';
import { CommentResponseDto } from './comment-response.dto';

export class CommentsListResponseDto {
  @ApiProperty({ type: [CommentResponseDto] })
  data: CommentResponseDto[];

  @ApiProperty({
    type: 'object',
    properties: {
      total: { type: 'number' },
      page: { type: 'number' },
      limit: { type: 'number' },
      totalPages: { type: 'number' },
      hasNextPage: { type: 'boolean' },
      nextPage: { type: 'number', nullable: true },
    },
  })
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    nextPage: number | null;
  };

  constructor(params: {
    data: CommentResponseDto[];
    total: number;
    page: number;
    limit: number;
  }) {
    const totalPages = Math.ceil(params.total / params.limit);
    const hasNextPage = params.page < totalPages;

    this.data = params.data;
    this.meta = {
      total: params.total,
      page: params.page,
      limit: params.limit,
      totalPages,
      hasNextPage,
      nextPage: hasNextPage ? params.page + 1 : null,
    };
  }
}
