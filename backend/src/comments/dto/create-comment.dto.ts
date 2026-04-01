import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({
    description: 'Movie UUID to attach this comment to',
    example: '550e8400-e29b-41d4-a716-446655440010',
  })
  @IsUUID()
  movieId: string;

  @ApiProperty({
    description: 'Comment text',
    example: 'Amazing movie, still holds up today.',
    minLength: 1,
    maxLength: 2000,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;
}
