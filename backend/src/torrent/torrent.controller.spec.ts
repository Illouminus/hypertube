import { Test, TestingModule } from '@nestjs/testing';
import { TorrentController } from './torrent.controller';
import { TorrentService } from './torrent.service';

describe('TorrentController', () => {
	let controller: TorrentController;
	let torrentService: {
		startDownload: jest.Mock;
		getStatus: jest.Mock;
	};

	beforeEach(async () => {
		torrentService = {
			startDownload: jest.fn(),
			getStatus: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			controllers: [TorrentController],
			providers: [{ provide: TorrentService, useValue: torrentService }],
		}).compile();

		controller = module.get<TorrentController>(TorrentController);
	});

	it('starts torrent download', async () => {
		const response = { torrentId: 't-1', status: 'downloading' };
		torrentService.startDownload.mockResolvedValue(response);

		await expect(controller.startDownload('t-1')).resolves.toEqual(response);
		expect(torrentService.startDownload).toHaveBeenCalledWith('t-1');
	});

	it('returns torrent status', async () => {
		const response = { torrentId: 't-1', status: 'completed' };
		torrentService.getStatus.mockResolvedValue(response);

		await expect(controller.getStatus('t-1')).resolves.toEqual(response);
		expect(torrentService.getStatus).toHaveBeenCalledWith('t-1');
	});
});
