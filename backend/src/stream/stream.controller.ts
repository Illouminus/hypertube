import { Controller, Get, Param, ParseUUIDPipe, Req, Res, UseGuards } from '@nestjs/common';
import {
	ApiNotFoundResponse,
	ApiOperation,
	ApiParam,
	ApiTags,
	ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { ErrorResponseDto } from 'src/common/dto/error-response.dto';
import { StreamService } from './stream.service';
import type { Request, Response } from 'express';

/**
 * Endpoint for streaming video content to the browser's `<video>` player.
 *
 * The browser sends standard HTTP Range requests; we respond with 206 Partial Content.
 * If the torrent isn't downloaded enough yet, we return 202 Accepted as a retry hint.
 */
@ApiTags('stream')
@Controller('stream')
@UseGuards(JwtAuthGuard)
export class StreamController {
	constructor(private readonly streamService: StreamService) {}

	@Get(':torrentId')
	@ApiOperation({ summary: 'Stream video for a torrent (supports HTTP Range)' })
	@ApiParam({ name: 'torrentId', description: 'Torrent UUID' })
	@ApiNotFoundResponse({ description: 'Torrent not found', type: ErrorResponseDto })
	@ApiUnauthorizedResponse({ description: 'Authentication required', type: ErrorResponseDto })
	async stream(
		@Param('torrentId', new ParseUUIDPipe()) torrentId: string,
		@Req() req: Request,
		@Res() res: Response,
	) {
		return this.streamService.streamVideo(torrentId, req, res);
	}
}
