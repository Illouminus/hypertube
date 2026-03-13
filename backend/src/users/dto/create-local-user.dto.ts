import { IsString, MinLength } from "class-validator";
import { CreateBaseUserDto } from "./create-base-user.dto";


export class CreateLocalUserDto extends CreateBaseUserDto {
    @IsString()
    @MinLength(6, { message: 'Password must be at least 6 characters long' })
    password: string;
}