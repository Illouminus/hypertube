import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { TransmissionRpcClient } from './transmission-rpc.client';
import { TransmissionTorrent, TR_STATUS } from './interfaces/transmission-rpc.types';
import { VIDEO_EXTENSIONS } from './interfaces/torrent.constants';
import { TorrentDownloadStatus, TorrentStatusResponseDto } from './dto/torrent-status-response.dto';
import { resolve, extname } from 'node:path';
import { stat } from 'node:fs/promises';

/**
 * Orchestrates torrent lifecycle: start downloads, poll progress,
 * resolve video file paths, and clean up finished/stale torrents.
 *
 * Acts as a bridge between our Prisma-backed torrent records and
 * the Transmission daemon that performs the actual BitTorrent work.
 */
@Injectable()
export class TorrentService {
	private readonly logger = new Logger(TorrentService.name);
	private readonly downloadsPath: string;

	/**
	 * In-memory mapping from our DB torrent id (UUID) to Transmission's
	 * internal numeric id. This avoids a Transmission lookup on every
	 * status poll. The map is rebuilt on demand — if the server restarts,
	 * the first `startDownload` call for each torrent re-populates it.
	 */
	private readonly transmissionIds = new Map<string, number>();

	constructor(
		private readonly rpc: TransmissionRpcClient,
		private readonly prisma: PrismaService,
		private readonly configService: ConfigService,
	) {
		this.downloadsPath = this.configService.get<string>('DOWNLOADS_PATH', './downloads');
	}

	/**
	 * Initiate a torrent download via Transmission.
	 *
	 * - If the torrent is already fully downloaded (persisted in DB), returns immediately.
	 * - If it's already known to Transmission, returns current progress.
	 * - Otherwise, sends the magnet to Transmission with sequential mode enabled.
	 *
	 * @param torrentId  UUID of the Torrent record in our database
	 * @returns Current download status snapshot
	 * @throws NotFoundException when torrentId doesn't exist in the database
	 */
	async startDownload(torrentId: string): Promise<TorrentStatusResponseDto> {
		const torrent = await this.findTorrentOrFail(torrentId);

		if (torrent.isDownloaded && torrent.filePath) {
			const fileSize = await this.getFileSizeOrZero(torrent.filePath);
			return this.buildStatusDto(torrentId, TorrentDownloadStatus.COMPLETED, 1, torrent.filePath, fileSize, fileSize);
		}

		// If we already track this torrent in Transmission, just return fresh status
		const existingTrId = this.transmissionIds.get(torrentId);
		if (existingTrId !== undefined) {
			return this.queryTransmissionStatus(torrentId, existingTrId);
		}

		this.logger.log(`Starting torrent download: ${torrentId} (hash: ${torrent.hash})`);
		const result = await this.rpc.addTorrent(torrent.magnet, resolve(this.downloadsPath));
		this.transmissionIds.set(torrentId, result.id);

		if (result.isDuplicate) {
			this.logger.log(`Torrent already in Transmission (duplicate): ${torrent.hash}`);
			return this.queryTransmissionStatus(torrentId, result.id);
		}

		return this.buildStatusDto(torrentId, TorrentDownloadStatus.DOWNLOADING, 0, null, null, 0);
	}

	/**
	 * Poll current download status for a torrent.
	 *
	 * Returns IDLE if the torrent has never been sent to Transmission,
	 * COMPLETED if it's already on disk, or a live progress snapshot otherwise.
	 *
	 * @param torrentId  UUID of the Torrent record in our database
	 * @throws NotFoundException when torrentId doesn't exist in the database
	 */
	async getStatus(torrentId: string): Promise<TorrentStatusResponseDto> {
		const torrent = await this.findTorrentOrFail(torrentId);

		if (torrent.isDownloaded && torrent.filePath) {
			const fileSize = await this.getFileSizeOrZero(torrent.filePath);
			return this.buildStatusDto(torrentId, TorrentDownloadStatus.COMPLETED, 1, torrent.filePath, fileSize, fileSize);
		}

		const trId = this.transmissionIds.get(torrentId);
		if (trId === undefined) {
			return this.buildStatusDto(torrentId, TorrentDownloadStatus.IDLE, 0, null, null, 0);
		}

		return this.queryTransmissionStatus(torrentId, trId);
	}

	/**
	 * Resolve the absolute path to the main video file within the torrent.
	 *
	 * Torrents often contain multiple files (samples, subtitles, nfo).
	 * We pick the largest file that has a recognized video extension.
	 *
	 * @returns Absolute file path, or null if no video file is available yet
	 * @throws NotFoundException when torrentId doesn't exist in the database
	 */
	async getVideoFilePath(torrentId: string): Promise<string | null> {
		const torrent = await this.findTorrentOrFail(torrentId);

		if (torrent.filePath) {
			return torrent.filePath;
		}

		const trId = this.transmissionIds.get(torrentId);
		if (trId === undefined) {
			return null;
		}

		const trTorrent = await this.rpc.getTorrent(trId);
		if (!trTorrent?.files?.length) {
			return null;
		}

		const videoFile = this.findLargestVideoFile(trTorrent);
		if (!videoFile) {
			return null;
		}

		return resolve(trTorrent.downloadDir, videoFile.name);
	}

	/**
	 * Get the number of bytes downloaded for the main video file.
	 *
	 * Uses per-file `bytesCompleted` rather than torrent-wide `haveValid`,
	 * because a torrent may contain multiple files and `haveValid` sums all of them.
	 */
	async getDownloadedBytes(torrentId: string): Promise<number> {
		const trId = this.transmissionIds.get(torrentId);
		if (trId === undefined) {
			return 0;
		}

		const trTorrent = await this.rpc.getTorrent(trId);
		if (!trTorrent) {
			return 0;
		}

		const videoFile = this.findLargestVideoFile(trTorrent);
		if (!videoFile) {
			return 0;
		}

		// Find the matching file entry to get its bytesCompleted
		const fileEntry = trTorrent.files?.find((f) => f.name === videoFile.name);
		return fileEntry?.bytesCompleted ?? 0;
	}

