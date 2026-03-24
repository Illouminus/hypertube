import { Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { MoviesCronService } from './movies-cron/movies-cron.service';
import { MoviesService } from './movies.service';
import { GetMoviesFilterDto } from './dto/get-movies-filter.dto';
import { MovieResponseDto, MoviesListResponseDto } from './dto/movie-response.dto';
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

@ApiTags('movies')
@Controller('movies')
export class MoviesController {

    constructor(
        private readonly moviesService: MoviesService,
        private readonly moviesCronService: MoviesCronService,
    ) {}

    @ApiOperation({ summary: 'Get movies from local cache with filters' })
    @ApiOkResponse({ type: MoviesListResponseDto })
    @Get()
    async getMovies(@Query() filters: GetMoviesFilterDto) {
        return this.moviesService.getMovies(filters);
    }

    @ApiOperation({ summary: 'Get one movie by id' })
    @ApiParam({ name: 'id', description: 'Movie UUID' })
    @ApiOkResponse({ type: MovieResponseDto })
    @Get(':id')
    async getMovieById(@Param('id', new ParseUUIDPipe()) id: string) {
        return this.moviesService.getMovieById(id);
    }
    
    @Post('trigger-scraper')
    async triggerScraper() {
        this.moviesCronService.fetchAndCacheJackettMovies();
        return { message: 'Jackett scraping started in background!' };
    }
}
