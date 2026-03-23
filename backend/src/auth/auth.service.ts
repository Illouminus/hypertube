import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/users/users.service';

import * as bcrypt from 'bcrypt';
import { UserEntity } from 'src/users/entities/user.entity';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailService } from 'src/mail/mail.service';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
    constructor(
        private usersService: UsersService,
        private jwtService: JwtService,
        private prisma: PrismaService,
        private mailService: MailService,
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

    async forgotPassword(email: string): Promise<void> {
        const user = await this.usersService.findByEmail(email);

        // If user is local and exists, send reset password email // we don't authorise 42 and google users to reset password, as they don't have one
        if (user && user.password) {
            const resetToken = crypto.randomUUID();
            const tokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now
            await this.prisma.user.update({
                where: { id: user.id },
                data: {
                    resetPasswordToken: resetToken,
                    resetPasswordExpires: tokenExpiry,
                },
            });
            await this.mailService.sendPasswordResetEmail(user.email, resetToken);  
        }
    }


    async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<void> {
        const { token, newPassword } = resetPasswordDto;
        const user = await this.prisma.user.findFirst({
            where: {
                resetPasswordToken: token,
                resetPasswordExpires: {
                    gt: new Date(),
                },
            },
        });

        if (!user) {
            throw new UnauthorizedException('Invalid or expired reset token');
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                resetPasswordToken: null,
                resetPasswordExpires: null,
            },
        });
    }
}