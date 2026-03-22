import { Body, Controller, Get, HttpCode, HttpStatus, Post, Redirect, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import type { Response, CookieOptions } from 'express';
import { FortyTwoAuthGuard } from './guard/fortytwo-auth.guard';
import { GoogleAuthGuard } from './guard/google-auth.guard';
import { JwtAuthGuard } from './guard/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { UserEntity } from 'src/users/entities/user.entity';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly configService: ConfigService,
    ) {}

    // Shared cookie options for auth token handling.
    private getCookieOptions(): CookieOptions {
        const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
        return {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            path: '/',
        };
    }

    // Reused by OAuth callbacks to issue a JWT cookie and redirect the frontend.
    private async setTokenCookieAndGetRedirectUrl(user: UserEntity, res: Response): Promise<{ url: string }> {
        const { access_token } = await this.authService.login(user);

        res.cookie('access_token', access_token, {
            ...this.getCookieOptions(),
            maxAge: 60 * 60 * 1000,
        });

        const frontendBaseUrl = this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
        const normalizedFrontendUrl = frontendBaseUrl.replace(/\/$/, '');

        return { url: `${normalizedFrontendUrl}/login/success` };
    }

    @HttpCode(HttpStatus.OK)
    @Post('login')
    async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response): Promise<{ success: boolean }> {
        const { email, password } = loginDto;
        const user = await this.authService.validateUser(email, password);
        const { access_token } = await this.authService.login(user);

        res.cookie('access_token', access_token, {
            ...this.getCookieOptions(),
            maxAge: 60 * 60 * 1000,
        });

        return { success: true };
    }

    // Only authenticated users can call logout.
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    @Post('logout')
    async logout(@Res({ passthrough: true }) res: Response): Promise<{ success: boolean }> {
        res.clearCookie('access_token', this.getCookieOptions());
        return { success: true };
    }

    @UseGuards(FortyTwoAuthGuard)
    @Get('42')
    async fortyTwoAuth() {}

    @UseGuards(FortyTwoAuthGuard)
    @Get('42/callback')
    @Redirect(undefined, 302)
    async fortyTwoAuthRedirect(@CurrentUser() user: UserEntity, @Res({ passthrough: true }) res: Response): Promise<{ url: string }> {
        return this.setTokenCookieAndGetRedirectUrl(user, res);
    }

    @UseGuards(GoogleAuthGuard)
    @Get('google')
    async googleAuth() {}

    @UseGuards(GoogleAuthGuard)
    @Get('google/callback')
    @Redirect(undefined, 302)
    async googleAuthRedirect(@CurrentUser() user: UserEntity, @Res({ passthrough: true }) res: Response): Promise<{ url: string }> {
        return this.setTokenCookieAndGetRedirectUrl(user, res);
    }
}