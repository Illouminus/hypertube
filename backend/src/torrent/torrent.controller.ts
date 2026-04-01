import { Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import {
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiOperation,
	ApiParam,
	ApiTags,
	ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { ErrorResponseDto } from 'src/common/dto/error-response.dto';
import { TorrentService } from './torrent.service';
import { TorrentStatusResponseDto } from './dto/torrent-status-response.dto';

@ApiTags('torrents')
@Controller('torrents')
@UseGuards(JwtAuthGuard)
export class TorrentController {
	constructor(private readonly torrentService: TorrentService) {}

	@Post(':id/download')
	@ApiOperation({ summary: 'Start downloading a torrent via Transmission' })
	@ApiParam({ name: 'id', description: 'Torrent UUID' })
	@ApiOkResponse({ type: TorrentStatusResponseDto })
	@ApiNotFoundResponse({ description: 'Torrent not found', type: ErrorResponseDto })
	@ApiUnauthorizedResponse({ description: 'Authentication required', type: ErrorResponseDto })
	async startDownload(@Param('id', new ParseUUIDPipe()) id: string) {
		return this.torrentService.startDownload(id);
	}

	@Get(':id/status')
	@ApiOperation({ summary: 'Get torrent download status' })
	@ApiParam({ name: 'id', description: 'Torrent UUID' })
	@ApiOkResponse({ type: TorrentStatusResponseDto })
	@ApiNotFoundResponse({ description: 'Torrent not found', type: ErrorResponseDto })
	@ApiUnauthorizedResponse({ description: 'Authentication required', type: ErrorResponseDto })
	async getStatus(@Param('id', new ParseUUIDPipe()) id: string) {
		return this.torrentService.getStatus(id);
	}
}
