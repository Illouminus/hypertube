import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserEntity } from 'src/users/entities/user.entity';

const createUser = () =>
  new UserEntity({
    id: 'user-id',
    username: 'jdoe',
    email: 'jdoe@example.com',
    firstName: 'John',
    lastName: 'Doe',
    password: 'hashed-password',
    profilePictureUrl: 'https://default-avatar.com/avatar.png',
    preferredLanguage: 'en',
    fortytwoId: null,
    googleId: null,
    resetPasswordToken: null,
    resetPasswordExpires: null,
    createdAt: new Date('2026-03-13T10:00:00.000Z'),
    updatedAt: new Date('2026-03-13T10:00:00.000Z'),
  });

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    validateUser: jest.Mock;
    login: jest.Mock;
  };
  let configService: {
    get: jest.Mock;
  };

  beforeEach(async () => {
    authService = {
      validateUser: jest.fn(),
      login: jest.fn(),
    };

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'NODE_ENV') return 'test';
        if (key === 'FRONTEND_URL') return 'http://localhost:3000';
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('validates credentials, sets cookie and returns success', async () => {
      const user = createUser();
      const res = { cookie: jest.fn() } as any;
      authService.validateUser.mockResolvedValue(user);
      authService.login.mockResolvedValue({ access_token: 'signed-token' });

      const result = await controller.login(
        {
          email: 'jdoe@example.com',
          password: 'password123',
        },
        res,
      );

      expect(authService.validateUser).toHaveBeenCalledWith(
        'jdoe@example.com',
        'password123',
      );
      expect(authService.login).toHaveBeenCalledWith(user);
      expect(res.cookie).toHaveBeenCalledWith('access_token', 'signed-token', {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 60 * 60 * 1000,
        path: '/',
      });
      expect(result).toEqual({ success: true });
    });

    it('propagates UnauthorizedException from service', async () => {
      authService.validateUser.mockRejectedValue(
        new UnauthorizedException('Invalid credentials'),
      );

      await expect(
        controller.login(
          { email: 'jdoe@example.com', password: 'wrong' },
          { cookie: jest.fn() } as any,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('clears access token cookie and returns success', async () => {
      const res = { clearCookie: jest.fn() } as any;

      const result = await controller.logout(res);

      expect(res.clearCookie).toHaveBeenCalledWith('access_token', {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/',
      });
      expect(result).toEqual({ success: true });
    });
  });

  describe('fortyTwoAuthRedirect', () => {
    it('sets cookie and returns frontend redirect url', async () => {
      const user = createUser();
      const res = { cookie: jest.fn() } as any;
      authService.login.mockResolvedValue({ access_token: 'oauth-token' });

      const result = await controller.fortyTwoAuthRedirect(user, res);

      expect(authService.login).toHaveBeenCalledWith(user);
      expect(res.cookie).toHaveBeenCalledWith('access_token', 'oauth-token', {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 60 * 60 * 1000,
        path: '/',
      });
      expect(result).toEqual({ url: 'http://localhost:3000/login/success' });
    });
  });
});
