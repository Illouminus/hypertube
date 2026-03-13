import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

import * as bcrypt from 'bcrypt';
import { CreateLocalUserDto } from './dto/create-local-user.dto';
import { UserEntity } from './entities/user.entity';

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
}
