import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MoviesSortBy, SortOrder } from './movies-sort.enum';

export class GetMoviesFilterDto {
  @ApiPropertyOptional({ example: 'matrix', description: 'Search in title and summary' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 'Action' })
  @IsOptional()
  @IsString()
  genre?: string;

  @ApiPropertyOptional({ example: 1990, minimum: 1900 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  yearMin?: number;

  @ApiPropertyOptional({ example: 2025, maximum: 2100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Max(2100)
  yearMax?: number;

  @ApiPropertyOptional({ example: 7.5, minimum: 0, maximum: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(10)
  ratingMin?: number;

  @ApiPropertyOptional({ enum: MoviesSortBy })
  @IsOptional()
  @IsEnum(MoviesSortBy)
  sortBy?: MoviesSortBy;

  @ApiPropertyOptional({ enum: SortOrder })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder;

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
