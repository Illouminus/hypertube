import { IsOptional, IsInt, Min, Max, IsString, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchMoviesDto {
  @IsString()
  @MinLength(1)
  q!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number = 20;
}
