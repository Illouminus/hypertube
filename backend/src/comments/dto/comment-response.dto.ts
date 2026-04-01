import { ApiProperty } from '@nestjs/swagger';
import { Prisma } from '../../../generated/prisma/client';

export type CommentWithRelations = Prisma.CommentGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        username: true;
        firstName: true;
        lastName: true;
        profilePictureUrl: true;
      };
    };
  };
}>;

export class CommentAuthorDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  username: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  profilePictureUrl: string;

  constructor(author: CommentWithRelations['user']) {
    this.id = author.id;
    this.username = author.username;
    this.firstName = author.firstName;
    this.lastName = author.lastName;
    this.profilePictureUrl = author.profilePictureUrl;
  }
}

export class CommentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  movieId: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  content: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: CommentAuthorDto })
  author: CommentAuthorDto;

  constructor(comment: CommentWithRelations) {
    this.id = comment.id;
    this.movieId = comment.movieId;
    this.userId = comment.userId;
    this.content = comment.content;
    this.createdAt = comment.createdAt;
    this.updatedAt = comment.updatedAt;
    this.author = new CommentAuthorDto(comment.user);
  }
}
