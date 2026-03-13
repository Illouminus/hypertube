import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserEntity } from './entities/user.entity';

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

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: { createLocalUser: jest.Mock };

  beforeEach(async () => {
    usersService = {
      createLocalUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: usersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('delegates user creation to service', async () => {
      const user = createUser();
      usersService.createLocalUser.mockResolvedValue(user);

      const dto = {
        username: 'jdoe',
        email: 'jdoe@example.com',
        firstName: 'John',
        lastName: 'Doe',
        password: 'password123',
      };

      const result = await controller.create(dto);

      expect(usersService.createLocalUser).toHaveBeenCalledWith(dto);
      expect(result).toEqual(user);
    });
  });

  describe('getProfile', () => {
    it('returns current user from request context', () => {
      const user = createUser();

      const result = controller.getProfile(user);

      expect(result).toBe(user);
    });
  });
});
