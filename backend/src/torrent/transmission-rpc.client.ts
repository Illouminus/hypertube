import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Transmission RPC methods we use.
 * @see https://github.com/transmission/transmission/blob/main/docs/rpc-spec.md
 */
type RpcMethod = 'torrent-add' | 'torrent-get' | 'torrent-set' | 'torrent-remove' | 'session-get';

type RpcRequest = {
	method: RpcMethod;
	arguments?: Record<string, unknown>;
};

type RpcResponse<T = Record<string, unknown>> = {
	result: 'success' | string;
	arguments?: T;
};

export type TransmissionTorrent = {
	id: number;
	name: string;
	hashString: string;
	percentDone: number;
	downloadDir: string;
	totalSize: number;
	haveValid: number;
	status: number;
	eta: number;
	files?: TransmissionFile[];
};

export type TransmissionFile = {
	name: string;
	length: number;
	bytesCompleted: number;
};

type TorrentAddResult = {
	'torrent-added'?: { id: number; name: string; hashString: string };
	'torrent-duplicate'?: { id: number; name: string; hashString: string };
};

const TORRENT_GET_FIELDS = [
	'id',
	'name',
	'hashString',
	'percentDone',
	'downloadDir',
	'totalSize',
	'haveValid',
	'status',
	'eta',
	'files',
] as const;

@Injectable()
export class TransmissionRpcClient {
	private readonly logger = new Logger(TransmissionRpcClient.name);
	private readonly baseUrl: string;
	private readonly auth: string | null;
	private sessionId = '';

	constructor(private readonly configService: ConfigService) {
		const host = this.configService.get<string>('TRANSMISSION_HOST', 'http://localhost:9091');
		this.baseUrl = `${host}/transmission/rpc`;

		const user = this.configService.get<string>('TRANSMISSION_USER');
		const pass = this.configService.get<string>('TRANSMISSION_PASS');
		this.auth = user && pass ? `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}` : null;
	}

	async addTorrent(magnet: string, downloadDir?: string): Promise<{ id: number; hashString: string; isDuplicate: boolean }> {
		const args: Record<string, unknown> = {
			filename: magnet,
			paused: false,
			'sequential-download': true,
		};

		if (downloadDir) {
			args['download-dir'] = downloadDir;
		}

		const response = await this.rpc<TorrentAddResult>('torrent-add', args);
		const added = response['torrent-added'];
		const duplicate = response['torrent-duplicate'];
		const torrent = added ?? duplicate;

		if (!torrent) {
			throw new Error('Transmission returned success but no torrent data');
		}

		if (duplicate) {
			await this.rpc('torrent-set', {
				ids: [duplicate.id],
				'sequential-download': true,
			});
		}

		return {
			id: torrent.id,
			hashString: torrent.hashString,
			isDuplicate: Boolean(duplicate),
		};
	}

	async getTorrent(id: number): Promise<TransmissionTorrent | null> {
		const response = await this.rpc<{ torrents: TransmissionTorrent[] }>('torrent-get', {
			ids: [id],
			fields: [...TORRENT_GET_FIELDS],
		});

		return response.torrents?.[0] ?? null;
	}

	async removeTorrent(id: number, deleteLocalData = false): Promise<void> {
		await this.rpc('torrent-remove', {
			ids: [id],
			'delete-local-data': deleteLocalData,
		});
	}

	private async rpc<T = Record<string, unknown>>(method: RpcMethod, args?: Record<string, unknown>): Promise<T> {
		const body: RpcRequest = { method };
		if (args) {
			body.arguments = args;
		}

		const response = await this.fetchWithSessionRetry(body);
		const data = (await response.json()) as RpcResponse<T>;

		if (data.result !== 'success') {
			throw new Error(`Transmission RPC error: ${data.result}`);
		}

		return data.arguments as T;
	}

	/**
	 * Transmission uses a CSRF-like protection: on the first request it returns 409
	 * with an X-Transmission-Session-Id header. We capture it and retry once.
	 */
	private async fetchWithSessionRetry(body: RpcRequest): Promise<Response> {
		const doFetch = () =>
			fetch(this.baseUrl, {
				method: 'POST',
				headers: this.buildHeaders(),
				body: JSON.stringify(body),
			});

		let response = await doFetch();

		if (response.status === 409) {
			const newSessionId = response.headers.get('x-transmission-session-id');
			if (newSessionId) {
				this.sessionId = newSessionId;
				this.logger.debug('Acquired new Transmission session ID');
			}
			response = await doFetch();
		}

		if (!response.ok) {
			throw new Error(`Transmission HTTP ${response.status}: ${response.statusText}`);
		}

		return response;
	}

	private buildHeaders(): Record<string, string> {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
		};

		if (this.sessionId) {
			headers['X-Transmission-Session-Id'] = this.sessionId;
		}

		if (this.auth) {
			headers['Authorization'] = this.auth;
		}

		return headers;
	}
}
