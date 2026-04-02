import { Test, TestingModule } from '@nestjs/testing';
import { StreamController } from './stream.controller';
import { StreamService } from './stream.service';

describe('StreamController', () => {
	let controller: StreamController;
	let streamService: {
		streamVideo: jest.Mock;
	};

	beforeEach(async () => {
		streamService = {
			streamVideo: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			controllers: [StreamController],
			providers: [{ provide: StreamService, useValue: streamService }],
		}).compile();

		controller = module.get<StreamController>(StreamController);
	});

	it('delegates stream request to service', async () => {
		const req = { headers: {} } as any;
		const res = { writeHead: jest.fn() } as any;
		streamService.streamVideo.mockResolvedValue(undefined);

		await expect(controller.stream('t-1', req, res)).resolves.toBeUndefined();
		expect(streamService.streamVideo).toHaveBeenCalledWith('t-1', req, res);
	});
});
