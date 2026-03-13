import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/users/users.service';

import * as bcrypt from 'bcrypt';
import { UserEntity } from 'src/users/entities/user.entity';

@Injectable()
export class AuthService {
    constructor(
        private usersService: UsersService,
        private jwtService: JwtService
    ) {}

    // Check user credentials and return a UserEntity, or throw UnauthorizedException
    async validateUser(email: string, password: string): Promise<UserEntity> {
        const user = await this.usersService.findByEmail(email);

        // we should ignore the users logged with oauth for now, as they don't have a password
        if(user && user.password) {
            const isMath = await bcrypt.compare(password, user.password);
            if (isMath) {
                return new UserEntity(user);
            }
        }
        throw new UnauthorizedException('Invalid credentials');
    }


    async login(user: UserEntity): Promise<{ access_token: string }> {
        const payload = { email: user.email, sub: user.id };
        return {
            access_token: this.jwtService.sign(payload),
        };
    }
}