import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TorrentService } from './torrent.service';
import { TransmissionRpcClient } from './transmission-rpc.client';
import { TorrentDownloadStatus } from './dto/torrent-status-response.dto';
import { PrismaService } from 'src/prisma/prisma.service';

const makeTorrentRecord = (overrides = {}) => ({
	id: 'torrent-uuid-1',
	hash: 'abc123',
	magnet: 'magnet:?xt=urn:btih:abc123',
	quality: '1080p',
	size: '1.5 GB',
	seeds: 10,
	peers: 5,
	isDownloaded: false,
	filePath: null,
	movieId: 'movie-uuid-1',
	createdAt: new Date(),
	updatedAt: new Date(),
	...overrides,
});

describe('TorrentService', () => {
	let service: TorrentService;
	let rpc: { addTorrent: jest.Mock; getTorrent: jest.Mock; removeTorrent: jest.Mock };
	let prisma: { torrent: { findUnique: jest.Mock; update: jest.Mock } };

	beforeEach(async () => {
		rpc = {
			addTorrent: jest.fn(),
			getTorrent: jest.fn(),
			removeTorrent: jest.fn(),
		};

		prisma = {
			torrent: {
				findUnique: jest.fn(),
				update: jest.fn(),
			},
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				TorrentService,
				{ provide: TransmissionRpcClient, useValue: rpc },
				{ provide: PrismaService, useValue: prisma },
				{
					provide: ConfigService,
					useValue: { get: jest.fn(() => './downloads') },
				},
			],
		}).compile();

		service = module.get<TorrentService>(TorrentService);
	});

	describe('startDownload', () => {
		it('should throw NotFoundException for non-existent torrent', async () => {
			prisma.torrent.findUnique.mockResolvedValue(null);

			await expect(service.startDownload('non-existent'))
				.rejects.toThrow(NotFoundException);
		});

		it('should return COMPLETED immediately for already downloaded torrent', async () => {
			prisma.torrent.findUnique.mockResolvedValue(
				makeTorrentRecord({ isDownloaded: true, filePath: '/downloads/movie.mp4' }),
			);

			const result = await service.startDownload('torrent-uuid-1');

			expect(result.status).toBe(TorrentDownloadStatus.COMPLETED);
			expect(result.progress).toBe(1);
			expect(rpc.addTorrent).not.toHaveBeenCalled();
		});

		it('should send magnet to Transmission for new torrent', async () => {
			prisma.torrent.findUnique.mockResolvedValue(makeTorrentRecord());
			rpc.addTorrent.mockResolvedValue({ id: 1, hashString: 'abc123', isDuplicate: false });

			const result = await service.startDownload('torrent-uuid-1');

			expect(result.status).toBe(TorrentDownloadStatus.DOWNLOADING);
			expect(rpc.addTorrent).toHaveBeenCalledWith(
				'magnet:?xt=urn:btih:abc123',
				expect.stringContaining('downloads'),
			);
		});

		it('should query Transmission status for duplicate torrent', async () => {
			prisma.torrent.findUnique.mockResolvedValue(makeTorrentRecord());
			rpc.addTorrent.mockResolvedValue({ id: 3, hashString: 'abc123', isDuplicate: true });
			rpc.getTorrent.mockResolvedValue({
				id: 3,
				percentDone: 0.75,
				status: 4,
				totalSize: 700000000,
				haveValid: 525000000,
				downloadDir: '/downloads',
				files: [{ name: 'movie.mp4', length: 700000000, bytesCompleted: 525000000 }],
			});

			const result = await service.startDownload('torrent-uuid-1');

			expect(result.status).toBe(TorrentDownloadStatus.DOWNLOADING);
			expect(result.progress).toBe(0.75);
		});
	});

	describe('getStatus', () => {
		it('should return IDLE when torrent has not been sent to Transmission', async () => {
			prisma.torrent.findUnique.mockResolvedValue(makeTorrentRecord());

			const result = await service.getStatus('torrent-uuid-1');

			expect(result.status).toBe(TorrentDownloadStatus.IDLE);
		});

		it('should return COMPLETED for downloaded torrent', async () => {
			prisma.torrent.findUnique.mockResolvedValue(
				makeTorrentRecord({ isDownloaded: true, filePath: '/downloads/movie.mp4' }),
			);

			const result = await service.getStatus('torrent-uuid-1');

			expect(result.status).toBe(TorrentDownloadStatus.COMPLETED);
		});
	});

	describe('getVideoFilePath', () => {
		it('should return filePath from DB when already persisted', async () => {
			prisma.torrent.findUnique.mockResolvedValue(
				makeTorrentRecord({ filePath: '/downloads/movie.mp4' }),
			);

			const result = await service.getVideoFilePath('torrent-uuid-1');

			expect(result).toBe('/downloads/movie.mp4');
		});

		it('should return null when torrent not tracked in Transmission', async () => {
			prisma.torrent.findUnique.mockResolvedValue(makeTorrentRecord());

			const result = await service.getVideoFilePath('torrent-uuid-1');

			expect(result).toBeNull();
		});

		it('should pick the largest video file from Transmission', async () => {
			prisma.torrent.findUnique.mockResolvedValue(makeTorrentRecord());

			// Simulate that this torrent was previously started
			rpc.addTorrent.mockResolvedValue({ id: 1, hashString: 'abc123', isDuplicate: false });
			await service.startDownload('torrent-uuid-1');

			rpc.getTorrent.mockResolvedValue({
				id: 1,
				downloadDir: '/downloads',
				files: [
					{ name: 'sample.mp4', length: 5000, bytesCompleted: 5000 },
					{ name: 'movie.mkv', length: 700000000, bytesCompleted: 100000 },
					{ name: 'readme.nfo', length: 500, bytesCompleted: 500 },
				],
			});

			const result = await service.getVideoFilePath('torrent-uuid-1');

			expect(result).toContain('movie.mkv');
		});
	});

	describe('removeTorrentData', () => {
		it('should call rpc.removeTorrent when tracked', async () => {
			prisma.torrent.findUnique.mockResolvedValue(makeTorrentRecord());
			rpc.addTorrent.mockResolvedValue({ id: 7, hashString: 'abc123', isDuplicate: false });
			await service.startDownload('torrent-uuid-1');

			await service.removeTorrentData('torrent-uuid-1');

			expect(rpc.removeTorrent).toHaveBeenCalledWith(7, true);
		});

		it('should silently succeed when torrent not tracked', async () => {
			await expect(service.removeTorrentData('unknown')).resolves.toBeUndefined();
			expect(rpc.removeTorrent).not.toHaveBeenCalled();
		});
	});
});
