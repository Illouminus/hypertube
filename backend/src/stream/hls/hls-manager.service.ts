import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { TorrentService } from 'src/torrent/torrent.service';
import { PumpReaderService } from './pump-reader.service';
import { HlsJob, HlsJobConfig, HlsJobStatus, HlsJobStatusDto } from './hls-job.types';

/**
 * HLS Manager orchestrates the live transcoding pipeline.
 *
 * Responsibilities:
 * 1. Create and manage HLS jobs.
 * 2. Monitor prebuffering phase (wait for minimum data).
 * 3. Start ffmpeg with pump reader.
 * 4. Track segment generation.
 * 5. Manage cleanup and error handling.
 */
@Injectable()
export class HlsManagerService {
	private readonly logger = new Logger(HlsManagerService.name);

	/** Map of all active jobs: jobId -> HlsJob */
	private readonly jobs = new Map<string, HlsJob>();

	/** ffmpeg output directory (configure from ENV) */
	private readonly hlsOutputDir = './hls-temp';

	constructor(
		private readonly torrentService: TorrentService,
		private readonly pumpReader: PumpReaderService,
	) {
		this.ensureOutputDir();
	}

	/**
	 * Create a new HLS job for transcoding a torrent.
	 *
	 * This immediately starts monitoring the torrent for prebuffer threshold.
	 * When threshold is reached, ffmpeg is started automatically.
	 *
	 * @param torrentId       UUID of the torrent to transcode
	 * @param inputFilePath   Absolute path to the video file on disk
	 * @param totalBytes      Total size in bytes (from torrent metadata)
	 * @param config          Optional job configuration
	 * @returns               Job ID that can be used to query status
	 */
	async createHlsJob(
		torrentId: string,
		inputFilePath: string,
		totalBytes: number,
		config?: Partial<HlsJobConfig>,
	): Promise<string> {
		const jobId = `hls-${torrentId}`;

		// Check if job already exists
		if (this.jobs.has(jobId)) {
			this.logger.warn(`Job ${jobId} already exists, returning existing`);
			return jobId;
		}

		// Merge config with defaults
		const finalConfig: HlsJobConfig = {
			prebufferBytes: 32 * 1024 * 1024, // 32 MB
			segmentDuration: 3,
			playlistSize: 10,
			pollIntervalMs: 500,
			stallTimeoutSec: 30,
			videoBitrate: 'copy',
			audioCodec: 'aac',
			...config,
		};

		const job: HlsJob = {
			jobId,
			status: HlsJobStatus.PREBUFFERING,
			inputFilePath,
			outputDir: join(this.hlsOutputDir, jobId),
			ffmpegPid: null,
			segmentsGenerated: 0,
			bytesTranscoded: 0,
			totalBytes,
			createdAt: new Date(),
			lastProgressAt: new Date(),
			errorMessage: null,
			config: finalConfig,
		};

		this.jobs.set(jobId, job);

		// Start the prebuffer monitor (non-blocking)
		this.monitorPrebuffer(jobId, torrentId).catch((err) => {
			this.logger.error(`Prebuffer monitor failed for ${jobId}: ${err.message}`);
			job.status = HlsJobStatus.FAILED;
			job.errorMessage = err.message;
		});

		this.logger.log(`Created HLS job ${jobId}`);
		return jobId;
	}

	/**
	 * Get current status of a job.
	 *
	 * @param jobId Job ID returned from createHlsJob
	 * @returns     Status DTO for client consumption
	 */
	getJobStatus(jobId: string): HlsJobStatusDto | null {
		const job = this.jobs.get(jobId);
		if (!job) {
			return null;
		}

		let progress = 0;
		if (job.totalBytes) {
			progress = Math.min(job.bytesTranscoded / job.totalBytes, 1);
		}

		const estimatedRemaining =
			job.status === HlsJobStatus.TRANSCODING && job.totalBytes
				? Math.max(0, (job.totalBytes - job.bytesTranscoded) / (1024 * 1024) * 5)
				: null;

		return {
			jobId: job.jobId,
			status: job.status,
			progress,
			segmentsAvailable: job.segmentsGenerated,
			playlistUrl: job.status !== HlsJobStatus.PREBUFFERING ? `/stream/hls/${job.jobId}/playlist.m3u8` : null,
			estimatedTimeRemaining: estimatedRemaining,
			errorMessage: job.errorMessage,
		};
	}

	/**
	 * Monitor the prebuffering phase.
	 *
	 * This waits until enough data is downloaded, then starts ffmpeg.
	 */
	private async monitorPrebuffer(jobId: string, torrentId: string): Promise<void> {
		const job = this.jobs.get(jobId)!;
		const startTime = Date.now();

		while (true) {
			const downloadedBytes = await this.torrentService.getDownloadedBytes(torrentId);

			if (downloadedBytes >= job.config.prebufferBytes) {
				this.logger.log(
					`Job ${jobId}: prebuffer complete (${downloadedBytes} >= ${job.config.prebufferBytes}), starting ffmpeg`,
				);
				await this.startTranscoding(jobId, torrentId);
				break;
			}

			// Check if we've been waiting too long
			const waitedMs = Date.now() - startTime;
			if (waitedMs > 5 * 60 * 1000) {
				// 5 min timeout
				throw new Error('Prebuffering timeout: torrent download too slow');
			}

			this.logger.debug(`Job ${jobId}: waiting for prebuffer (${downloadedBytes} bytes)`);
			await this.sleep(job.config.pollIntervalMs);
		}
	}

