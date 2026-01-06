import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { AuthService, AuthResponse, AuthTokens } from './auth.service';
import { FortyTwoOAuthService } from './fortytwo-oauth.service';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  RefreshDto,
  ExchangeCodeDto,
} from './dto';
import { Public } from './decorators';
import { CurrentUser } from './decorators/current-user.decorator';
import { SafeUser } from '../users/users.service';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  private readonly frontendUrl: string;

  constructor(
    private readonly authService: AuthService,
    private readonly fortyTwoOAuthService: FortyTwoOAuthService,
    private readonly configService: ConfigService,
  ) {
    this.frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
  }

  /**
   * Register a new user
   * POST /auth/register
   */
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto): Promise<AuthResponse> {
    return this.authService.register(dto);
  }

  /**
   * Login with email/username and password
   * POST /auth/login
   * Rate limited: 5 requests per 60 seconds
   */
  @Public()
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(dto);
  }

  /**
   * Get current authenticated user
   * GET /auth/me
   */
  @Get('me')
  @HttpCode(HttpStatus.OK)
  async me(@CurrentUser('id') userId: string): Promise<SafeUser> {
    return this.authService.getCurrentUser(userId);
  }

  /**
   * Refresh access token
   * POST /auth/refresh
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshDto): Promise<AuthTokens> {
    return this.authService.refresh(dto);
  }

  /**
   * Logout - invalidate refresh token
   * POST /auth/logout
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser('id') userId: string): Promise<{ message: string }> {
    await this.authService.logout(userId);
    return { message: 'Logged out successfully' };
  }

  /**
   * Request password reset email
   * POST /auth/forgot-password
   * Rate limited: 3 requests per 60 seconds
   */
  @Public()
  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.forgotPassword(dto);
    // Always return success to prevent user enumeration
    return { message: 'If the email exists, a reset link has been sent' };
  }

  /**
   * Reset password with token
   * POST /auth/reset-password
   */
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.resetPassword(dto);
    return { message: 'Password has been reset successfully' };
  }

  // ============ 42 OAuth Endpoints ============

  /**
   * Initiate 42 OAuth flow
   * GET /auth/42
   * Redirects to 42 authorization page
   */
  @Public()
  @Get('42')
  async initiateFortyTwoOAuth(@Res() res: Response): Promise<void> {
    const { url } = this.fortyTwoOAuthService.generateAuthUrl();
    this.logger.log('Redirecting to 42 OAuth');
    res.redirect(url);
  }

  /**
   * Handle 42 OAuth callback
   * GET /auth/42/callback
   * Exchanges code for tokens and redirects to frontend
   */
  @Public()
  @Get('42/callback')
  async handleFortyTwoCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ): Promise<void> {
    const errorRedirect = `${this.frontendUrl}/login?error=`;

    // Handle OAuth errors
    if (error) {
      this.logger.warn(`42 OAuth error: ${error}`);
      res.redirect(`${errorRedirect}${encodeURIComponent('Authentication was cancelled')}`);
      return;
    }

    // Validate required parameters
    if (!code || !state) {
      this.logger.warn('Missing code or state in 42 callback');
      res.redirect(`${errorRedirect}${encodeURIComponent('Invalid OAuth response')}`);
      return;
    }

    // Validate state
    if (!this.fortyTwoOAuthService.validateState(state)) {
      this.logger.warn('Invalid state in 42 callback');
      res.redirect(`${errorRedirect}${encodeURIComponent('Invalid OAuth state')}`);
      return;
    }

    try {
      // Exchange code for 42 access token
      const accessToken = await this.fortyTwoOAuthService.exchangeCodeForToken(code);

      // Get user profile from 42
      const profile = await this.fortyTwoOAuthService.getUserProfile(accessToken);

      // Find or create local user
      const user = await this.fortyTwoOAuthService.findOrCreateUser(profile);

      // Generate our JWT tokens
      const tokens = await this.authService.generateTokensForUser(user);

      // Store refresh token
      await this.authService.storeRefreshTokenForUser(user.id, tokens.refreshToken);

      // Create one-time exchange code for frontend
      const exchangeCode = await this.fortyTwoOAuthService.createExchangeCode(user.id);

      // Redirect to frontend with exchange code
      this.logger.log(`42 OAuth successful for user: ${user.email}`);
      res.redirect(`${this.frontendUrl}/auth/callback?code=${exchangeCode}`);
    } catch (err) {
      this.logger.error('42 OAuth callback error:', err);
      res.redirect(`${errorRedirect}${encodeURIComponent('Authentication failed')}`);
    }
  }

  /**
   * Exchange OAuth code for JWT tokens
   * POST /auth/exchange
   */
  @Public()
  @Post('exchange')
  @HttpCode(HttpStatus.OK)
  async exchangeCode(@Body() dto: ExchangeCodeDto): Promise<AuthTokens> {
    const { code } = dto;

    // Consume exchange code and get user ID
    const userId = await this.fortyTwoOAuthService.consumeExchangeCode(code);

    // Get user
    const user = await this.authService.getCurrentUser(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Generate new tokens
    const tokens = await this.authService.generateTokensForUser({
      id: user.id,
      email: user.email,
      username: user.username,
    });

    // Store refresh token
    await this.authService.storeRefreshTokenForUser(user.id, tokens.refreshToken);

    return tokens;
  }
}
