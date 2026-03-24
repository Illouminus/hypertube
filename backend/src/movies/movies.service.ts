import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { GetMoviesFilterDto } from './dto/get-movies-filter.dto';
import { MovieResponseDto, MoviesListResponseDto } from './dto/movie-response.dto';

@Injectable()
export class MoviesService {
	constructor(private readonly prisma: PrismaService) {}

	async getMovies(filters: GetMoviesFilterDto) {
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

		const sortBy = filters.sortBy ?? 'rating';
		const sortOrder: Prisma.SortOrder = filters.sortOrder ?? 'desc';
		const orderBy: Prisma.MovieOrderByWithRelationInput = { [sortBy]: sortOrder };

		const [data, total] = await this.prisma.$transaction([
			this.prisma.movie.findMany({
				where,
				orderBy,
				skip,
				take: limit,
				include: {
					torrents: true,
				},
			}),
			this.prisma.movie.count({ where }),
		]);

		return new MoviesListResponseDto({ data, total, page, limit });
	}

	async getMovieById(id: string) {
		const movie = await this.prisma.movie.findUnique({
			where: { id },
			include: { torrents: true },
		});

		if (!movie) {
			throw new NotFoundException(`Movie with id ${id} not found`);
		}

		return new MovieResponseDto(movie);
	}
}
