import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';

// Google OAuth response types
interface GoogleTokenResponse {
    access_token: string;
    expires_in: number;
    token_type: string;
    scope: string;
    id_token?: string;
    refresh_token?: string;
}

interface GoogleUserProfile {
    sub: string; // Unique Google user ID
    email: string;
    email_verified: boolean;
    name: string;
    given_name: string;
    family_name: string;
    picture: string;
    locale?: string;
}

@Injectable()
export class GoogleOAuthService {
    private readonly logger = new Logger(GoogleOAuthService.name);
    private readonly clientId: string;
    private readonly clientSecret: string;
    private readonly redirectUri: string;
    private readonly saltRounds = 12;

    // In-memory state storage (shared pattern with 42 OAuth)
    private stateStore = new Map<string, { expiresAt: number }>();

    constructor(
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
    ) {
        this.clientId = this.configService.get<string>('GOOGLE_CLIENT_ID', '');
        this.clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET', '');
        this.redirectUri = this.configService.get<string>(
            'GOOGLE_REDIRECT_URI',
            'http://localhost:3001/auth/google/callback',
        );

        if (!this.clientId || !this.clientSecret) {
            this.logger.warn('Google OAuth credentials not configured');
        }
    }

    /**
     * Generate OAuth authorize URL with state parameter
     */
    generateAuthUrl(): { url: string; state: string } {
        const state = crypto.randomBytes(32).toString('hex');

        // Store state with 10 minute expiry
        this.stateStore.set(state, {
            expiresAt: Date.now() + 10 * 60 * 1000,
        });

        // Clean up expired states
        this.cleanupExpiredStates();

        const params = new URLSearchParams({
            client_id: this.clientId,
            redirect_uri: this.redirectUri,
            response_type: 'code',
            scope: 'openid email profile',
            state,
            access_type: 'offline',
            prompt: 'consent',
        });

        const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

        return { url, state };
    }

    /**
     * Validate state parameter
     */
    validateState(state: string): boolean {
        const stored = this.stateStore.get(state);
        if (!stored) {
            return false;
        }

        // Check expiry and delete
        this.stateStore.delete(state);
        return stored.expiresAt > Date.now();
    }

    /**
     * Exchange authorization code for access token
     */
    async exchangeCodeForToken(code: string): Promise<string> {
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: this.clientId,
                client_secret: this.clientSecret,
                code,
                redirect_uri: this.redirectUri,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            this.logger.error(`Failed to exchange code for Google token: ${error}`);
            throw new UnauthorizedException('Failed to authenticate with Google');
        }

        const data: GoogleTokenResponse = await response.json();
        return data.access_token;
    }

    /**
     * Fetch user profile from Google API
     */
    async getUserProfile(accessToken: string): Promise<GoogleUserProfile> {
        const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            const error = await response.text();
            this.logger.error(`Failed to fetch Google user profile: ${error}`);
            throw new UnauthorizedException('Failed to get user profile from Google');
        }

        return response.json();
    }

    /**
     * Find existing user or create new one from Google profile
     */
    async findOrCreateUser(profile: GoogleUserProfile): Promise<User> {
        const providerId = profile.sub;

        // First, try to find by OAuth provider
        let user = await this.prisma.user.findFirst({
            where: {
                oauthProvider: 'google',
                oauthProviderId: providerId,
            },
        });

        if (user) {
            this.logger.log(`Found existing Google user: ${user.email}`);
            return user;
        }

        // Try to find by email and link account
        user = await this.prisma.user.findUnique({
            where: { email: profile.email.toLowerCase() },
        });

        if (user) {
            // Link Google account to existing user
            user = await this.prisma.user.update({
                where: { id: user.id },
                data: {
                    oauthProvider: 'google',
                    oauthProviderId: providerId,
                    avatarUrl: user.avatarUrl || profile.picture,
                },
            });
            this.logger.log(`Linked Google account to existing user: ${user.email}`);
            return user;
        }

        // Create new user
        // Generate unique username from Google name or email
        let baseUsername = profile.given_name?.toLowerCase() || profile.email.split('@')[0];
        baseUsername = baseUsername.replace(/[^a-z0-9_-]/g, '');

        let username = baseUsername;
        let suffix = 0;
        while (await this.prisma.user.findUnique({ where: { username } })) {
            suffix++;
            username = `${baseUsername}${suffix}`;
        }

        user = await this.prisma.user.create({
            data: {
                email: profile.email.toLowerCase(),
                username,
                firstName: profile.given_name || '',
                lastName: profile.family_name || '',
                avatarUrl: profile.picture || null,
                oauthProvider: 'google',
                oauthProviderId: providerId,
                // No password for OAuth users
                passwordHash: null,
            },
        });

        this.logger.log(`Created new user from Google: ${user.email}`);
        return user;
    }

    /**
     * Create a one-time exchange code for frontend
     * (Reuses OAuthExchangeCode model - same as 42 OAuth)
     */
    async createExchangeCode(userId: string): Promise<string> {
        const code = crypto.randomBytes(32).toString('hex');
        const codeHash = await bcrypt.hash(code, this.saltRounds);

        // Delete any existing codes for this user
        await this.prisma.oAuthExchangeCode.deleteMany({
            where: { userId },
        });

        // Create new code with 60 second TTL
        await this.prisma.oAuthExchangeCode.create({
            data: {
                userId,
                codeHash,
                expiresAt: new Date(Date.now() + 60 * 1000),
            },
        });

        return code;
    }

    /**
     * Clean up expired states
     */
    private cleanupExpiredStates(): void {
        const now = Date.now();
        for (const [state, data] of this.stateStore.entries()) {
            if (data.expiresAt < now) {
                this.stateStore.delete(state);
            }
        }
    }
}
