import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService, SafeUser } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  RefreshDto,
} from './dto';

// JWT payload interface (matching what's in jwt.strategy.ts)
interface JwtPayload {
  sub: string;
  email: string;
  username: string;
  iat?: number;
  exp?: number;
}

// Token response returned to clients
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: SafeUser;
  tokens: AuthTokens;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessTtl: string;
  private readonly refreshTtl: string;
  private readonly saltRounds = 12;
  private readonly resetTokenExpiry = 60 * 60 * 1000; // 1 hour in ms

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {
    this.accessSecret = this.configService.get<string>(
      'JWT_ACCESS_SECRET',
      'dev-access-secret-change-in-production',
    );
    this.refreshSecret = this.configService.get<string>(
      'JWT_REFRESH_SECRET',
      'dev-refresh-secret-change-in-production',
    );
    this.accessTtl = this.configService.get<string>('JWT_ACCESS_TTL', '15m');
    this.refreshTtl = this.configService.get<string>('JWT_REFRESH_TTL', '7d');
  }

  /**
   * Register a new user
   */
  async register(dto: RegisterDto): Promise<AuthResponse> {
    const { email, username, password } = dto;

    // Check for existing email
    if (await this.usersService.isEmailTaken(email)) {
      throw new ConflictException('Email is already registered');
    }

    // Check for existing username
    if (await this.usersService.isUsernameTaken(username)) {
      throw new ConflictException('Username is already taken');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, this.saltRounds);

    // Create user
    const user = await this.usersService.create({
      email,
      username,
      passwordHash,
    });

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email, user.username);

    // Store refresh token hash
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    this.logger.log(`User registered: ${user.email}`);

    return {
      user: this.usersService.toSafeUser(user),
      tokens,
    };
  }

  /**
   * Login with email/username and password
   */
  async login(dto: LoginDto): Promise<AuthResponse> {
    const { emailOrUsername, password } = dto;

    // Find user
    const user = await this.usersService.findByEmailOrUsername(emailOrUsername);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email, user.username);

    // Store refresh token hash
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    this.logger.log(`User logged in: ${user.email}`);

    return {
      user: this.usersService.toSafeUser(user),
      tokens,
    };
  }

  /**
   * Refresh access token using refresh token
   * Implements refresh token rotation for security
   */
  async refresh(dto: RefreshDto): Promise<AuthTokens> {
    const { refreshToken } = dto;

    // Verify refresh token
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Find user
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Verify stored refresh token hash matches
    if (!user.refreshTokenHash) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    const isTokenValid = await bcrypt.compare(
      refreshToken,
      user.refreshTokenHash,
    );
    if (!isTokenValid) {
      // Possible token reuse attack - invalidate all tokens
      await this.usersService.updateRefreshTokenHash(user.id, null);
      throw new UnauthorizedException(
        'Refresh token invalid - all sessions revoked',
      );
    }

    // Generate new tokens (rotation)
    const tokens = await this.generateTokens(user.id, user.email, user.username);

    // Store new refresh token hash
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    this.logger.log(`Tokens refreshed for user: ${user.email}`);

    return tokens;
  }

  /**
   * Logout - invalidate refresh token
   */
  async logout(userId: string): Promise<void> {
    await this.usersService.updateRefreshTokenHash(userId, null);
    this.logger.log(`User logged out: ${userId}`);
  }

  /**
   * Initiate password reset flow
   * Always returns success to prevent user enumeration
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const { email } = dto;
    const user = await this.usersService.findByEmail(email);

    // Always log for debugging, but don't reveal to client if user exists
    if (!user) {
      this.logger.debug(`Password reset requested for non-existent email: ${email}`);
      return; // Silent return - don't reveal user existence
    }

    // Generate random token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(resetToken, this.saltRounds);

    // Delete any existing reset tokens for this user
    await this.prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    // Create new reset token
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + this.resetTokenExpiry),
      },
    });

    // Send reset email (development: logs to console)
    await this.mailService.sendPasswordResetEmail(
      user.email,
      resetToken,
      user.username,
    );

    this.logger.log(`Password reset token created for: ${user.email}`);
  }

  /**
   * Reset password using token
   */
  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const { token, newPassword } = dto;

    // Find valid (non-expired, unused) reset tokens
    const resetTokens = await this.prisma.passwordResetToken.findMany({
      where: {
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    // Find matching token by comparing hashes
    let validToken: (typeof resetTokens)[0] | null = null;
    for (const rt of resetTokens) {
      const isMatch = await bcrypt.compare(token, rt.tokenHash);
      if (isMatch) {
        validToken = rt;
        break;
      }
    }

    if (!validToken) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, this.saltRounds);

    // Update password and mark token as used (in transaction)
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: validToken.userId },
        data: {
          passwordHash,
          refreshTokenHash: null, // Invalidate all sessions
        },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: validToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    this.logger.log(`Password reset completed for: ${validToken.user.email}`);
  }

  /**
   * Get current user from ID
   */
  async getCurrentUser(userId: string): Promise<SafeUser> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.usersService.toSafeUser(user);
  }

  // ============ Private Helper Methods ============

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(
    userId: string,
    email: string,
    username: string,
  ): Promise<AuthTokens> {
    const payload = {
      sub: userId,
      email,
      username,
    };

    // Parse TTL strings to seconds for JWT library compatibility
    const accessExpiresIn = this.parseTtl(this.accessTtl);
    const refreshExpiresIn = this.parseTtl(this.refreshTtl);

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.accessSecret,
        expiresIn: accessExpiresIn,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.refreshSecret,
        expiresIn: refreshExpiresIn,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  /**
   * Parse TTL string (e.g., '15m', '7d') to seconds
   */
  private parseTtl(ttl: string): number {
    const match = ttl.match(/^(\d+)(s|m|h|d)$/);
    if (!match) {
      // Default to 15 minutes if invalid format
      return 900;
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 60 * 60 * 24;
      default:
        return 900;
    }
  }

  /**
   * Store hashed refresh token in database
   */
  private async storeRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const refreshTokenHash = await bcrypt.hash(refreshToken, this.saltRounds);
    await this.usersService.updateRefreshTokenHash(userId, refreshTokenHash);
  }
}
