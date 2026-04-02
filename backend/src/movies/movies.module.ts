import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MoviesController } from './movies.controller';
import { MoviesService } from './movies.service';
import { MoviesCronService } from './movies-cron/movies-cron.service';
import { CommentsModule } from 'src/comments/comments.module';
import { SubtitlesModule } from 'src/subtitles/subtitles.module';
import { TorrentModule } from 'src/torrent/torrent.module';

@Module({
  imports: [HttpModule, CommentsModule, SubtitlesModule, TorrentModule],
  controllers: [MoviesController],
  providers: [MoviesService, MoviesCronService]
})
export class MoviesModule {}
