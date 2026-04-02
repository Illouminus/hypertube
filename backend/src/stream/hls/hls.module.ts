import { Module } from '@nestjs/common';
import { TorrentModule } from 'src/torrent/torrent.module';
import { HlsManagerService } from './hls-manager.service';
import { HlsSegmentService } from './hls-segment.service';
import { PumpReaderService } from './pump-reader.service';
import { HlsController } from './hls.controller';

@Module({
	imports: [TorrentModule],
	controllers: [HlsController],
	providers: [HlsManagerService, HlsSegmentService, PumpReaderService],
	exports: [HlsManagerService, HlsSegmentService, PumpReaderService],
})
export class HlsModule {}
