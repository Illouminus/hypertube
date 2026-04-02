import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { randomUUID } from 'node:crypto';

import * as bcrypt from 'bcrypt';
import { CreateLocalUserDto } from './dto/create-local-user.dto';
import { UserEntity } from './entities/user.entity';
import { FortyTwoProfile } from 'src/auth/interfaces/fortytwo-profile.interface';
import { GoogleProfile } from 'src/auth/interfaces/google-profile.interface';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserListItemDto } from './dto/user-list-item.dto';

@Injectable()
export class UsersService {
    private readonly uploadsDir = join(process.cwd(), '..', 'uploads', 'avatars');

    constructor(
        private prisma: PrismaService,
        private configService: ConfigService,
    ) {}

    async findAllPublicUsers(): Promise<UserListItemDto[]> {
        const users = await this.prisma.user.findMany({
            select: {
                id: true,
                username: true,
            },
            orderBy: {
                username: 'asc',
            },
        });

        return users.map((user) => new UserListItemDto(user));
    }


    async createLocalUser(createUserDto: CreateLocalUserDto) {
        const { username, email, firstName, lastName, password } = createUserDto;
        
        // Check if the user already exists
        const existingUser = await this.prisma.user.findFirst({
            where: {
                OR: [
                    { username },
                    { email }
                ]
            }
        });

        if (existingUser) {
            throw new ConflictException('User with this username or email already exists');
        }

        // Create the new user
        // Hash the password before saving

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Create the new user
        const newUser = await this.prisma.user.create({
            data: {
                username,
                email,
                firstName,
                lastName,
                password: hashedPassword
            }
        });

        return new UserEntity(newUser);
    }

    async findByEmail(email: string): Promise<UserEntity | null> {
        const user = await this.prisma.user.findUnique({
            where: { email },
        });

        return user ? new UserEntity(user) : null;
    }

    async findById(id: string): Promise<UserEntity | null> {
        const user = await this.prisma.user.findUnique({
            where: { id },
        });

        return user ? new UserEntity(user) : null;
    }

    async findOrCreateFortyTwoUser(profile: FortyTwoProfile): Promise<UserEntity> {
        const fortyTwoId = profile.id.toString();
        const email = profile.emails[0].value;

        // Try to find an existing user with the same 42 ID or email
        let user = await this.prisma.user.findUnique({
            where: {fortyTwoId},
        });

        if(user) {
            return new UserEntity(user);
        }

        // If user with the 42 ID doesn't exist, check if there's a user with the same email (to link accounts)
        user = await this.prisma.user.findUnique({
            where: { email },
        });

        if(user) {
            user = await this.prisma.user.update({
                where: {id: user.id},
                data: {fortyTwoId}
            });
            return new UserEntity(user);
        }

        // We should protect the case if the username is already taken  by some local profile 
        let finalUsername = profile.username;
        const existingUsername = await this.prisma.user.findUnique({
            where: { username: finalUsername },
        });
        if(existingUsername) {
            finalUsername = `${profile.username}_42_${Math.floor(Math.random() * 1000)}`;
        }


        // If no user exists with the 42 ID or email, create a new user
        const newUser = await this.prisma.user.create({
            data: {
                username: finalUsername,
                email,
                firstName: profile.name.givenName,
                lastName: profile.name.familyName,
                fortyTwoId,
                profilePictureUrl: profile.photos[0]?.value || 'https://default-avatar.com/avatar.png',
            }
        });

        return new UserEntity(newUser);
    }

    async findOrCreateGoogleUser(profile: GoogleProfile): Promise<UserEntity> {
        const googleId = profile.id;
        const email = profile.emails[0].value;

        // Try to find an existing user with the same Google ID or email
        let user = await this.prisma.user.findUnique({
            where: {googleId},
        });

        if(user) {
            return new UserEntity(user);
        }

        // If user with the Google ID doesn't exist, check if there's a user with the same email (to link accounts)
        user = await this.prisma.user.findUnique({
            where: { email },
        });

        if(user) {
            user = await this.prisma.user.update({
                where: {id: user.id},
                data: {googleId}
            });
            return new UserEntity(user);
        }

        // Google doesn't provide a username, so we need to generate one based on the email or name
        let baseUsername = profile.name?.givenName || email.split('@')[0];
        let finalUsername = baseUsername;
        const existingUsername = await this.prisma.user.findUnique({
            where: { username: finalUsername },
        });
        if(existingUsername) {
            finalUsername = `${baseUsername}_google_${Math.floor(Math.random() * 1000)}`;
        }

        // If no user exists with the Google ID or email, create a new user
        const newUser = await this.prisma.user.create({
            data: {
                username: finalUsername,
                email,
                firstName: profile.name?.givenName || '',
                lastName: profile.name?.familyName || '',
                googleId,
                profilePictureUrl: profile.photos[0]?.value || 'https://default-avatar.com/avatar.png',
            }
        });

        return new UserEntity(newUser);
    }

    async updateUser(id: string, updateUserDTO: UpdateUserDto): Promise<UserEntity> {
        const { username, email, password, ...restData } = updateUserDTO;    

        // Should verify if email and username are not already taken by another user
        if (email || username) {
            const existingUser = await this.prisma.user.findFirst({
                where: {
                    OR: [
                        email ? { email } : {},
                        username ? { username } : {},
                    ],
                    NOT: { id }, // Exclude the current user from the search
                },
            });

            if (existingUser) {
                throw new ConflictException('Email or username is already in use by another account');
            }
        }

        let hashedPassword: string | undefined;
        if (password) {
            const saltRounds = 10;
            hashedPassword = await bcrypt.hash(password, saltRounds);
        }

        const updatedUser = await this.prisma.user.update({
            where: { id },
            data: {
                ...restData,
                ...(email && { email }),
                ...(username && { username }),
                ...(hashedPassword && { password: hashedPassword }),
            },
        });

        return new UserEntity(updatedUser);
    }

    /** Save uploaded avatar to disk and update the user's profilePictureUrl */
    async updateAvatar(userId: string, file: Express.Multer.File): Promise<UserEntity> {
        await mkdir(this.uploadsDir, { recursive: true });

        // Delete the previous avatar file if it was a local upload
        const currentUser = await this.prisma.user.findUnique({ where: { id: userId }, select: { profilePictureUrl: true } });
        if (currentUser?.profilePictureUrl?.includes('/uploads/avatars/')) {
            const oldFilename = currentUser.profilePictureUrl.split('/uploads/avatars/').pop();
            if (oldFilename) {
                await rm(join(this.uploadsDir, oldFilename), { force: true }).catch(() => {});
            }
        }

        const ext = extname(file.originalname) || '.jpg';
        const filename = `${randomUUID()}${ext}`;
        const filePath = join(this.uploadsDir, filename);

        await writeFile(filePath, file.buffer);

        const baseUrl = this.configService.get<string>('NEXT_PUBLIC_API_URL', 'http://localhost:3001');
        const profilePictureUrl = `${baseUrl}/uploads/avatars/${filename}`;

        const updatedUser = await this.prisma.user.update({
            where: { id: userId },
            data: { profilePictureUrl },
        });

        return new UserEntity(updatedUser);
    }
}
