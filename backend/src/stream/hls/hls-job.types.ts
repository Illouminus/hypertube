/**
 * HLS Job state machine for live transcoding of incompatible video formats.
 *
 * A job represents a single user's stream session for one torrent.
 * It manages the lifecycle of ffmpeg transcoding process and segment generation.
 */

export enum HlsJobStatus {
	/**
	 * Job just created, waiting for torrent to provide enough data.
	 * We're downloading and buffering until a minimum threshold.
	 */
	PREBUFFERING = 'prebuffering',

	/**
	 * Torrent has enough data, ffmpeg started, segments are being generated.
	 * This continues while download is active.
	 */
	TRANSCODING = 'transcoding',

	/**
	 * Download completed and ffmpeg finished processing.
	 * All segments are available and won't change.
	 */
	COMPLETED = 'completed',

	/**
	 * Transcoding process died or encountered a fatal error.
	 */
	FAILED = 'failed',
}

/**
 * Configuration for HLS job behavior.
 */
export interface HlsJobConfig {
	/** Minimum bytes to buffer before starting transcode (default: 32 MB) */
	prebufferBytes: number;

	/** HLS segment duration in seconds (default: 3) */
	segmentDuration: number;

	/** Maximum segments to keep in playlist (default: 10) */
	playlistSize: number;

	/** Poll interval for new downloaded bytes (ms) (default: 500) */
	pollIntervalMs: number;

	/** Timeout if download stalls (seconds) (default: 30) */
	stallTimeoutSec: number;

	/** ffmpeg bitrate control: 'copy' (default) or 'medium'/'high' for re-encode */
	videoBitrate: 'copy' | 'medium' | 'high';

	/** Audio codec: 'aac' (default) or 'libmp3lame' */
	audioCodec: 'aac' | 'libmp3lame';
}

/**
 * Runtime state of an active HLS transcoding job.
 */
export interface HlsJob {
	/** Unique job ID, typically torrentId + sessionId */
	jobId: string;

	/** Current status in the state machine */
	status: HlsJobStatus;

	/** Path to input file being transcoded */
	inputFilePath: string;

	/** Directory where HLS segments and playlist are written */
	outputDir: string;

	/** PID of ffmpeg process, null if not running */
	ffmpegPid: number | null;

	/** Segments generated so far */
	segmentsGenerated: number;

	/** Bytes of input file processed by ffmpeg so far */
	bytesTranscoded: number;

	/** Total bytes in the input file (if known) */
	totalBytes: number | null;

	/** Timestamp of job creation */
	createdAt: Date;

	/** Timestamp of last progress update */
	lastProgressAt: Date;

	/** Error message if status is FAILED */
	errorMessage: string | null;

	/** Configuration applied to this job */
	config: HlsJobConfig;
}

/**
 * DTO returned to client for job status queries.
 */
export interface HlsJobStatusDto {
	jobId: string;
	status: HlsJobStatus;
	progress: number; // 0 to 1
	segmentsAvailable: number;
	playlistUrl: string | null; // null until TRANSCODING
	estimatedTimeRemaining: number | null; // seconds
	errorMessage: string | null;
}
