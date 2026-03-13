import { ClassSerializerInterceptor, Controller, Post, Body, UseInterceptors } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateLocalUserDto } from './dto/create-local-user.dto';

@Controller('users')
@UseInterceptors(ClassSerializerInterceptor)
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Post()
    create(@Body() CreateLocalUserDto: CreateLocalUserDto) {
        return this.usersService.createLocalUser(CreateLocalUserDto);
    }
}
