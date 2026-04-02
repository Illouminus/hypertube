import { Injectable, Logger } from '@nestjs/common';
import { TorrentService } from 'src/torrent/torrent.service';
import { TorrentDownloadStatus } from 'src/torrent/dto/torrent-status-response.dto';
import { stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname } from 'node:path';
import { spawn } from 'node:child_process';
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

@Injectable()
export class StreamService {
	private readonly logger = new Logger(StreamService.name);

	constructor(private readonly torrentService: TorrentService) {}

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

		// Step 4: serve — either transcode (MKV/AVI) or direct Range-based streaming
		const ext = extname(filePath).toLowerCase();

		if (NEEDS_TRANSCODE.has(ext)) {
			if (!isComplete) {
				res.status(202).json({
					message: 'MKV transcoding requires full download, please wait',
					progress: status.progress,
				});
				return;
			}
			this.serveTranscoded(res, filePath);
			return;
		}

		const contentType = MIME_BY_EXT[ext] ?? 'video/mp4';
		const range = this.parseRange(req.headers.range, availableBytes);

		if (range) {
			this.servePartialContent(res, filePath, range, availableBytes, contentType);
		} else {
			this.serveFullContent(res, filePath, availableBytes, contentType);
		}
	}

	/**
	 * Repackage a non-browser-native file (MKV, AVI, etc.) into fragmented MP4 on the fly.
	 *
	 * Uses ffmpeg with `-c:v copy` (no video re-encoding, fast) and `-c:a aac`
	 * (audio re-encode only if needed). The `-movflags frag_keyframe+empty_moov`
	 * flag produces a fragmented MP4 that can be streamed without seeking to the end.
	 *
	 * Range requests are not supported for transcoded streams because the output
	 * size is unknown. The browser will buffer progressively instead.
	 */
	private serveTranscoded(res: Response, filePath: string): void {
		const ffmpegArgs = [
			'-i', filePath,
			'-c:v', 'copy',
			'-c:a', 'aac',
			'-f', 'mp4',
			'-movflags', 'frag_keyframe+empty_moov',
			'pipe:1',
		];

		const ffmpeg = spawn('ffmpeg', ffmpegArgs);

		res.writeHead(200, {
			'Content-Type': 'video/mp4',
		});

		ffmpeg.stdout.pipe(res);

		ffmpeg.stderr.on('data', (data: Buffer) => {
			this.logger.debug(`ffmpeg: ${data.toString().trim()}`);
		});

		ffmpeg.on('error', (err) => {
			this.logger.error(`ffmpeg spawn error: ${err.message}`);
			if (!res.headersSent) {
				res.status(500).json({ message: 'Transcoding failed' });
			}
		});

		ffmpeg.on('close', (code) => {
			if (code && code !== 0) {
				this.logger.error(`ffmpeg exited with code ${code}`);
				res.destroy();
			}
		});

		// Clean up ffmpeg if the client disconnects mid-stream
		res.on('close', () => {
			if (!ffmpeg.killed) {
				ffmpeg.kill('SIGTERM');
			}
		});
	}

	/**
	 * Parse the HTTP Range header into start/end byte positions.
	 *
	 * Supports the standard format: `bytes=START-END` or `bytes=START-`.
	 * Returns null when no Range header is present (full download requested).
	 */
	private parseRange(header: string | undefined, totalBytes: number): ParsedRange | null {
		if (!header?.startsWith('bytes=')) {
			return null;
		}

		const parts = header.replace('bytes=', '').split('-');
		const start = parseInt(parts[0], 10);
		const end = parts[1] ? parseInt(parts[1], 10) : totalBytes - 1;

		if (isNaN(start) || start < 0 || start >= totalBytes) {
			return null;
		}

		return { start, end: Math.min(end, totalBytes - 1) };
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
