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
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ApiBadRequestResponse, ApiBody, ApiOkResponse, ApiOperation, ApiUnauthorizedResponse, ApiTags } from '@nestjs/swagger';
import { ErrorResponseDto } from 'src/common/dto/error-response.dto';

@ApiTags('auth')
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
    @ApiOperation({ summary: 'Login with email and password' })
    @ApiBody({ type: LoginDto })
    @ApiOkResponse({
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
            },
        },
    })
    @ApiBadRequestResponse({ description: 'Validation failed for login payload', type: ErrorResponseDto })
    @ApiUnauthorizedResponse({ description: 'Invalid credentials', type: ErrorResponseDto })
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
    @ApiOperation({ summary: 'Logout current user and clear auth cookie' })
    @ApiUnauthorizedResponse({ description: 'Authentication required', type: ErrorResponseDto })
    async logout(@Res({ passthrough: true }) res: Response): Promise<{ success: boolean }> {
        res.clearCookie('access_token', this.getCookieOptions());
        return { success: true };
    }

    @UseGuards(FortyTwoAuthGuard)
    @Get('42')
    @ApiOperation({ summary: 'Start 42 OAuth flow' })
    async fortyTwoAuth() {}

    @UseGuards(FortyTwoAuthGuard)
    @Get('42/callback')
    @Redirect(undefined, 302)
    @ApiOperation({ summary: '42 OAuth callback' })
    async fortyTwoAuthRedirect(@CurrentUser() user: UserEntity, @Res({ passthrough: true }) res: Response): Promise<{ url: string }> {
        return this.setTokenCookieAndGetRedirectUrl(user, res);
    }

    @UseGuards(GoogleAuthGuard)
    @Get('google')
    @ApiOperation({ summary: 'Start Google OAuth flow' })
    async googleAuth() {}

    @UseGuards(GoogleAuthGuard)
    @Get('google/callback')
    @Redirect(undefined, 302)
    @ApiOperation({ summary: 'Google OAuth callback' })
    async googleAuthRedirect(@CurrentUser() user: UserEntity, @Res({ passthrough: true }) res: Response): Promise<{ url: string }> {
        return this.setTokenCookieAndGetRedirectUrl(user, res);
    }


    @HttpCode(HttpStatus.OK)
    @Post('forgot-password')
    @ApiOperation({ summary: 'Request password reset link' })
    @ApiBody({ type: ForgotPasswordDto })
    @ApiBadRequestResponse({ description: 'Validation failed for email field', type: ErrorResponseDto })
    async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto): Promise<{ message: string }> {
        this.authService.forgotPassword(forgotPasswordDto.email);
        return { message: 'If an account with that email exists, a password reset link has been sent.' };
    }

    @HttpCode(HttpStatus.OK)
    @Post('reset-password')
    @ApiOperation({ summary: 'Reset password using token' })
    @ApiBody({ type: ResetPasswordDto })
    @ApiBadRequestResponse({ description: 'Validation failed or token is invalid/expired', type: ErrorResponseDto })
    async resetPassword(@Body() resetPasswordDto: ResetPasswordDto): Promise<{ success: boolean }> {
        await this.authService.resetPassword(resetPasswordDto);
        return { success: true };
    }
}