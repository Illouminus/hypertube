import { ApiProperty } from '@nestjs/swagger';

export class UserListItemDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'jdoe' })
  username: string;

  constructor(data: UserListItemDto) {
    this.id = data.id;
    this.username = data.username;
  }
}
