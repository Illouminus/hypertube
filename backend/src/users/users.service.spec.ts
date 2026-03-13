import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserEntity } from './entities/user.entity';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
}));

const createPrismaUser = (overrides: Partial<UserEntity> = {}) => ({
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
  ...overrides,
});

describe('UsersService', () => {
  let service: UsersService;
  let prismaService: {
    user: {
      findFirst: jest.Mock;
      create: jest.Mock;
      findUnique: jest.Mock;
    };
  };

  beforeEach(async () => {
    prismaService = {
      user: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createLocalUser', () => {
    const createLocalUserDto = {
      username: 'jdoe',
      email: 'jdoe@example.com',
      firstName: 'John',
      lastName: 'Doe',
      password: 'password123',
    };

    it('throws ConflictException when username or email already exists', async () => {
      prismaService.user.findFirst.mockResolvedValue(createPrismaUser());

      await expect(service.createLocalUser(createLocalUserDto)).rejects.toThrow(
        ConflictException,
      );
      expect(prismaService.user.create).not.toHaveBeenCalled();
    });

    it('creates user with hashed password and returns UserEntity', async () => {
      prismaService.user.findFirst.mockResolvedValue(null);
      const mockHash = bcrypt.hash as jest.Mock;
      mockHash.mockResolvedValue('hashed-value');
      prismaService.user.create.mockResolvedValue(
        createPrismaUser({ password: 'hashed-value' }),
      );

      const result = await service.createLocalUser(createLocalUserDto);

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: {
          username: 'jdoe',
          email: 'jdoe@example.com',
          firstName: 'John',
          lastName: 'Doe',
          password: 'hashed-value',
        },
      });
      expect(result).toBeInstanceOf(UserEntity);
      expect(result.email).toBe('jdoe@example.com');
    });
  });

  describe('findByEmail', () => {
    it('returns UserEntity when user exists', async () => {
      prismaService.user.findUnique.mockResolvedValue(createPrismaUser());

      const result = await service.findByEmail('jdoe@example.com');

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'jdoe@example.com' },
      });
      expect(result).toBeInstanceOf(UserEntity);
    });

    it('returns null when user does not exist', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.findByEmail('missing@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('returns UserEntity when user exists', async () => {
      prismaService.user.findUnique.mockResolvedValue(createPrismaUser());

      const result = await service.findById('user-id');

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-id' },
      });
      expect(result).toBeInstanceOf(UserEntity);
    });

    it('returns null when user does not exist', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.findById('missing-id');

      expect(result).toBeNull();
    });
  });
});
