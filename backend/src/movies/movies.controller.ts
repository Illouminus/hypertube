import { Controller, Post } from '@nestjs/common';
import { MoviesCronService } from './movies-cron/movies-cron.service';
import { MoviesService } from './movies.service';

@Controller('movies')
export class MoviesController {

    constructor(
        private readonly moviesService: MoviesService,
        private readonly moviesCronService: MoviesCronService,
    ) {}
    
    @Post('trigger-scraper')
    async triggerScraper() {
        this.moviesCronService.fetchAndCacheJackettMovies();
        return { message: 'Jackett scraping started in background!' };
    }
}
