import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersService } from 'src/users/users.service';
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
    fortyTwoId: null,
    googleId: null,
    resetPasswordToken: null,
    resetPasswordExpires: null,
    createdAt: new Date('2026-03-13T10:00:00.000Z'),
    updatedAt: new Date('2026-03-13T10:00:00.000Z'),
  });

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let usersService: { findById: jest.Mock };
  let configService: { getOrThrow: jest.Mock };

  beforeEach(async () => {
    usersService = {
      findById: jest.fn(),
    };

    configService = {
      getOrThrow: jest.fn().mockReturnValue('test-secret'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: UsersService,
          useValue: usersService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
    expect(configService.getOrThrow).toHaveBeenCalledWith('JWT_SECRET');
  });

  describe('validate', () => {
    it('returns user entity when user exists', async () => {
      const user = createUser();
      usersService.findById.mockResolvedValue(user);

      const result = await strategy.validate({
        sub: 'user-id',
        email: 'jdoe@example.com',
      });

      expect(usersService.findById).toHaveBeenCalledWith('user-id');
      expect(result).toBeInstanceOf(UserEntity);
      expect(result.id).toBe('user-id');
    });

    it('throws UnauthorizedException when user does not exist', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(
        strategy.validate({ sub: 'missing-id', email: 'missing@example.com' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
