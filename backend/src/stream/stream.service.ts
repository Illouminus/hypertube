import { Injectable, Logger } from '@nestjs/common';
import { TorrentService } from 'src/torrent/torrent.service';
import { TorrentDownloadStatus } from 'src/torrent/dto/torrent-status-response.dto';
import { HlsManagerService } from './hls/hls-manager.service';
import { stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname } from 'node:path';
import type { Request, Response } from 'express';

/** MIME types for video containers that browsers can play natively */
const MIME_BY_EXT: Record<string, string> = {
	'.mp4': 'video/mp4',
	'.webm': 'video/webm',
};

/** Extensions that require transcoding (container repacking) to MP4 for browser playback */
const NEEDS_TRANSCODE = new Set(['.mkv', '.avi', '.mov']);

/** Result of parsing the HTTP Range header */
type ParsedRange = { start: number; end: number };
type RangeParseResult =
	| { kind: 'none' }
	| { kind: 'invalid' }
	| { kind: 'valid'; range: ParsedRange };

@Injectable()
export class StreamService {
	private readonly logger = new Logger(StreamService.name);

	constructor(
		private readonly torrentService: TorrentService,
		private readonly hlsManager: HlsManagerService,
	) {}

	/**
	 * Stream a torrent's video file to the client via HTTP Range Requests.
	 *
	 * Flow:
	 * 1. Ensure the torrent download is started (idempotent).
	 * 2. Resolve the video file path on disk.
	 * 3. Determine how many bytes are available (full file or partial download).
	 * 4. Parse the Range header and serve the requested byte range.
	 *
	 * If the file isn't available yet (torrent just started), returns 202 Accepted
	 * so the frontend knows to retry after a short delay.
	 */
	async streamVideo(torrentId: string, req: Request, res: Response): Promise<void> {
		// Step 1: ensure download is running
		const status = await this.torrentService.startDownload(torrentId);

		// Step 2: resolve file path
		const filePath = await this.torrentService.getVideoFilePath(torrentId);
		if (!filePath) {
			res.status(202).json({
				message: 'Download starting, retry in a few seconds',
				status: status.status,
				progress: status.progress,
			});
			return;
		}

		// Step 3: determine available size
		const fileSize = await this.getFileSize(filePath);
		if (fileSize === 0) {
			res.status(202).json({
				message: 'File not ready yet, retry in a few seconds',
				status: status.status,
				progress: status.progress,
			});
			return;
		}

		const isComplete = status.status === TorrentDownloadStatus.COMPLETED;
		const availableBytes = isComplete ? fileSize : Math.min(fileSize, status.downloadedBytes);

		if (availableBytes === 0) {
			res.status(202).json({ message: 'Buffering, retry shortly', progress: status.progress });
			return;
		}

		// Step 4: serve — either start HLS (MKV/AVI) or direct Range-based streaming
		const ext = extname(filePath).toLowerCase();

		if (NEEDS_TRANSCODE.has(ext)) {
			// Use totalSize from torrent metadata (not fileSize which may be partial)
			const totalBytes = status.totalSize ?? fileSize;
			await this.serveHls(torrentId, filePath, totalBytes, res);
			return;
		}

		const contentType = MIME_BY_EXT[ext] ?? 'video/mp4';
		const rangeParseResult = this.parseRange(req.headers.range, availableBytes);

		if (rangeParseResult.kind === 'invalid') {
			this.serveInvalidRange(res, availableBytes);
			return;
		}

		if (rangeParseResult.kind === 'valid') {
			this.servePartialContent(res, filePath, rangeParseResult.range, availableBytes, contentType);
			return;
		}

		this.serveFullContent(res, filePath, availableBytes, contentType);
	}

