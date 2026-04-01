import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateCommentDto {
  @ApiProperty({
    description: 'Updated comment text',
    example: 'After rewatching, it is even better.',
    required: false,
    minLength: 1,
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content?: string;
}
