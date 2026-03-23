import { IsEmail, IsOptional, IsString, MinLength, IsUrl } from 'class-validator';

export class UpdateUserDto {
    @IsString()
    @IsOptional()
    username?: string;

    @IsEmail()
    @IsOptional()
    email?: string;

    @IsString()
    @IsOptional()
    firstName?: string;

    @IsString()
    @IsOptional()
    lastName?: string;

    @IsString()
    @MinLength(6, { message: 'Password must be at least 6 characters long' })
    @IsOptional()
    password?: string;

    @IsUrl()
    @IsOptional()
    profilePictureUrl?: string;

    @IsString()
    @IsOptional()
    preferredLanguage?: string;
}