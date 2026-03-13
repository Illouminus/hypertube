import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
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

  beforeEach(async () => {
    authService = {
      validateUser: jest.fn(),
      login: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('validates credentials and returns access token', async () => {
      const user = createUser();
      authService.validateUser.mockResolvedValue(user);
      authService.login.mockResolvedValue({ access_token: 'signed-token' });

      const result = await controller.login({
        email: 'jdoe@example.com',
        password: 'password123',
      });

      expect(authService.validateUser).toHaveBeenCalledWith(
        'jdoe@example.com',
        'password123',
      );
      expect(authService.login).toHaveBeenCalledWith(user);
      expect(result).toEqual({ access_token: 'signed-token' });
    });

    it('propagates UnauthorizedException from service', async () => {
      authService.validateUser.mockRejectedValue(
        new UnauthorizedException('Invalid credentials'),
      );

      await expect(
        controller.login({ email: 'jdoe@example.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
