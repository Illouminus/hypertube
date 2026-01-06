import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';

// 42 API response types
interface FortyTwoTokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token: string;
    scope: string;
    created_at: number;
}

interface FortyTwoUserProfile {
    id: number;
    email: string;
    login: string;
    first_name: string;
    last_name: string;
    image: {
        link: string;
        versions: {
            large: string;
            medium: string;
            small: string;
            micro: string;
        };
    };
}

@Injectable()
export class FortyTwoOAuthService {
    private readonly logger = new Logger(FortyTwoOAuthService.name);
    private readonly clientId: string;
    private readonly clientSecret: string;
    private readonly redirectUri: string;
    private readonly saltRounds = 12;

    // In-memory state storage (in production, use Redis or DB)
    private stateStore = new Map<string, { expiresAt: number }>();

    constructor(
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
    ) {
        this.clientId = this.configService.get<string>('FORTYTWO_CLIENT_ID', '');
        this.clientSecret = this.configService.get<string>('FORTYTWO_CLIENT_SECRET', '');
        this.redirectUri = this.configService.get<string>(
            'FORTYTWO_REDIRECT_URI',
            'http://localhost:3001/auth/42/callback',
        );

        if (!this.clientId || !this.clientSecret) {
            this.logger.warn('42 OAuth credentials not configured');
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
            scope: 'public',
            state,
        });

        const url = `https://api.intra.42.fr/oauth/authorize?${params.toString()}`;

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
        const response = await fetch('https://api.intra.42.fr/oauth/token', {
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
            this.logger.error(`Failed to exchange code for token: ${error}`);
            throw new UnauthorizedException('Failed to authenticate with 42');
        }

        const data: FortyTwoTokenResponse = await response.json();
        return data.access_token;
    }

    /**
     * Fetch user profile from 42 API
     */
    async getUserProfile(accessToken: string): Promise<FortyTwoUserProfile> {
        const response = await fetch('https://api.intra.42.fr/v2/me', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            const error = await response.text();
            this.logger.error(`Failed to fetch 42 user profile: ${error}`);
            throw new UnauthorizedException('Failed to get user profile from 42');
        }

        return response.json();
    }

    /**
     * Find existing user or create new one from 42 profile
     */
    async findOrCreateUser(profile: FortyTwoUserProfile): Promise<User> {
        const providerId = profile.id.toString();

        // First, try to find by OAuth provider
        let user = await this.prisma.user.findFirst({
            where: {
                oauthProvider: '42',
                oauthProviderId: providerId,
            },
        });

        if (user) {
            this.logger.log(`Found existing 42 user: ${user.email}`);
            return user;
        }

        // Try to find by email and link account
        user = await this.prisma.user.findUnique({
            where: { email: profile.email.toLowerCase() },
        });

        if (user) {
            // Link 42 account to existing user
            user = await this.prisma.user.update({
                where: { id: user.id },
                data: {
                    oauthProvider: '42',
                    oauthProviderId: providerId,
                    avatarUrl: user.avatarUrl || profile.image?.versions?.medium || profile.image?.link,
                },
            });
            this.logger.log(`Linked 42 account to existing user: ${user.email}`);
            return user;
        }

        // Create new user
        // Generate unique username from 42 login
        let username = profile.login;
        let suffix = 0;
        while (await this.prisma.user.findUnique({ where: { username } })) {
            suffix++;
            username = `${profile.login}${suffix}`;
        }

        user = await this.prisma.user.create({
            data: {
                email: profile.email.toLowerCase(),
                username,
                firstName: profile.first_name || '',
                lastName: profile.last_name || '',
                avatarUrl: profile.image?.versions?.medium || profile.image?.link || null,
                oauthProvider: '42',
                oauthProviderId: providerId,
                // No password for OAuth users
                passwordHash: null,
            },
        });

        this.logger.log(`Created new user from 42: ${user.email}`);
        return user;
    }

    /**
     * Create a one-time exchange code for frontend
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
     * Consume exchange code and return user ID
     */
    async consumeExchangeCode(code: string): Promise<string> {
        // Find all valid (non-expired, unused) codes
        const validCodes = await this.prisma.oAuthExchangeCode.findMany({
            where: {
                expiresAt: { gt: new Date() },
                usedAt: null,
            },
        });

        // Find matching code by comparing hashes
        for (const exchangeCode of validCodes) {
            const isMatch = await bcrypt.compare(code, exchangeCode.codeHash);
            if (isMatch) {
                // Mark as used
                await this.prisma.oAuthExchangeCode.update({
                    where: { id: exchangeCode.id },
                    data: { usedAt: new Date() },
                });
                return exchangeCode.userId;
            }
        }

        throw new UnauthorizedException('Invalid or expired exchange code');
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
