import { Injectable, Logger } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';

/**
 * Pump Reader: reads a growing file and outputs its contents as a stream.
 *
 * This is the key component that allows ffmpeg to start transcoding
 * before the download completes.
 *
 * How it works:
 * 1. Poll the file for new bytes every N ms.
 * 2. When new bytes are available, read them.
 * 3. Push those bytes to a PassThrough stream.
 * 4. ffmpeg reads from this stream without knowing it's incomplete.
 *
 * The trick: we never close the stream until download is complete.
 * This way ffmpeg thinks it's reading a regular pipe that just happens
 * to deliver data slowly.
 */
@Injectable()
export class PumpReaderService {
	private readonly logger = new Logger(PumpReaderService.name);

	/**
	 * Create a readable stream that "pumps" data from a growing file.
	 *
	 * @param filePath          Path to the file being downloaded
	 * @param getDownloadedBytes Callback to get current downloaded byte count
	 * @param pollIntervalMs    How often to check for new data (default 500ms)
	 * @returns                 Readable stream that ffmpeg can consume
	 */
	createGrowingFileStream(
		filePath: string,
		getDownloadedBytes: () => Promise<number>,
		pollIntervalMs: number = 500,
	): Readable {
		/**
		 * PassThrough is a special stream that just passes data through.
		 * We push data to it manually, and consumers read from it.
		 */
		const { PassThrough } = require('node:stream');
		const outputStream = new PassThrough();

		// Start the pump loop in background (non-blocking)
		this.pumpFile(filePath, outputStream, getDownloadedBytes, pollIntervalMs).catch((err) => {
			this.logger.error(`Pump reader error: ${err.message}`);
			outputStream.destroy(err);
		});

		return outputStream;
	}

	/**
	 * Core pump loop: reads file in chunks as it grows.
	 *
	 * Algorithm:
	 * 1. Read current state: file size on disk.
	 * 2. Calculate how many new bytes are available since last read.
	 * 3. If new bytes: read them and push to stream.
	 * 4. If no new bytes but still downloading: wait and check again.
	 * 5. If download complete (no new bytes after timeout): close stream.
	 *
	 * This ensures we're always feeding ffmpeg the latest data without gaps.
	 */
	private async pumpFile(
		filePath: string,
		outputStream: any,
		getDownloadedBytes: () => Promise<number>,
		pollIntervalMs: number,
	): Promise<void> {
		let offset = 0;
		let lastActivityTime = Date.now();
		const stallTimeoutMs = 30_000; // 30 seconds

		while (true) {
			try {
				const downloadedBytes = await getDownloadedBytes();

				if (downloadedBytes > offset) {
					// New data available! Read and pump it.
					const chunkSize = 1024 * 256; // 256 KB chunks
					const toRead = Math.min(chunkSize, downloadedBytes - offset);

					const chunk = await this.readFileChunk(filePath, offset, toRead);
					outputStream.push(chunk);

					offset += chunk.length;
					lastActivityTime = Date.now();

					this.logger.debug(
						`Pump: read bytes ${offset - chunk.length}-${offset} (total downloaded: ${downloadedBytes})`,
					);
				} else {
					// No new data yet. Check if we've been idle too long.
					const stallDuration = Date.now() - lastActivityTime;
					if (stallDuration > stallTimeoutMs) {
						this.logger.warn(`Pump: download stalled for ${stallDuration}ms, assuming complete`);
						outputStream.push(null); // Signal end of stream
						break;
					}

					// Still downloading, wait and try again
					await this.sleep(pollIntervalMs);
				}
			} catch (error) {
				this.logger.error(`Pump: fatal error during pump loop: ${error}`);
				outputStream.destroy(error);
				break;
			}
		}
	}

	/**
	 * Read a specific chunk from a file.
	 *
	 * This is safe to call on a partially-downloaded file
	 * (as long as the byte range is within downloaded bounds).
	 */
	private async readFileChunk(filePath: string, offset: number, length: number): Promise<Buffer> {
		return new Promise((resolve, reject) => {
			const stream = createReadStream(filePath, {
				start: offset,
				end: offset + length - 1,
			});

			const chunks: (Buffer | string)[] = [];
			stream.on('data', (chunk) => chunks.push(chunk));
			stream.on('end', () => resolve(Buffer.concat(chunks.map((c) => (typeof c === 'string' ? Buffer.from(c) : c)))));
			stream.on('error', reject);
		});
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
