import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({ oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] })
  message: string | string[];

  @ApiProperty({ example: 'Bad Request' })
  error: string;
}
