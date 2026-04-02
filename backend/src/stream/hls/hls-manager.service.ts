import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { spawn, ChildProcess } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
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
export class HlsManagerService implements OnModuleDestroy {
	private readonly logger = new Logger(HlsManagerService.name);

	/** Map of all active jobs: jobId -> HlsJob */
	private readonly jobs = new Map<string, HlsJob>();

	/** Active ffmpeg processes for cleanup on shutdown */
	private readonly ffmpegProcesses = new Map<string, ChildProcess>();

	/** ffmpeg output directory (configure from ENV) */
	private readonly hlsOutputDir = './hls-temp';

	constructor(
		private readonly torrentService: TorrentService,
		private readonly pumpReader: PumpReaderService,
	) {
		this.ensureOutputDir();
	}

	async onModuleDestroy(): Promise<void> {
		for (const jobId of this.jobs.keys()) {
			await this.cleanupJob(jobId);
		}
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
			playlistSize: 0, // 0 = keep all segments (VOD-style, allows seeking)
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
		if (job.totalBytes && job.totalBytes > 0) {
			progress = Math.min(job.bytesTranscoded / job.totalBytes, 1);
		}

		return {
			jobId: job.jobId,
			status: job.status,
			progress,
			segmentsAvailable: job.segmentsGenerated,
			playlistUrl: job.status !== HlsJobStatus.PREBUFFERING ? `/stream/hls/${job.jobId}/playlist.m3u8` : null,
			estimatedTimeRemaining: null,
			errorMessage: job.errorMessage,
		};
	}

	/**
	 * Check if a job is completed (used by segment service to add ENDLIST).
	 */
	isJobCompleted(jobId: string): boolean {
		const job = this.jobs.get(jobId);
		return job?.status === HlsJobStatus.COMPLETED;
	}

	/**
	 * Clean up a job: kill ffmpeg, delete segments from disk, remove from map.
	 */
	async cleanupJob(jobId: string): Promise<void> {
		const ffmpeg = this.ffmpegProcesses.get(jobId);
		if (ffmpeg && !ffmpeg.killed) {
			ffmpeg.kill('SIGTERM');
		}
		this.ffmpegProcesses.delete(jobId);

		const job = this.jobs.get(jobId);
		if (job) {
			try {
				await rm(job.outputDir, { recursive: true, force: true });
			} catch (err) {
				this.logger.warn(`Failed to clean up HLS dir for ${jobId}: ${err}`);
			}
		}
		this.jobs.delete(jobId);
		this.logger.log(`Cleaned up HLS job ${jobId}`);
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
	 * 1. Create HLS output directory.
	 * 2. Create pump reader stream (feeds growing file data).
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
			job.totalBytes ?? 0,
			() => this.torrentService.getDownloadedBytes(torrentId),
			job.config.pollIntervalMs,
			job.config.stallTimeoutSec,
		);

		// Build ffmpeg command
		const hlsOutput = join(job.outputDir, 'out-%d.ts');
		const ffmpegArgs = this.buildFfmpegArgs(hlsOutput, job.config);

		this.logger.log(`Job ${jobId}: starting ffmpeg with args: ${ffmpegArgs.join(' ')}`);

		// Spawn ffmpeg process
		const ffmpeg = spawn('ffmpeg', ffmpegArgs, {
			stdio: ['pipe', 'pipe', 'pipe'],
		});

		job.ffmpegPid = ffmpeg.pid ?? null;
		this.ffmpegProcesses.set(jobId, ffmpeg);

		// Connect pump reader to ffmpeg stdin
		inputStream.pipe(ffmpeg.stdin);

		// Monitor ffmpeg output for segment generation and progress
		ffmpeg.stderr.on('data', (data: Buffer) => {
			const line = data.toString();
			this.logger.debug(`ffmpeg: ${line.trim()}`);

			// Track segment creation
			if (line.includes('Opening') && line.includes('.ts')) {
				job.segmentsGenerated++;
				job.lastProgressAt = new Date();
			}

			// Track bytes processed from ffmpeg progress output (e.g. "size=   12345kB")
			const sizeMatch = line.match(/size=\s*(\d+)kB/);
			if (sizeMatch) {
				job.bytesTranscoded = parseInt(sizeMatch[1], 10) * 1024;
			}
		});

		// Handle ffmpeg errors
		ffmpeg.on('error', (err) => {
			this.logger.error(`ffmpeg error for ${jobId}: ${err.message}`);
			job.status = HlsJobStatus.FAILED;
			job.errorMessage = `ffmpeg crashed: ${err.message}`;
			this.ffmpegProcesses.delete(jobId);
		});

		// Handle ffmpeg exit
		ffmpeg.on('close', (code) => {
			if (code === 0 || code === null) {
				job.status = HlsJobStatus.COMPLETED;
				this.logger.log(`Job ${jobId}: ffmpeg completed successfully`);
			} else {
				job.status = HlsJobStatus.FAILED;
				job.errorMessage = `ffmpeg exited with code ${code}`;
				this.logger.error(`Job ${jobId}: ffmpeg exited with code ${code}`);
			}
			job.ffmpegPid = null;
			this.ffmpegProcesses.delete(jobId);
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
	 * - `-hls_list_size 0`: keep all segments in playlist (allows seeking)
	 * - `-f hls`: output format is HLS
	 */
	private buildFfmpegArgs(hlsOutput: string, config: HlsJobConfig): string[] {
		const videoCodec = config.videoBitrate === 'copy' ? 'copy' : 'libx264';
		const videoOptions = config.videoBitrate === 'copy' ? [] : ['-preset', 'veryfast'];

		return [
			'-i', 'pipe:0',
			'-c:v', videoCodec,
			...videoOptions,
			'-c:a', config.audioCodec,
			'-b:a', '128k',
			'-f', 'hls',
			'-hls_time', String(config.segmentDuration),
			'-hls_list_size', String(config.playlistSize),
			'-hls_flags', 'append_list',
			hlsOutput,
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
