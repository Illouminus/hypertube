import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
} from '@nestjs/common';
import { UsersService, SafeUser, PublicUser } from './users.service';
import { UpdateProfileDto } from './dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Get current user's profile (includes email)
   * GET /users/me
   */
  @Get('me')
  @HttpCode(HttpStatus.OK)
  async getMe(@CurrentUser('id') userId: string): Promise<SafeUser> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.usersService.toSafeUser(user);
  }

  /**
   * Update current user's profile
   * PATCH /users/me
   */
  @Patch('me')
  @HttpCode(HttpStatus.OK)
  async updateMe(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<SafeUser> {
    const updatedUser = await this.usersService.updateProfile(userId, dto);
    return this.usersService.toSafeUser(updatedUser);
  }

  /**
   * Get public user profile (excludes email)
   * GET /users/:id
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getPublicProfile(@Param('id') id: string): Promise<PublicUser> {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.usersService.toPublicUser(user);
  }
}
