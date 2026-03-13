import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { UsersService } from '../../users/users.service';
import { UserEntity } from '../../users/entities/user.entity';
import type { Request } from 'express';

const cookieExtractor = (req: Request): string | null => {
  if (!req || !req.cookies) {
    return null;
  }
  return req.cookies['access_token'] ?? null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false, // Refuse expired tokens
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'), // Secret key for signature verification
    });
  }

  // This method is called by Passport after it has decoded and verified the JWT token.
  // The "payload" parameter contains the decoded JWT payload (the data we signed, like email and user ID).
  async validate(payload: JwtPayload): Promise<UserEntity> {
    // Find the user in the database using the ID from the JWT payload
    const user = await this.usersService.findById(payload.sub);
    
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    // If the user exists, return a UserEntity instance. This will be attached to the request object as "req.user" for use in controllers.
    return new UserEntity(user);
  }
}