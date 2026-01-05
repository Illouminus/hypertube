import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty({ message: 'Comment body cannot be empty' })
  @MaxLength(2000, { message: 'Comment must be at most 2000 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  body!: string;
}
