import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { TransmissionRpcClient, TransmissionTorrent } from './transmission-rpc.client';
import { TorrentDownloadStatus, TorrentStatusResponseDto } from './dto/torrent-status-response.dto';
import { resolve, extname } from 'node:path';
import { stat } from 'node:fs/promises';

/** Transmission status codes */
const TR_STATUS = {
	STOPPED: 0,
	CHECK_WAIT: 1,
	CHECK: 2,
	DOWNLOAD_WAIT: 3,
	DOWNLOAD: 4,
	SEED_WAIT: 5,
	SEED: 6,
} as const;

/** Video file extensions we consider playable */
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mkv', '.webm', '.avi', '.mov']);

@Injectable()
export class TorrentService {
	private readonly logger = new Logger(TorrentService.name);
	private readonly downloadsPath: string;

	/**
	 * In-memory map: torrent DB id -> Transmission internal id.
	 * Avoids querying Transmission for the mapping on every request.
	 */
	private readonly transmissionIds = new Map<string, number>();

	constructor(
		private readonly rpc: TransmissionRpcClient,
		private readonly prisma: PrismaService,
		private readonly configService: ConfigService,
	) {
		this.downloadsPath = this.configService.get<string>('DOWNLOADS_PATH', './downloads');
	}

	async startDownload(torrentId: string): Promise<TorrentStatusResponseDto> {
		const torrent = await this.prisma.torrent.findUnique({ where: { id: torrentId } });
		if (!torrent) {
			throw new NotFoundException(`Torrent ${torrentId} not found`);
		}

		if (torrent.isDownloaded && torrent.filePath) {
			return this.buildStatusDto(torrentId, TorrentDownloadStatus.COMPLETED, 1, torrent.filePath, null, 0);
		}

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

	async getStatus(torrentId: string): Promise<TorrentStatusResponseDto> {
		const torrent = await this.prisma.torrent.findUnique({ where: { id: torrentId } });
		if (!torrent) {
			throw new NotFoundException(`Torrent ${torrentId} not found`);
		}

		if (torrent.isDownloaded && torrent.filePath) {
			return this.buildStatusDto(torrentId, TorrentDownloadStatus.COMPLETED, 1, torrent.filePath, null, 0);
		}

		const trId = this.transmissionIds.get(torrentId);
		if (trId === undefined) {
			return this.buildStatusDto(torrentId, TorrentDownloadStatus.IDLE, 0, null, null, 0);
		}

		return this.queryTransmissionStatus(torrentId, trId);
	}

	/**
	 * Returns the absolute path to the largest video file in the torrent.
	 * Returns null if the file doesn't exist yet or is too small.
	 */
	async getVideoFilePath(torrentId: string): Promise<string | null> {
		const torrent = await this.prisma.torrent.findUnique({ where: { id: torrentId } });
		if (!torrent) {
			throw new NotFoundException(`Torrent ${torrentId} not found`);
		}

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
	 * Returns how many bytes are available on disk from the start of the file.
	 * For sequential downloads, haveValid gives us the contiguous downloaded bytes.
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

		return trTorrent.haveValid;
	}

	async removeTorrentData(torrentId: string): Promise<void> {
		const trId = this.transmissionIds.get(torrentId);
		if (trId !== undefined) {
			try {
				await this.rpc.removeTorrent(trId, true);
			} catch (error) {
				this.logger.warn(`Failed to remove torrent from Transmission: ${this.extractErrorMessage(error)}`);
			}
			this.transmissionIds.delete(torrentId);
		}
	}

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

	private extractErrorMessage(error: unknown): string {
		if (error instanceof Error) return error.message;
		return String(error);
	}
}
