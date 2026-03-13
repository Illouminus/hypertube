import { ClassSerializerInterceptor, Controller, Post, Body, UseInterceptors, UseGuards, Get, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateLocalUserDto } from './dto/create-local-user.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { UserEntity } from './entities/user.entity';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';

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
    getProfile(@CurrentUser() user: UserEntity): UserEntity {
        return user;
    }
}
