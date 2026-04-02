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

/**
 * REST endpoints for managing torrent downloads.
 *
 * These endpoints allow the frontend to trigger a download and then
 * poll its progress. The actual BitTorrent work is delegated to
 * Transmission daemon via {@link TorrentService}.
 */
@ApiTags('torrents')
@Controller('torrents')
@UseGuards(JwtAuthGuard)
export class TorrentController {
	constructor(private readonly torrentService: TorrentService) {}

	/**
	 * Send a torrent's magnet link to Transmission and begin downloading.
	 *
	 * Idempotent — calling this on a torrent that is already downloading
	 * or completed simply returns its current status without side effects.
	 */
	@Post(':id/download')
	@ApiOperation({ summary: 'Start downloading a torrent via Transmission' })
	@ApiParam({ name: 'id', description: 'Torrent UUID' })
	@ApiOkResponse({ type: TorrentStatusResponseDto })
	@ApiNotFoundResponse({ description: 'Torrent not found', type: ErrorResponseDto })
	@ApiUnauthorizedResponse({ description: 'Authentication required', type: ErrorResponseDto })
	async startDownload(@Param('id', new ParseUUIDPipe()) id: string) {
		return this.torrentService.startDownload(id);
	}

	/**
	 * Poll current download progress for a torrent.
	 *
	 * The frontend should call this periodically (e.g. every 2s) while
	 * a torrent is downloading to update the progress indicator.
	 */
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
