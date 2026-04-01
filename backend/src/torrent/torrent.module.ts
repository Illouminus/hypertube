import { Module } from '@nestjs/common';
import { TransmissionRpcClient } from './transmission-rpc.client';
import { TorrentService } from './torrent.service';
import { TorrentController } from './torrent.controller';

@Module({
	controllers: [TorrentController],
	providers: [TransmissionRpcClient, TorrentService],
	exports: [TorrentService],
})
export class TorrentModule {}
