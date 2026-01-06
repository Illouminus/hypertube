import { IsNotEmpty, IsString } from 'class-validator';

export class ExchangeCodeDto {
    @IsString()
    @IsNotEmpty({ message: 'Exchange code is required' })
    code!: string;
}