	/**
	 * Remove a torrent from Transmission and delete its files from disk.
	 *
	 * Silently succeeds if the torrent is not tracked by Transmission
	 * (e.g. after a daemon restart or manual removal).
	 */
	async removeTorrentData(torrentId: string): Promise<void> {
		const trId = this.transmissionIds.get(torrentId);
		if (trId === undefined) {
			return;
		}

		try {
			await this.rpc.removeTorrent(trId, true);
		} catch (error) {
			this.logger.warn(`Failed to remove torrent from Transmission: ${this.extractErrorMessage(error)}`);
		}

		this.transmissionIds.delete(torrentId);
	}

	// ─── Private helpers ────────────────────────────────────────────────

	/** Fetch a torrent record from DB or throw 404 */
	private async findTorrentOrFail(torrentId: string) {
		const torrent = await this.prisma.torrent.findUnique({ where: { id: torrentId } });
		if (!torrent) {
			throw new NotFoundException(`Torrent ${torrentId} not found`);
		}
		return torrent;
	}

	/**
	 * Query Transmission for live torrent state and translate it into our DTO.
	 *
	 * When the torrent reaches 100%, we persist the file path in our DB
	 * so future requests skip Transmission entirely.
	 */
	private async queryTransmissionStatus(torrentId: string, trId: number): Promise<TorrentStatusResponseDto> {
		const trTorrent = await this.rpc.getTorrent(trId);

		if (!trTorrent) {
			this.transmissionIds.delete(torrentId);
			return this.buildStatusDto(torrentId, TorrentDownloadStatus.ERROR, 0, null, null, 0);
		}

		const status = this.mapTransmissionStatus(trTorrent);
		const videoFile = this.findLargestVideoFile(trTorrent);
		const filePath = videoFile ? resolve(trTorrent.downloadDir, videoFile.name) : null;

		if (status === TorrentDownloadStatus.COMPLETED && filePath) {
			await this.markAsDownloaded(torrentId, filePath);
		}

		return this.buildStatusDto(
			torrentId,
			status,
			trTorrent.percentDone,
			filePath,
			trTorrent.totalSize,
			trTorrent.haveValid,
		);
	}

	/**
	 * Map Transmission's numeric status code to our application-level enum.
	 *
	 * Transmission uses integers 0-6 to represent torrent state.
	 * We collapse these into a simpler set: IDLE / DOWNLOADING / COMPLETED / ERROR.
	 */
	private mapTransmissionStatus(trTorrent: TransmissionTorrent): TorrentDownloadStatus {
		if (trTorrent.percentDone >= 1) {
			return TorrentDownloadStatus.COMPLETED;
		}

		switch (trTorrent.status) {
			case TR_STATUS.DOWNLOAD:
			case TR_STATUS.DOWNLOAD_WAIT:
			case TR_STATUS.CHECK:
			case TR_STATUS.CHECK_WAIT:
				return TorrentDownloadStatus.DOWNLOADING;
			case TR_STATUS.STOPPED:
				return trTorrent.percentDone > 0
					? TorrentDownloadStatus.DOWNLOADING
					: TorrentDownloadStatus.IDLE;
			case TR_STATUS.SEED:
			case TR_STATUS.SEED_WAIT:
				return TorrentDownloadStatus.COMPLETED;
			default:
				return TorrentDownloadStatus.ERROR;
		}
	}

	/**
	 * From all files in a torrent, find the largest one with a video extension.
	 *
	 * Torrents often bundle .nfo, .srt, .txt alongside the video.
	 * The largest video file is almost always the actual movie.
	 */
	private findLargestVideoFile(trTorrent: TransmissionTorrent): { name: string; length: number } | null {
		if (!trTorrent.files?.length) {
			return null;
		}

		let largest: { name: string; length: number } | null = null;

		for (const file of trTorrent.files) {
			const ext = extname(file.name).toLowerCase();
			if (!VIDEO_EXTENSIONS.has(ext)) {
				continue;
			}
			if (!largest || file.length > largest.length) {
				largest = { name: file.name, length: file.length };
			}
		}

		return largest;
	}

	/** Persist download completion in the database so we skip Transmission on future requests */
	private async markAsDownloaded(torrentId: string, filePath: string): Promise<void> {
		try {
			await this.prisma.torrent.update({
				where: { id: torrentId },
				data: { isDownloaded: true, filePath },
			});
			this.logger.log(`Torrent ${torrentId} marked as downloaded: ${filePath}`);
		} catch (error) {
			this.logger.warn(`Failed to mark torrent as downloaded: ${this.extractErrorMessage(error)}`);
		}
	}

	/** Construct a TorrentStatusResponseDto with all fields populated */
	private buildStatusDto(
		torrentId: string,
		status: TorrentDownloadStatus,
		progress: number,
		filePath: string | null,
		totalSize: number | null,
		downloadedBytes: number,
	): TorrentStatusResponseDto {
		return new TorrentStatusResponseDto({
			torrentId,
			status,
			progress,
			filePath,
			totalSize,
			downloadedBytes,
		});
	}

	/** Get file size on disk, returning 0 if the file doesn't exist */
	private async getFileSizeOrZero(filePath: string): Promise<number> {
		try {
			const info = await stat(filePath);
			return info.size;
		} catch {
			return 0;
		}
	}

	private extractErrorMessage(error: unknown): string {
		if (error instanceof Error) return error.message;
		return String(error);
	}
}
