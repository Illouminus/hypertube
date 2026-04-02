import { Module } from '@nestjs/common';
import { TorrentModule } from 'src/torrent/torrent.module';
import { StreamController } from './stream.controller';
import { StreamService } from './stream.service';
import { HlsModule } from './hls/hls.module';

@Module({
	imports: [TorrentModule, HlsModule],
	controllers: [StreamController],
	providers: [StreamService],
})
export class StreamModule {}
