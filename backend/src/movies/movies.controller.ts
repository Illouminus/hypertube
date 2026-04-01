import { Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { MoviesCronService } from './movies-cron/movies-cron.service';
import { MoviesService } from './movies.service';
import { GetMoviesFilterDto } from './dto/get-movies-filter.dto';
import { MovieResponseDto, MoviesListResponseDto } from './dto/movie-response.dto';
import { ApiBadRequestResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { ErrorResponseDto } from 'src/common/dto/error-response.dto';
import { RecordViewDto } from './dto/record-view.dto';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { UserEntity } from 'src/users/entities/user.entity';

@ApiTags('movies')
@Controller('movies')
export class MoviesController {

    constructor(
        private readonly moviesService: MoviesService,
        private readonly moviesCronService: MoviesCronService,
    ) {}

    @ApiOperation({ summary: 'Get movies from local cache with filters' })
    @ApiOkResponse({ type: MoviesListResponseDto })
    @ApiBadRequestResponse({
        description: 'Invalid query parameters or invalid year range',
        type: ErrorResponseDto,
    })
    @ApiUnauthorizedResponse({ description: 'Authentication required', type: ErrorResponseDto })
    @UseGuards(JwtAuthGuard)
    @Get()
    async getMovies(@Query() filters: GetMoviesFilterDto, @CurrentUser() user: UserEntity) {
        return this.moviesService.getMovies(filters, user.id);
    }

    @ApiOperation({ summary: 'Get one movie by id' })
    @ApiParam({ name: 'id', description: 'Movie UUID' })
    @ApiOkResponse({ type: MovieResponseDto })
    @ApiBadRequestResponse({ description: 'Invalid movie id format (must be UUID)', type: ErrorResponseDto })
    @ApiNotFoundResponse({ description: 'Movie not found', type: ErrorResponseDto })
    @Get(':id')
    async getMovieById(@Param('id', new ParseUUIDPipe()) id: string) {
        return this.moviesService.getMovieById(id);
    }

    @UseGuards(JwtAuthGuard)
    @Post(':id/watch')
    @ApiOperation({ summary: 'Record a movie view/watch event for current user' })
    @ApiParam({ name: 'id', description: 'Movie UUID' })
    @ApiOkResponse({ type: RecordViewDto })
    @ApiBadRequestResponse({ description: 'Invalid movie id format (must be UUID)', type: ErrorResponseDto })
    @ApiNotFoundResponse({ description: 'Movie not found', type: ErrorResponseDto })
    @ApiUnauthorizedResponse({ description: 'Authentication required', type: ErrorResponseDto })
    async recordMovieView(
        @Param('id', new ParseUUIDPipe()) movieId: string,
        @CurrentUser() user: UserEntity,
    ) {
        return this.moviesService.recordView(movieId, user.id);
    }
    
    @Post('trigger-scraper')
    @ApiOperation({ summary: 'Trigger background scraper job manually' })
    @ApiOkResponse({
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Jackett scraping started in background!' },
            },
        },
    })
    async triggerScraper() {
        this.moviesCronService.fetchAndCacheJackettMovies();
        return { message: 'Jackett scraping started in background!' };
    }
}
