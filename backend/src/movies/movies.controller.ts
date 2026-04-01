import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { MoviesCronService } from './movies-cron/movies-cron.service';
import { MoviesService } from './movies.service';
import { GetMoviesFilterDto } from './dto/get-movies-filter.dto';
import { MovieResponseDto, MoviesListResponseDto } from './dto/movie-response.dto';
import {
    ApiBadRequestResponse,
    ApiBody,
    ApiForbiddenResponse,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiTags,
    ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from 'src/common/dto/error-response.dto';
import { RecordViewDto } from './dto/record-view.dto';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { UserEntity } from 'src/users/entities/user.entity';
import { CommentsService } from 'src/comments/comments.service';
import { CommentResponseDto } from 'src/comments/dto/comment-response.dto';
import { CreateMovieCommentDto } from 'src/comments/dto/create-movie-comment.dto';

@ApiTags('movies')
@Controller('movies')
export class MoviesController {

    constructor(
        private readonly moviesService: MoviesService,
        private readonly moviesCronService: MoviesCronService,
        private readonly commentsService: CommentsService,
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
    @Get(':id/comments')
    @ApiOperation({ summary: 'Get comments for one movie' })
    @ApiParam({ name: 'id', description: 'Movie UUID' })
    @ApiOkResponse({ type: [CommentResponseDto] })
    @ApiBadRequestResponse({ description: 'Invalid movie id format (must be UUID)', type: ErrorResponseDto })
    @ApiUnauthorizedResponse({ description: 'Authentication required', type: ErrorResponseDto })
    async getMovieComments(@Param('id', new ParseUUIDPipe()) movieId: string) {
        return this.commentsService.getMovieComments(movieId);
    }

    @UseGuards(JwtAuthGuard)
    @Post(':id/comments')
    @ApiOperation({ summary: 'Create comment for one movie' })
    @ApiParam({ name: 'id', description: 'Movie UUID' })
    @ApiBody({ type: CreateMovieCommentDto })
    @ApiOkResponse({ type: CommentResponseDto })
    @ApiBadRequestResponse({ description: 'Invalid movie id format or payload', type: ErrorResponseDto })
    @ApiNotFoundResponse({ description: 'Movie not found', type: ErrorResponseDto })
    @ApiForbiddenResponse({ description: 'Comment action forbidden', type: ErrorResponseDto })
    @ApiUnauthorizedResponse({ description: 'Authentication required', type: ErrorResponseDto })
    async createMovieComment(
        @Param('id', new ParseUUIDPipe()) movieId: string,
        @Body() dto: CreateMovieCommentDto,
        @CurrentUser() user: UserEntity,
    ) {
        return this.commentsService.createCommentForMovie(movieId, dto, user.id);
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

    @UseGuards(JwtAuthGuard)
    @Post('cleanup-library')
    @ApiOperation({ summary: 'Trigger stale library cleanup manually' })
    @ApiOkResponse({
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Library cleanup finished successfully.' },
                stats: {
                    type: 'object',
                    properties: {
                        moviesFound: { type: 'number', example: 12 },
                        moviesDeleted: { type: 'number', example: 12 },
                        mediaDeleteAttempts: { type: 'number', example: 36 },
                        mediaDeleteSucceeded: { type: 'number', example: 35 },
                        mediaDeleteFailed: { type: 'number', example: 1 },
                    },
                },
            },
        },
    })
    @ApiUnauthorizedResponse({ description: 'Authentication required', type: ErrorResponseDto })
    async cleanupLibrary() {
        const stats = await this.moviesCronService.cleanupStaleLibrary();
        return {
            message: 'Library cleanup finished successfully.',
            stats,
        };
    }
}