	/**
	 * Start HLS live transcoding pipeline for incompatible formats.
	 *
	 * Instead of waiting for the entire file to download, we:
	 * 1. Create an HLS job that manages transcoding.
	 * 2. Return jobId + playlist URL to the client.
	 * 3. Client polls playlist.m3u8 which gets updated as segments are generated.
	 *
	 * This allows playback to start while download is still in progress.
	 */
	private async serveHls(torrentId: string, filePath: string, fileSize: number, res: Response): Promise<void> {
		try {
			const jobId = await this.hlsManager.createHlsJob(torrentId, filePath, fileSize);

			res.status(200).json({
				streamType: 'hls',
				jobId,
				playlistUrl: `/stream/hls/${jobId}/playlist.m3u8`,
				message: 'HLS transcoding started, playlist available at playlistUrl',
			});
		} catch (error) {
			this.logger.error(`Failed to start HLS job: ${error}`);
			res.status(500).json({
				message: 'Failed to start HLS transcoding',
				error: error instanceof Error ? error.message : 'Unknown error',
			});
		}
	}

	/**
	 * Parse the HTTP Range header into start/end byte positions.
	 *
	 * Supports the standard format: `bytes=START-END` or `bytes=START-`.
	 * Returns null when no Range header is present (full download requested).
	 */
	private parseRange(header: string | undefined, totalBytes: number): RangeParseResult {
		if (!header) {
			return { kind: 'none' };
		}

		if (!header.startsWith('bytes=')) {
			return { kind: 'invalid' };
		}

		const [rawStart, rawEnd] = header.replace('bytes=', '').split('-');

		if (!rawStart && !rawEnd) {
			return { kind: 'invalid' };
		}

		if (!rawStart && rawEnd) {
			const suffixLength = parseInt(rawEnd, 10);
			if (Number.isNaN(suffixLength) || suffixLength <= 0) {
				return { kind: 'invalid' };
			}

			const start = Math.max(totalBytes - suffixLength, 0);
			return { kind: 'valid', range: { start, end: totalBytes - 1 } };
		}

		const start = parseInt(rawStart, 10);
		const end = rawEnd ? parseInt(rawEnd, 10) : totalBytes - 1;

		if (Number.isNaN(start) || Number.isNaN(end)) {
			return { kind: 'invalid' };
		}

		if (start < 0 || start >= totalBytes) {
			return { kind: 'invalid' };
		}

		const normalizedEnd = Math.min(end, totalBytes - 1);
		if (normalizedEnd < start) {
			return { kind: 'invalid' };
		}

		return { kind: 'valid', range: { start, end: normalizedEnd } };
	}

	/** Respond with 416 when requested range can't be satisfied by available bytes */
	private serveInvalidRange(res: Response, totalBytes: number): void {
		res.writeHead(416, {
			'Accept-Ranges': 'bytes',
			'Content-Range': `bytes */${totalBytes}`,
		});
		res.end();
	}

	/** Respond with 206 Partial Content — standard for `<video>` tag streaming */
	private servePartialContent(
		res: Response,
		filePath: string,
		range: ParsedRange,
		totalBytes: number,
		contentType: string,
	): void {
		const chunkSize = range.end - range.start + 1;

		res.writeHead(206, {
			'Content-Range': `bytes ${range.start}-${range.end}/${totalBytes}`,
			'Accept-Ranges': 'bytes',
			'Content-Length': chunkSize,
			'Content-Type': contentType,
		});

		const stream = createReadStream(filePath, { start: range.start, end: range.end });
		stream.on('error', (err) => {
			this.logger.error(`Read stream error: ${err.message}`);
			if (!res.headersSent) res.status(500).end();
			else res.destroy();
		});
		stream.pipe(res);
	}

	/** Respond with 200 and full content — fallback when no Range header is sent */
	private serveFullContent(
		res: Response,
		filePath: string,
		totalBytes: number,
		contentType: string,
	): void {
		res.writeHead(200, {
			'Accept-Ranges': 'bytes',
			'Content-Length': totalBytes,
			'Content-Type': contentType,
		});

		const stream = createReadStream(filePath, { end: totalBytes - 1 });
		stream.on('error', (err) => {
			this.logger.error(`Read stream error: ${err.message}`);
			if (!res.headersSent) res.status(500).end();
			else res.destroy();
		});
		stream.pipe(res);
	}

	/** Get file size on disk, returning 0 if file doesn't exist yet */
	private async getFileSize(filePath: string): Promise<number> {
		try {
			const info = await stat(filePath);
			return info.size;
		} catch {
			return 0;
		}
	}
}
