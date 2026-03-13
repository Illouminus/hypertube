import { IsOptional, IsString } from 'class-validator';
import { CreateBaseUserDto } from './create-base-user.dto';

export class CreateOAuthUserDto extends CreateBaseUserDto {
  @IsString()
  @IsOptional()
  fortytwoId?: string;
}