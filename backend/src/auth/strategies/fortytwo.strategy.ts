import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-42';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { FortyTwoProfile } from '../interfaces/fortytwo-profile.interface';
import { UserEntity } from '../../users/entities/user.entity';

@Injectable()
export class FortyTwoStrategy extends PassportStrategy(Strategy, '42') {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      clientID: configService.get<string>('FORTYTWO_CLIENT_ID'),
      clientSecret: configService.get<string>('FORTYTWO_CLIENT_SECRET'),
      callbackURL: configService.get<string>('FORTYTWO_REDIRECT_URI'),
    
      profileFields: {
        id: function (obj) { return String(obj.id); },
        username: 'login',
        displayName: 'displayname',
        'name.familyName': 'last_name',
        'name.givenName': 'first_name',
        profileUrl: 'url',
        'emails.0.value': 'email',
        'phoneNumbers.0.value': 'phone',
        'photos.0.value': 'image.link'
      }
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: FortyTwoProfile): Promise<UserEntity> {
    const user = await this.usersService.findOrCreateFortyTwoUser(profile);
    return user; 
  }
}