	/**
	 * Start ffmpeg transcoding with pump reader.
	 *
	 * This is where the magic happens:
	 * 1. Create HLS output directory.
	 * 2. Create pump reader stream (ready to feed new data).
	 * 3. Start ffmpeg with pump reader connected to stdin.
	 * 4. Monitor ffmpeg process and segment generation.
	 */
	private async startTranscoding(jobId: string, torrentId: string): Promise<void> {
		const job = this.jobs.get(jobId)!;

		// Create output directory
		await mkdir(job.outputDir, { recursive: true });

		job.status = HlsJobStatus.TRANSCODING;
		job.lastProgressAt = new Date();

		// Create pump reader that will feed data to ffmpeg
		const inputStream = this.pumpReader.createGrowingFileStream(
			job.inputFilePath,
			() => this.torrentService.getDownloadedBytes(torrentId),
			job.config.pollIntervalMs,
		);

		// Build ffmpeg command
		const hlsOutput = join(job.outputDir, 'out-%d.ts');
		const ffmpegArgs = this.buildFfmpegArgs(hlsOutput, job.config);

		this.logger.log(`Job ${jobId}: starting ffmpeg with args: ${ffmpegArgs.join(' ')}`);

		// Spawn ffmpeg process
		const ffmpeg = spawn('ffmpeg', ffmpegArgs, {
			stdio: ['pipe', 'pipe', 'pipe'], // stdin, stdout, stderr
		});

		job.ffmpegPid = ffmpeg.pid ?? null;

		// Connect pump reader to ffmpeg stdin
		inputStream.pipe(ffmpeg.stdin);

		// Monitor ffmpeg output for segment generation
		ffmpeg.stderr.on('data', (data) => {
			const line = data.toString();
			this.logger.debug(`ffmpeg: ${line.trim()}`);

			// Parse segment info from ffmpeg output
			if (line.includes('Opening') && line.includes('.ts')) {
				job.segmentsGenerated++;
				job.lastProgressAt = new Date();
			}
		});

		// Handle ffmpeg errors
		ffmpeg.on('error', (err) => {
			this.logger.error(`ffmpeg error for ${jobId}: ${err.message}`);
			job.status = HlsJobStatus.FAILED;
			job.errorMessage = `ffmpeg crashed: ${err.message}`;
		});

		// Handle ffmpeg exit
		ffmpeg.on('close', (code) => {
			if (code === 0 || code === null) {
				// code=null when killed by signal (expected on normal completion)
				job.status = HlsJobStatus.COMPLETED;
				this.logger.log(`Job ${jobId}: ffmpeg completed successfully`);
			} else {
				job.status = HlsJobStatus.FAILED;
				job.errorMessage = `ffmpeg exited with code ${code}`;
				this.logger.error(`Job ${jobId}: ffmpeg exited with code ${code}`);
			}
			job.ffmpegPid = null;
		});
	}

	/**
	 * Build ffmpeg command line arguments for HLS output.
	 *
	 * Key flags:
	 * - `-i pipe:0`: read from stdin (pump reader)
	 * - `-c:v copy`: copy video codec (no re-encode, fast)
	 * - `-c:a aac`: transcode audio to AAC (browser friendly)
	 * - `-hls_time 3`: 3-second segments
	 * - `-hls_list_size 10`: keep 10 segments in playlist
	 * - `-f hls`: output format is HLS
	 */
	private buildFfmpegArgs(hlsOutput: string, config: HlsJobConfig): string[] {
		const videoCodec = config.videoBitrate === 'copy' ? 'copy' : 'libx264';
		const videoOptions = config.videoBitrate === 'copy' ? [] : ['-preset', 'veryfast'];

		return [
			'-i', 'pipe:0', // Read from stdin (pump reader)
			'-c:v', videoCodec, // Video codec
			...videoOptions,
			'-c:a', config.audioCodec, // Audio codec
			'-b:a', '128k', // Audio bitrate
			'-f', 'hls', // Output format
			'-hls_time', String(config.segmentDuration),
			'-hls_list_size', String(config.playlistSize),
			'-hls_flags', 'append_list+live', // Append to playlist, live mode
			hlsOutput, // Output pattern
		];
	}

	private async ensureOutputDir(): Promise<void> {
		try {
			await mkdir(this.hlsOutputDir, { recursive: true });
		} catch (err) {
			this.logger.warn(`Could not create HLS temp dir: ${err}`);
		}
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
