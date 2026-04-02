import { ClassSerializerInterceptor, Controller, Post, Body, UseInterceptors, UseGuards, Get, SerializeOptions, Param, NotFoundException, Patch, ForbiddenException, UploadedFile, ParseFilePipe, MaxFileSizeValidator, FileTypeValidator } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { CreateLocalUserDto } from './dto/create-local-user.dto';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { UserEntity } from './entities/user.entity';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { UpdateUserDto } from './dto/update-user.dto';
import { ErrorResponseDto } from 'src/common/dto/error-response.dto';
import { UserListItemDto } from './dto/user-list-item.dto';
import {
    ApiBadRequestResponse,
    ApiBody,
    ApiConsumes,
    ApiForbiddenResponse,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiTags,
    ApiUnauthorizedResponse,
} from '@nestjs/swagger';

@ApiTags('users')
@Controller('users')
@UseInterceptors(ClassSerializerInterceptor)
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Post()
    @ApiOperation({ summary: 'Create local user account' })
    @ApiBody({ type: CreateLocalUserDto })
    @ApiOkResponse({ type: UserEntity })
    @ApiBadRequestResponse({ description: 'Validation failed for signup payload', type: ErrorResponseDto })
    create(@Body() createLocalUserDto: CreateLocalUserDto) {
        return this.usersService.createLocalUser(createLocalUserDto);
    }

    @UseGuards(JwtAuthGuard)
    @Get()
    @ApiOperation({ summary: 'Get public users list (id and username)' })
    @ApiOkResponse({ type: [UserListItemDto] })
    @ApiUnauthorizedResponse({ description: 'Authentication required', type: ErrorResponseDto })
    getUsers() {
        return this.usersService.findAllPublicUsers();
    }

    @UseGuards(JwtAuthGuard)
    @Get('me')
    @SerializeOptions({ groups: ['self'] })
    @ApiOperation({ summary: 'Get current authenticated user profile' })
    @ApiOkResponse({ type: UserEntity })
    @ApiUnauthorizedResponse({ description: 'Authentication required', type: ErrorResponseDto })
    getProfile(@CurrentUser() user: UserEntity): UserEntity {
        return user;
    }

    @UseGuards(JwtAuthGuard)
    @Get(':id')
    @ApiOperation({ summary: 'Get user by id' })
    @ApiParam({ name: 'id', description: 'User UUID' })
    @ApiOkResponse({ type: UserEntity })
    @ApiUnauthorizedResponse({ description: 'Authentication required', type: ErrorResponseDto })
    @ApiNotFoundResponse({ description: 'User not found', type: ErrorResponseDto })
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
    @ApiUnauthorizedResponse({ description: 'Authentication required', type: ErrorResponseDto })
    @ApiForbiddenResponse({ description: 'Cannot update another user profile', type: ErrorResponseDto })
    @ApiBadRequestResponse({ description: 'Validation failed for update payload', type: ErrorResponseDto })
    async updateUser(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto, @CurrentUser() currentUser: UserEntity): Promise<UserEntity> {
        if (currentUser.id !== id) {
            throw new ForbiddenException(`You can only update your own profile`);
        }
        return this.usersService.updateUser(id, updateUserDto);
    }

    /** Upload a profile picture (max 5MB, images only) */
    @UseGuards(JwtAuthGuard)
    @Post(':id/avatar')
    @UseInterceptors(FileInterceptor('avatar'))
    @ApiOperation({ summary: 'Upload profile picture' })
    @ApiConsumes('multipart/form-data')
    @ApiParam({ name: 'id', description: 'User UUID' })
    @ApiBody({ schema: { type: 'object', properties: { avatar: { type: 'string', format: 'binary' } } } })
    @ApiOkResponse({ type: UserEntity })
    @ApiForbiddenResponse({ description: 'Cannot update another user profile', type: ErrorResponseDto })
    @ApiUnauthorizedResponse({ description: 'Authentication required', type: ErrorResponseDto })
    async uploadAvatar(
        @Param('id') id: string,
        @CurrentUser() currentUser: UserEntity,
        @UploadedFile(
            new ParseFilePipe({
                validators: [
                    new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
                    new FileTypeValidator({ fileType: /^image\/(jpeg|png|webp|gif)$/ }),
                ],
            }),
        )
        file: Express.Multer.File,
    ) {
        if (currentUser.id !== id) {
            throw new ForbiddenException('You can only update your own profile');
        }
        return this.usersService.updateAvatar(id, file);
    }
}
