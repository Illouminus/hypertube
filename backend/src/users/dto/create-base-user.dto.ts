import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class CreateBaseUserDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString() 
  @IsNotEmpty()
  lastName: string;
}