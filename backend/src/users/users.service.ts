import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

import * as bcrypt from 'bcrypt';
import { CreateLocalUserDto } from './dto/create-local-user.dto';
import { UserEntity } from './entities/user.entity';
import { FortyTwoProfile } from 'src/auth/interfaces/fortytwo-profile.interface';
import { GoogleProfile } from 'src/auth/interfaces/google-profile.interface';

@Injectable()
export class UsersService {
    constructor(private prisma: PrismaService) {}


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
    
}
