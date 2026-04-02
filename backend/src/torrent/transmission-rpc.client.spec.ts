import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TransmissionRpcClient } from './transmission-rpc.client';

const mockConfigValues: Record<string, string> = {
	TRANSMISSION_HOST: 'http://localhost:9091',
	TRANSMISSION_USER: 'admin',
	TRANSMISSION_PASS: 'admin',
};

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('TransmissionRpcClient', () => {
	let client: TransmissionRpcClient;

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				TransmissionRpcClient,
				{
					provide: ConfigService,
					useValue: {
						get: jest.fn((key: string, fallback?: string) => mockConfigValues[key] ?? fallback),
					},
				},
			],
		}).compile();

		client = module.get<TransmissionRpcClient>(TransmissionRpcClient);
	});

	const mockRpcSuccess = (args: Record<string, unknown>) => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({ result: 'success', arguments: args }),
		});
	};

	const mockSessionHandshake = (sessionId: string) => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 409,
			headers: { get: (name: string) => (name === 'x-transmission-session-id' ? sessionId : null) },
		});
	};

	describe('addTorrent', () => {
		it('should add a new torrent and return its id', async () => {
			mockRpcSuccess({ 'torrent-added': { id: 1, name: 'Movie', hashString: 'abc123' } });

			const result = await client.addTorrent('magnet:?xt=urn:btih:abc123');

			expect(result).toEqual({ id: 1, hashString: 'abc123', isDuplicate: false });
			expect(mockFetch).toHaveBeenCalledTimes(1);

			const body = JSON.parse(mockFetch.mock.calls[0][1].body);
			expect(body.method).toBe('torrent-add');
			expect(body.arguments['sequential-download']).toBe(true);
		});

		it('should handle duplicate torrent and force sequential mode', async () => {
			// First call: torrent-add returns duplicate
			mockRpcSuccess({ 'torrent-duplicate': { id: 5, name: 'Movie', hashString: 'abc123' } });
			// Second call: torrent-set to enable sequential
			mockRpcSuccess({});

			const result = await client.addTorrent('magnet:?xt=urn:btih:abc123');

			expect(result.isDuplicate).toBe(true);
			expect(result.id).toBe(5);
			expect(mockFetch).toHaveBeenCalledTimes(2);

			const setBody = JSON.parse(mockFetch.mock.calls[1][1].body);
			expect(setBody.method).toBe('torrent-set');
			expect(setBody.arguments['sequential-download']).toBe(true);
		});

		it('should throw if Transmission returns no torrent data', async () => {
			mockRpcSuccess({});

			await expect(client.addTorrent('magnet:?xt=urn:btih:abc123'))
				.rejects.toThrow('Transmission returned success but no torrent data');
		});
	});

	describe('getTorrent', () => {
		it('should return torrent data when found', async () => {
			const torrent = { id: 1, name: 'Movie', percentDone: 0.5, status: 4 };
			mockRpcSuccess({ torrents: [torrent] });

			const result = await client.getTorrent(1);

			expect(result).toEqual(torrent);
		});

		it('should return null when torrent is not found', async () => {
			mockRpcSuccess({ torrents: [] });

			const result = await client.getTorrent(999);

			expect(result).toBeNull();
		});
	});

	describe('removeTorrent', () => {
		it('should call torrent-remove with correct args', async () => {
			mockRpcSuccess({});

			await client.removeTorrent(1, true);

			const body = JSON.parse(mockFetch.mock.calls[0][1].body);
			expect(body.method).toBe('torrent-remove');
			expect(body.arguments['delete-local-data']).toBe(true);
		});
	});

	describe('session-id handshake', () => {
		it('should retry with session id after 409', async () => {
			mockSessionHandshake('session-abc');
			mockRpcSuccess({ torrents: [] });

			await client.getTorrent(1);

			expect(mockFetch).toHaveBeenCalledTimes(2);
			const headers = mockFetch.mock.calls[1][1].headers;
			expect(headers['X-Transmission-Session-Id']).toBe('session-abc');
		});
	});

	describe('authentication', () => {
		it('should include Authorization header', async () => {
			mockRpcSuccess({ torrents: [] });

			await client.getTorrent(1);

			const headers = mockFetch.mock.calls[0][1].headers;
			const expected = `Basic ${Buffer.from('admin:admin').toString('base64')}`;
			expect(headers['Authorization']).toBe(expected);
		});
	});

	describe('error handling', () => {
		it('should throw on RPC error result', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({ result: 'no method name' }),
			});

			await expect(client.getTorrent(1)).rejects.toThrow('Transmission RPC error: no method name');
		});

		it('should throw on HTTP error', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				statusText: 'Internal Server Error',
			});

			await expect(client.getTorrent(1)).rejects.toThrow('Transmission HTTP 500');
		});
	});
});
