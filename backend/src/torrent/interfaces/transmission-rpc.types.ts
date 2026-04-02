/**
 * Transmission RPC type definitions.
 *
 * These types model the JSON-RPC protocol used by Transmission daemon.
 * Only the subset of fields actually used by our application is defined here.
 *
 * @see https://github.com/transmission/transmission/blob/main/docs/rpc-spec.md
 */

/** RPC methods our client supports */
export type RpcMethod = 'torrent-add' | 'torrent-get' | 'torrent-set' | 'torrent-remove' | 'session-get';

/** Shape of every JSON-RPC request sent to Transmission */
export type RpcRequest = {
	method: RpcMethod;
	arguments?: Record<string, unknown>;
};

/** Shape of every JSON-RPC response returned by Transmission */
export type RpcResponse<T = Record<string, unknown>> = {
	result: 'success' | string;
	arguments?: T;
};

/** A single file inside a torrent, as reported by `torrent-get` */
export type TransmissionFile = {
	/** Relative path within the download directory (e.g. "Movie.Name/movie.mp4") */
	name: string;
	/** Total size of this file in bytes */
	length: number;
	/** How many bytes of this file have been downloaded so far */
	bytesCompleted: number;
};

/**
 * Torrent object returned by the `torrent-get` RPC method.
 *
 * Only the fields we request via TORRENT_GET_FIELDS are guaranteed to be present.
 */
export type TransmissionTorrent = {
	/** Transmission-internal numeric id (unique per daemon session) */
	id: number;
	/** Display name of the torrent */
	name: string;
	/** Info-hash of the torrent in hex (lowercase, 40 chars) */
	hashString: string;
	/** Download progress from 0.0 (nothing) to 1.0 (complete) */
	percentDone: number;
	/** Absolute path to the directory where files are saved */
	downloadDir: string;
	/** Total size of all files in this torrent, in bytes */
	totalSize: number;
	/** Number of verified (downloaded + hash-checked) bytes */
	haveValid: number;
	/** Numeric status code — use TR_STATUS constants for comparison */
	status: number;
	/** Estimated seconds remaining, or -1 if unknown */
	eta: number;
	/** Per-file details (only present if "files" is in the requested fields) */
	files?: TransmissionFile[];
};

/**
 * Response payload for the `torrent-add` RPC method.
 *
 * Transmission returns exactly one of the two keys:
 * - `torrent-added` when a new torrent is created
 * - `torrent-duplicate` when the magnet/hash already exists in the daemon
 */
export type TorrentAddResult = {
	'torrent-added'?: { id: number; name: string; hashString: string };
	'torrent-duplicate'?: { id: number; name: string; hashString: string };
};

/** Result of our `addTorrent()` method after normalizing the Transmission response */
export type AddTorrentResult = {
	/** Transmission-internal numeric id */
	id: number;
	/** Info-hash (hex) */
	hashString: string;
	/** True if the torrent was already in Transmission before our call */
	isDuplicate: boolean;
};

/**
 * Fields we request from Transmission when polling torrent state.
 *
 * This array is passed to `torrent-get` — Transmission only returns
 * the fields explicitly listed here, keeping responses lightweight.
 */
export const TORRENT_GET_FIELDS = [
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

/**
 * Transmission daemon status codes for a torrent.
 *
 * These numeric values are returned in the `status` field of `torrent-get`.
 * @see https://github.com/transmission/transmission/blob/main/docs/rpc-spec.md#33-torrent-accessor-torrent-get
 */
export const TR_STATUS = {
	STOPPED: 0,
	CHECK_WAIT: 1,
	CHECK: 2,
	DOWNLOAD_WAIT: 3,
	DOWNLOAD: 4,
	SEED_WAIT: 5,
	SEED: 6,
} as const;
