import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// User data returned to clients (excludes sensitive fields)
export type SafeUser = Omit<User, 'passwordHash' | 'refreshTokenHash'>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find a user by their unique ID
   */
  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * Find a user by email (case-insensitive)
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  /**
   * Find a user by username (case-insensitive)
   */
  async findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        username: {
          equals: username,
          mode: 'insensitive',
        },
      },
    });
  }

  /**
   * Find a user by email or username (for login)
   */
  async findByEmailOrUsername(identifier: string): Promise<User | null> {
    const normalizedIdentifier = identifier.toLowerCase();

    return this.prisma.user.findFirst({
      where: {
        OR: [
          { email: normalizedIdentifier },
          {
            username: {
              equals: identifier,
              mode: 'insensitive',
            },
          },
        ],
      },
    });
  }

  /**
   * Create a new user
   */
  async create(data: {
    email: string;
    username: string;
    passwordHash: string;
  }): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        username: data.username,
        passwordHash: data.passwordHash,
      },
    });
  }

  /**
   * Update a user's refresh token hash
   */
  async updateRefreshTokenHash(
    userId: string,
    refreshTokenHash: string | null,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash },
    });
  }

  /**
   * Update a user's password
   */
  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        refreshTokenHash: null, // Invalidate all sessions on password change
      },
    });
  }

  /**
   * Check if email is already taken
   */
  async isEmailTaken(email: string): Promise<boolean> {
    const user = await this.findByEmail(email);
    return user !== null;
  }

  /**
   * Check if username is already taken
   */
  async isUsernameTaken(username: string): Promise<boolean> {
    const user = await this.findByUsername(username);
    return user !== null;
  }

  /**
   * Remove sensitive fields from user object
   */
  toSafeUser(user: User): SafeUser {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, refreshTokenHash, ...safeUser } = user;
    return safeUser;
  }
}
