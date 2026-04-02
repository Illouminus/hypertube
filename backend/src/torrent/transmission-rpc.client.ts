import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
	RpcMethod,
	RpcRequest,
	RpcResponse,
	TransmissionTorrent,
	TorrentAddResult,
	AddTorrentResult,
	TORRENT_GET_FIELDS,
} from './interfaces/transmission-rpc.types';

/**
 * Low-level HTTP client for the Transmission daemon JSON-RPC API.
 *
 * Handles authentication (HTTP Basic) and the CSRF-like session-id
 * handshake that Transmission requires on every connection.
 *
 * This client is intentionally thin — it translates RPC calls into
 * typed TypeScript methods without adding business logic.
 *
 * @see https://github.com/transmission/transmission/blob/main/docs/rpc-spec.md
 */
@Injectable()
export class TransmissionRpcClient {
	private readonly logger = new Logger(TransmissionRpcClient.name);
	private readonly baseUrl: string;
	private readonly auth: string | null;

	/** Current CSRF token obtained from the 409 handshake */
	private sessionId = '';
	private readonly requestTimeoutMs = 10_000;

	constructor(private readonly configService: ConfigService) {
		const host = this.configService.get<string>('TRANSMISSION_HOST', 'http://localhost:9091');
		this.baseUrl = `${host}/transmission/rpc`;

		const user = this.configService.get<string>('TRANSMISSION_USER');
		const pass = this.configService.get<string>('TRANSMISSION_PASS');
		this.auth = user && pass
			? `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`
			: null;
	}

	/**
	 * Add a torrent to Transmission by magnet URI.
	 *
	 * Sequential download is enabled so that pieces arrive in order,
	 * which is required for streaming video before download completes.
	 *
	 * If the torrent already exists in Transmission (same info-hash),
	 * we still ensure sequential mode is on and return `isDuplicate: true`.
	 */
	async addTorrent(magnet: string, downloadDir?: string): Promise<AddTorrentResult> {
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

		// If the torrent was already present, it might have been added without
		// sequential mode — force-enable it now.
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

	/**
	 * Query full state of a single torrent by its Transmission-internal id.
	 *
	 * Returns null if the torrent is no longer known to Transmission
	 * (e.g. it was removed externally or the daemon was restarted).
	 */
	async getTorrent(id: number): Promise<TransmissionTorrent | null> {
		const response = await this.rpc<{ torrents: TransmissionTorrent[] }>('torrent-get', {
			ids: [id],
			fields: [...TORRENT_GET_FIELDS],
		});

		return response.torrents?.[0] ?? null;
	}

	/**
	 * Remove a torrent from Transmission.
	 *
	 * @param id              Transmission-internal numeric id
	 * @param deleteLocalData When true, also deletes downloaded files from disk
	 */
	async removeTorrent(id: number, deleteLocalData = false): Promise<void> {
		await this.rpc('torrent-remove', {
			ids: [id],
			'delete-local-data': deleteLocalData,
		});
	}

	/**
	 * Send a single JSON-RPC call to Transmission and return the parsed result.
	 *
	 * Throws on non-"success" responses or HTTP errors.
	 */
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
	 * Perform the HTTP request with automatic session-id negotiation.
	 *
	 * Transmission uses a CSRF-like protection mechanism: the very first
	 * request returns HTTP 409 with an `X-Transmission-Session-Id` header.
	 * We capture that token and resend the request. Subsequent calls reuse
	 * the token until it expires (at which point we repeat the dance).
	 */
	private async fetchWithSessionRetry(body: RpcRequest): Promise<Response> {
		const doFetch = () =>
			fetch(this.baseUrl, {
				method: 'POST',
				headers: this.buildHeaders(),
				body: JSON.stringify(body),
				signal: AbortSignal.timeout(this.requestTimeoutMs),
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

	/** Build request headers including auth and session token when available */
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
