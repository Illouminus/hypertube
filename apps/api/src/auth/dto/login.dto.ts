import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: 'Email or username is required' })
  @MaxLength(255)
  emailOrUsername!: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}
