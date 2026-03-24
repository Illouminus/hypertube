import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
    @ApiProperty({ example: 'reset-token-from-email' })
    @IsString()
    token: string;

    @ApiProperty({ example: 'newStrongPassword123' })
    @IsString()
    @MinLength(6, { message: 'Password must be at least 6 characters long' })
    newPassword: string;
}