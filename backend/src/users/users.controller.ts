import { ClassSerializerInterceptor, Controller, Post, Body, UseInterceptors, UseGuards, Get, Req, SerializeOptions, Param, NotFoundException, Patch, ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateLocalUserDto } from './dto/create-local-user.dto';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { UserEntity } from './entities/user.entity';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { UpdateUserDto } from './dto/update-user.dto';
import { ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

@ApiTags('users')
@Controller('users')
@UseInterceptors(ClassSerializerInterceptor)
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Post()
    @ApiOperation({ summary: 'Create local user account' })
    @ApiBody({ type: CreateLocalUserDto })
    @ApiOkResponse({ type: UserEntity })
    create(@Body() createLocalUserDto: CreateLocalUserDto) {
        return this.usersService.createLocalUser(createLocalUserDto);
    }

    @UseGuards(JwtAuthGuard)
    @Get('me')
    @SerializeOptions({ groups: ['self'] })
    @ApiOperation({ summary: 'Get current authenticated user profile' })
    @ApiOkResponse({ type: UserEntity })
    getProfile(@CurrentUser() user: UserEntity): UserEntity {
        return user;
    }

    @UseGuards(JwtAuthGuard)
    @Get(':id')
    @ApiOperation({ summary: 'Get user by id' })
    @ApiParam({ name: 'id', description: 'User UUID' })
    @ApiOkResponse({ type: UserEntity })
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
    @ApiOperation({ summary: 'Update own user profile' })
    @ApiParam({ name: 'id', description: 'User UUID' })
    @ApiBody({ type: UpdateUserDto })
    @ApiOkResponse({ type: UserEntity })
    async updateUser(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto, @CurrentUser() currentUser: UserEntity): Promise<UserEntity> {
        if (currentUser.id !== id) {
            throw new ForbiddenException(`You can only update your own profile`);
        }
        return this.usersService.updateUser(id, updateUserDto);
    }


}
