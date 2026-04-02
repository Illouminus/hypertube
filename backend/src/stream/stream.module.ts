import { Module } from '@nestjs/common';
import { TorrentModule } from 'src/torrent/torrent.module';
import { StreamController } from './stream.controller';
import { StreamService } from './stream.service';

@Module({
	imports: [TorrentModule],
	controllers: [StreamController],
	providers: [StreamService],
})
export class StreamModule {}
