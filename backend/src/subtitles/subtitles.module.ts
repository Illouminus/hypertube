import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SubtitlesService } from './subtitles.service';

@Module({
  imports: [HttpModule],
  providers: [SubtitlesService],
  exports: [SubtitlesService],
})
export class SubtitlesModule {}
