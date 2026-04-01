import { ApiProperty } from '@nestjs/swagger';

export class RecordViewDto {
  @ApiProperty({
    description: 'Unique identifier for the view record',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'User ID who viewed the movie',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  userId: string;

  @ApiProperty({
    description: 'Movie ID that was viewed',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  movieId: string;

  @ApiProperty({
    description: 'Timestamp when the movie was viewed',
    example: '2026-04-01T09:30:00.000Z',
  })
  viewedAt: Date;

  @ApiProperty({
    description: 'Record creation timestamp',
    example: '2026-04-01T09:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Record update timestamp',
    example: '2026-04-01T09:30:00.000Z',
  })
  updatedAt: Date;

  constructor(data?: Partial<RecordViewDto>) {
    if (data) {
      Object.assign(this, data);
    }
  }
}
