import { Test, TestingModule } from '@nestjs/testing';
import { StreamService } from './stream.service';
import { TorrentService } from 'src/torrent/torrent.service';
import { TorrentDownloadStatus } from 'src/torrent/dto/torrent-status-response.dto';
import * as fs from 'node:fs/promises';
import * as nodeFs from 'node:fs';

jest.mock('node:fs/promises');
jest.mock('node:fs');
jest.mock('node:child_process');

const mockStatus = (overrides = {}) => ({
	torrentId: 'torrent-1',
	status: TorrentDownloadStatus.COMPLETED,
	progress: 1,
	filePath: '/downloads/movie.mp4',
	totalSize: 1000000,
	downloadedBytes: 1000000,
	...overrides,
});

describe('StreamService', () => {
	let service: StreamService;
	let torrentService: {
		startDownload: jest.Mock;
		getVideoFilePath: jest.Mock;
		getDownloadedBytes: jest.Mock;
	};

	let mockRes: {
		status: jest.Mock;
		json: jest.Mock;
		writeHead: jest.Mock;
		on: jest.Mock;
	};
	let mockReq: { headers: Record<string, string> };

	beforeEach(async () => {
		torrentService = {
			startDownload: jest.fn(),
			getVideoFilePath: jest.fn(),
			getDownloadedBytes: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				StreamService,
				{ provide: TorrentService, useValue: torrentService },
			],
		}).compile();

		service = module.get<StreamService>(StreamService);

		mockRes = {
			status: jest.fn().mockReturnThis(),
			json: jest.fn().mockReturnThis(),
			writeHead: jest.fn(),
			on: jest.fn(),
		};
		mockReq = { headers: {} };
	});

	describe('streamVideo', () => {
		it('should return 202 when file path is not yet available', async () => {
			torrentService.startDownload.mockResolvedValue(
				mockStatus({ status: TorrentDownloadStatus.DOWNLOADING, progress: 0.01, filePath: null }),
			);
			torrentService.getVideoFilePath.mockResolvedValue(null);

			await service.streamVideo('torrent-1', mockReq as any, mockRes as any);

			expect(mockRes.status).toHaveBeenCalledWith(202);
			expect(mockRes.json).toHaveBeenCalledWith(
				expect.objectContaining({ message: expect.stringContaining('retry') }),
			);
		});

		it('should return 202 when file exists but has 0 bytes', async () => {
			torrentService.startDownload.mockResolvedValue(
				mockStatus({ status: TorrentDownloadStatus.DOWNLOADING, progress: 0.01 }),
			);
			torrentService.getVideoFilePath.mockResolvedValue('/downloads/movie.mp4');
			(fs.stat as jest.Mock).mockResolvedValue({ size: 0 });

			await service.streamVideo('torrent-1', mockReq as any, mockRes as any);

			expect(mockRes.status).toHaveBeenCalledWith(202);
		});

		it('should serve 200 with full content when no Range header', async () => {
			torrentService.startDownload.mockResolvedValue(mockStatus());
			torrentService.getVideoFilePath.mockResolvedValue('/downloads/movie.mp4');
			(fs.stat as jest.Mock).mockResolvedValue({ size: 1000000 });

			const mockStream = { pipe: jest.fn(), on: jest.fn().mockReturnThis() };
			(nodeFs.createReadStream as jest.Mock).mockReturnValue(mockStream);

			await service.streamVideo('torrent-1', mockReq as any, mockRes as any);

			expect(mockRes.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
				'Content-Type': 'video/mp4',
				'Content-Length': 1000000,
			}));
			expect(mockStream.pipe).toHaveBeenCalledWith(mockRes);
		});

		it('should serve 206 Partial Content with Range header', async () => {
			torrentService.startDownload.mockResolvedValue(mockStatus());
			torrentService.getVideoFilePath.mockResolvedValue('/downloads/movie.mp4');
			(fs.stat as jest.Mock).mockResolvedValue({ size: 1000000 });

			const mockStream = { pipe: jest.fn(), on: jest.fn().mockReturnThis() };
			(nodeFs.createReadStream as jest.Mock).mockReturnValue(mockStream);

			mockReq.headers.range = 'bytes=0-499999';

			await service.streamVideo('torrent-1', mockReq as any, mockRes as any);

			expect(mockRes.writeHead).toHaveBeenCalledWith(206, expect.objectContaining({
				'Content-Range': 'bytes 0-499999/1000000',
				'Content-Length': 500000,
			}));
			expect(nodeFs.createReadStream).toHaveBeenCalledWith('/downloads/movie.mp4', { start: 0, end: 499999 });
		});

		it('should handle Range with only start byte', async () => {
			torrentService.startDownload.mockResolvedValue(mockStatus());
			torrentService.getVideoFilePath.mockResolvedValue('/downloads/movie.mp4');
			(fs.stat as jest.Mock).mockResolvedValue({ size: 1000000 });

			const mockStream = { pipe: jest.fn(), on: jest.fn().mockReturnThis() };
			(nodeFs.createReadStream as jest.Mock).mockReturnValue(mockStream);

			mockReq.headers.range = 'bytes=500000-';

			await service.streamVideo('torrent-1', mockReq as any, mockRes as any);

			expect(mockRes.writeHead).toHaveBeenCalledWith(206, expect.objectContaining({
				'Content-Range': 'bytes 500000-999999/1000000',
				'Content-Length': 500000,
			}));
		});

		it('should limit available bytes to downloadedBytes for incomplete torrents', async () => {
			torrentService.startDownload.mockResolvedValue(
				mockStatus({ status: TorrentDownloadStatus.DOWNLOADING, progress: 0.5, downloadedBytes: 500000 }),
			);
			torrentService.getVideoFilePath.mockResolvedValue('/downloads/movie.mp4');
			(fs.stat as jest.Mock).mockResolvedValue({ size: 1000000 });

			const mockStream = { pipe: jest.fn(), on: jest.fn().mockReturnThis() };
			(nodeFs.createReadStream as jest.Mock).mockReturnValue(mockStream);

			mockReq.headers.range = 'bytes=0-';

			await service.streamVideo('torrent-1', mockReq as any, mockRes as any);

			// Available bytes = min(fileSize, downloadedBytes) = 500000
			expect(mockRes.writeHead).toHaveBeenCalledWith(206, expect.objectContaining({
				'Content-Range': 'bytes 0-499999/500000',
			}));
		});
	});
});
