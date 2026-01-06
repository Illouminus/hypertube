import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { FortyTwoOAuthService } from './fortytwo-oauth.service';
import { GoogleOAuthService } from './google-oauth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}), // Secrets are provided per-sign operation
    UsersModule,
    MailModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, FortyTwoOAuthService, GoogleOAuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule { }
