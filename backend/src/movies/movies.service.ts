import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { GetMoviesFilterDto } from './dto/get-movies-filter.dto';
import { MovieResponseDto, MoviesListResponseDto } from './dto/movie-response.dto';
import { MoviesSortBy, SortOrder } from './dto/movies-sort.enum';
import { RecordViewDto } from './dto/record-view.dto';
import { SubtitlesService } from 'src/subtitles/subtitles.service';

@Injectable()
export class MoviesService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly subtitlesService: SubtitlesService,
	) {}

	async getMovies(filters: GetMoviesFilterDto, userId: string) {
		if (
			filters.yearMin !== undefined &&
			filters.yearMax !== undefined &&
			filters.yearMin > filters.yearMax
		) {
			throw new BadRequestException('yearMin must be less than or equal to yearMax');
		}

		const page = filters.page ?? 1;
		const limit = filters.limit ?? 20;
		const skip = (page - 1) * limit;

		const where: Prisma.MovieWhereInput = {};

		if (filters.search) {
			where.OR = [
				{ title: { contains: filters.search, mode: 'insensitive' } },
				{ summary: { contains: filters.search, mode: 'insensitive' } },
			];
		}

		if (filters.genre) {
			where.genres = { has: filters.genre };
		}

		if (filters.yearMin !== undefined || filters.yearMax !== undefined) {
			where.year = {
				gte: filters.yearMin,
				lte: filters.yearMax,
			};
		}

		if (filters.ratingMin !== undefined) {
			where.rating = { gte: filters.ratingMin };
		}

		const sortBy = filters.sortBy ?? MoviesSortBy.RATING;
		const sortOrder: Prisma.SortOrder = (filters.sortOrder ?? SortOrder.DESC) as Prisma.SortOrder;
		const orderBy: Prisma.MovieOrderByWithRelationInput | Prisma.MovieOrderByWithRelationInput[] =
			filters.sortBy || filters.search
				? { [sortBy]: sortOrder }
				: [{ torrents: { _count: 'desc' } }, { rating: 'desc' }];

		const [data, total] = await this.prisma.$transaction([
			this.prisma.movie.findMany({
				where,
				orderBy,
				skip,
				take: limit,
				include: {
					torrents: true,
					movieViews: {
						where: { userId },
						select: { id: true },
					},
				},
			}),
			this.prisma.movie.count({ where }),
		]);

		return new MoviesListResponseDto({ data, total, page, limit });
	}

	async getMovieById(id: string) {
		await this.subtitlesService.ensureSubtitlesForMovie(id);

		const movie = await this.prisma.movie.findUnique({
			where: { id },
			include: {
				torrents: true,
				subtitles: {
					orderBy: { languageCode: 'asc' },
				},
				comments: {
					orderBy: { createdAt: 'desc' },
					include: {
						user: {
							select: {
								id: true,
								username: true,
								firstName: true,
								lastName: true,
								profilePictureUrl: true,
							},
						},
					},
				},
			},
		});

		if (!movie) {
			throw new NotFoundException(`Movie with id ${id} not found`);
		}

		return new MovieResponseDto(movie);
	}

	async recordView(movieId: string, userId: string) {
		// Verify movie exists
		const movie = await this.prisma.movie.findUnique({
			where: { id: movieId },
		});

		if (!movie) {
			throw new NotFoundException(`Movie with id ${movieId} not found`);
		}

		// Upsert movie view record and update movie's lastViewedAt
		const [movieView] = await this.prisma.$transaction([
			this.prisma.movieView.upsert({
				where: { userId_movieId: { userId, movieId } },
				update: { viewedAt: new Date() },
				create: { userId, movieId, viewedAt: new Date() },
			}),
			this.prisma.movie.update({
				where: { id: movieId },
				data: { lastViewedAt: new Date() },
			}),
		]);

		return new RecordViewDto(movieView);
	}
}
