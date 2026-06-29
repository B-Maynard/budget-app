import { IsNotEmpty, IsString } from "class-validator";

export class CreatePaydayDto {
    @IsString()
    @IsNotEmpty()
    date: string;
}
