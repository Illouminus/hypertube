import { IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class MarkWatchedDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    progress?: number; // Optional: playback position in seconds
}
