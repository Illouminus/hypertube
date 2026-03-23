import { ClassSerializerInterceptor, Controller, Post, Body, UseInterceptors, UseGuards, Get, Req, SerializeOptions, Param, NotFoundException, Patch, ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateLocalUserDto } from './dto/create-local-user.dto';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { UserEntity } from './entities/user.entity';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
@UseInterceptors(ClassSerializerInterceptor)
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Post()
    create(@Body() createLocalUserDto: CreateLocalUserDto) {
        return this.usersService.createLocalUser(createLocalUserDto);
    }

    @UseGuards(JwtAuthGuard)
    @Get('me')
    @SerializeOptions({ groups: ['self'] })
    getProfile(@CurrentUser() user: UserEntity): UserEntity {
        return user;
    }

    @UseGuards(JwtAuthGuard)
    @Get(':id')
    async getUserById(@Param('id') id: string, @CurrentUser() currentUser: UserEntity): Promise<UserEntity> {
        const user = await this.usersService.findById(id);

        if (!user) {
            throw new NotFoundException(`User with ID ${id} not found`); // Throw a 404 error if the user is not found
        }

        if(currentUser.id === user.id) {
            return Object.assign(user, { userEmail: user.email });
        }
        return user;

    }

    @UseGuards(JwtAuthGuard)
    @Patch(':id')
    async updateUser(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto, @CurrentUser() currentUser: UserEntity): Promise<UserEntity> {
        if (currentUser.id !== id) {
            throw new ForbiddenException(`You can only update your own profile`);
        }
        return this.usersService.updateUser(id, updateUserDto);
    }


}
