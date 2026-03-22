import { Body, Controller, Get, HttpCode, HttpStatus, Post, Redirect, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import type { Response } from 'express';
import { FortyTwoAuthGuard } from './guard/fortytwo-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { UserEntity } from 'src/users/entities/user.entity';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly configService: ConfigService,
    ) {}

    @HttpCode(HttpStatus.OK)
    @Post('login')
    async login( @Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response): Promise<{ success: true }> {
        const { email, password } = loginDto;
        const user = await this.authService.validateUser(email, password);
        const { access_token } = await this.authService.login(user);

        const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
        res.cookie('access_token', access_token, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            maxAge: 60 * 60 * 1000,
            path: '/',
        });

        return { success: true };
    }

    @HttpCode(HttpStatus.OK)
    @Post('logout')
    async logout(@Res({ passthrough: true }) res: Response): Promise<{ success: true }> {
        const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
        res.clearCookie('access_token', {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            path: '/',
        });

        return { success: true };
    }

    @UseGuards(FortyTwoAuthGuard)
    @Get('42')
    async fortyTwoAuth() {
        // The FortyTwoAuthGuard will handle the OAuth flow and user creation if necessary.
        // If authentication is successful, the guard will attach the user to the request object (req.user).
        // We can then generate a JWT token for the authenticated user.
    }

    @UseGuards(FortyTwoAuthGuard)
    @Get('42/callback')
    @Redirect(undefined, 302) async fortyTwoAuthRedirect(@CurrentUser() user: UserEntity, @Res({ passthrough: true }) res: Response): Promise<{ url: string }> {
        // This route will be called by 42 after the user authorizes the application.
        // The FortyTwoAuthGuard will handle the callback, extract the user information, and create a JWT token.
        // We set the JWT token in an httpOnly cookie and redirect to the frontend.
        const { access_token } = await this.authService.login(user);

        const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
        res.cookie('access_token', access_token, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            maxAge: 60 * 60 * 1000,
            path: '/',
        });

        const frontendBaseUrl = this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
        const normalizedFrontendUrl = frontendBaseUrl.replace(/\/$/, '');

        return {
            url: `${normalizedFrontendUrl}/login/success`,
        };
    }
}
