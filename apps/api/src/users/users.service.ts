import { Injectable, ConflictException } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto';

// User data returned to clients (excludes sensitive fields)
export type SafeUser = Omit<User, 'passwordHash' | 'refreshTokenHash'>;

// Public user profile (excludes email and other sensitive data)
export type PublicUser = Pick<
  User,
  'id' | 'username' | 'firstName' | 'lastName' | 'avatarUrl' | 'language' | 'createdAt'
>;

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
    firstName: string;
    lastName: string;
  }): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        username: data.username,
        passwordHash: data.passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        language: 'en', // Default language
      },
    });
  }

  /**
   * Update user profile
   */
  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check email uniqueness if changing
    if (dto.email && dto.email.toLowerCase() !== user.email) {
      const existingEmail = await this.findByEmail(dto.email);
      if (existingEmail) {
        throw new ConflictException('Email is already in use');
      }
    }

    // Check username uniqueness if changing
    if (dto.username && dto.username.toLowerCase() !== user.username.toLowerCase()) {
      const existingUsername = await this.findByUsername(dto.username);
      if (existingUsername) {
        throw new ConflictException('Username is already taken');
      }
    }

    // Build update data (only include provided fields)
    const updateData: Partial<User> = {};
    if (dto.email !== undefined) updateData.email = dto.email.toLowerCase();
    if (dto.username !== undefined) updateData.username = dto.username;
    if (dto.firstName !== undefined) updateData.firstName = dto.firstName;
    if (dto.lastName !== undefined) updateData.lastName = dto.lastName;
    if (dto.language !== undefined) updateData.language = dto.language;
    if (dto.avatarUrl !== undefined) updateData.avatarUrl = dto.avatarUrl;

    return this.prisma.user.update({
      where: { id: userId },
      data: updateData,
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

  /**
   * Convert user to public profile (no email, no sensitive data)
   */
  toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      language: user.language,
      createdAt: user.createdAt,
    };
  }
}
