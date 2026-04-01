import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Res, StreamableFile, UseGuards } from '@nestjs/common';
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
import { GetCommentsQueryDto } from 'src/comments/dto/get-comments-query.dto';
import { CommentsListResponseDto } from 'src/comments/dto/comments-list-response.dto';
import { SubtitlesService } from 'src/subtitles/subtitles.service';
import { SubtitleResponseDto } from 'src/subtitles/dto/subtitle-response.dto';
import { createReadStream } from 'node:fs';
import type { Response } from 'express';

@ApiTags('movies')
@Controller('movies')
export class MoviesController {

    constructor(
        private readonly moviesService: MoviesService,
        private readonly moviesCronService: MoviesCronService,
        private readonly commentsService: CommentsService,
        private readonly subtitlesService: SubtitlesService,
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
    @ApiUnauthorizedResponse({ description: 'Authentication required', type: ErrorResponseDto })
    @UseGuards(JwtAuthGuard)
    @Get(':id')
    async getMovieById(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: UserEntity) {
        return this.moviesService.getMovieById(id, user.preferredLanguage);
    }

    @UseGuards(JwtAuthGuard)
    @Get(':id/subtitles')
    @ApiOperation({ summary: 'Get subtitles for one movie' })
    @ApiParam({ name: 'id', description: 'Movie UUID' })
    @ApiOkResponse({ type: [SubtitleResponseDto] })
    @ApiBadRequestResponse({ description: 'Invalid movie id format (must be UUID)', type: ErrorResponseDto })
    @ApiUnauthorizedResponse({ description: 'Authentication required', type: ErrorResponseDto })
    async getMovieSubtitles(
        @Param('id', new ParseUUIDPipe()) movieId: string,
        @CurrentUser() user: UserEntity,
    ) {
        await this.subtitlesService.ensureSubtitlesForMovie(movieId, user.preferredLanguage);
        return this.subtitlesService.listSubtitles(movieId, user.preferredLanguage);
    }

    @UseGuards(JwtAuthGuard)
    @Post(':id/subtitles/refresh')
    @ApiOperation({ summary: 'Force refresh subtitle download for one movie' })
    @ApiParam({ name: 'id', description: 'Movie UUID' })
    @ApiOkResponse({
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Subtitle refresh has been started.' },
            },
        },
    })
    @ApiBadRequestResponse({ description: 'Invalid movie id format (must be UUID)', type: ErrorResponseDto })
    @ApiUnauthorizedResponse({ description: 'Authentication required', type: ErrorResponseDto })
    async refreshMovieSubtitles(
        @Param('id', new ParseUUIDPipe()) movieId: string,
        @CurrentUser() user: UserEntity,
    ) {
        await this.subtitlesService.ensureSubtitlesForMovie(movieId, user.preferredLanguage, true);
        return { success: true, message: 'Subtitle refresh has been started.' };
    }

    @UseGuards(JwtAuthGuard)
    @Get(':id/subtitles/:subtitleId/file')
    @ApiOperation({ summary: 'Get subtitle file content (VTT)' })
    @ApiParam({ name: 'id', description: 'Movie UUID' })
    @ApiParam({ name: 'subtitleId', description: 'Subtitle UUID' })
    @ApiBadRequestResponse({ description: 'Invalid id format', type: ErrorResponseDto })
    @ApiNotFoundResponse({ description: 'Subtitle file not found', type: ErrorResponseDto })
    @ApiUnauthorizedResponse({ description: 'Authentication required', type: ErrorResponseDto })
    async getSubtitleFile(
        @Param('id', new ParseUUIDPipe()) movieId: string,
        @Param('subtitleId', new ParseUUIDPipe()) subtitleId: string,
        @Res({ passthrough: true }) res: Response,
    ) {
        const filePath = await this.subtitlesService.getSubtitleFilePath(movieId, subtitleId);
        res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return new StreamableFile(createReadStream(filePath));
    }

    @UseGuards(JwtAuthGuard)
    @Get(':id/comments')
    @ApiOperation({ summary: 'Get comments for one movie' })
    @ApiParam({ name: 'id', description: 'Movie UUID' })
    @ApiOkResponse({ type: CommentsListResponseDto })
    @ApiBadRequestResponse({ description: 'Invalid movie id format (must be UUID)', type: ErrorResponseDto })
    @ApiUnauthorizedResponse({ description: 'Authentication required', type: ErrorResponseDto })
    async getMovieComments(
        @Param('id', new ParseUUIDPipe()) movieId: string,
        @Query() query: GetCommentsQueryDto,
    ) {
        return this.commentsService.getMovieComments(movieId, query);
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
