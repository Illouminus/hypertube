import { ApiProperty } from '@nestjs/swagger';

export enum TorrentDownloadStatus {
	IDLE = 'idle',
	DOWNLOADING = 'downloading',
	COMPLETED = 'completed',
	ERROR = 'error',
}

export class TorrentStatusResponseDto {
	@ApiProperty({ example: 'abc-123' })
	torrentId: string;

	@ApiProperty({ enum: TorrentDownloadStatus, example: TorrentDownloadStatus.DOWNLOADING })
	status: TorrentDownloadStatus;

	@ApiProperty({ example: 0.45, description: 'Download progress from 0.0 to 1.0' })
	progress: number;

	@ApiProperty({ example: '/downloads/Movie.Name.2024/movie.mp4', nullable: true })
	filePath: string | null;

	@ApiProperty({ example: 734003200, description: 'Total file size in bytes', nullable: true })
	totalSize: number | null;

	@ApiProperty({ example: 330301440, description: 'Downloaded bytes so far' })
	downloadedBytes: number;

	constructor(partial: Partial<TorrentStatusResponseDto>) {
		Object.assign(this, partial);
	}
}
