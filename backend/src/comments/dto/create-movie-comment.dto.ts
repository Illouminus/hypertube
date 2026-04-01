import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateMovieCommentDto {
  @ApiProperty({
    description: 'Comment text',
    example: 'This soundtrack is incredible.',
    minLength: 1,
    maxLength: 2000,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;
}
