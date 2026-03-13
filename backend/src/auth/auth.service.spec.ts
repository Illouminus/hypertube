import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from 'src/users/users.service';
import { UserEntity } from 'src/users/entities/user.entity';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

const createUser = (overrides: Partial<UserEntity> = {}) =>
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
    ...overrides,
  });

describe('AuthService', () => {
  let service: AuthService;
  let usersService: { findByEmail: jest.Mock };
  let jwtService: { sign: jest.Mock };

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn(),
    };

    jwtService = {
      sign: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: usersService,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('returns user when credentials are valid', async () => {
      const user = createUser();
      usersService.findByEmail.mockResolvedValue(user);
      const mockCompare = bcrypt.compare as jest.Mock;
      mockCompare.mockResolvedValue(true);

      const result = await service.validateUser('jdoe@example.com', 'password123');

      expect(usersService.findByEmail).toHaveBeenCalledWith('jdoe@example.com');
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashed-password');
      expect(result).toBeInstanceOf(UserEntity);
      expect(result.id).toBe('user-id');
    });

    it('throws UnauthorizedException when user is not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.validateUser('missing@example.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when user has no password', async () => {
      const oauthUser = createUser({ password: null });
      usersService.findByEmail.mockResolvedValue(oauthUser);

      await expect(
        service.validateUser('jdoe@example.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when password does not match', async () => {
      const user = createUser();
      usersService.findByEmail.mockResolvedValue(user);
      const mockCompare = bcrypt.compare as jest.Mock;
      mockCompare.mockResolvedValue(false);

      await expect(
        service.validateUser('jdoe@example.com', 'wrong-password'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login', () => {
    it('returns signed access token', async () => {
      jwtService.sign.mockReturnValue('signed-token');
      const user = createUser();

      const result = await service.login(user);

      expect(jwtService.sign).toHaveBeenCalledWith({
        email: 'jdoe@example.com',
        sub: 'user-id',
      });
      expect(result).toEqual({ access_token: 'signed-token' });
    });
  });
});
