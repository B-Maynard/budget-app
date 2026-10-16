import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateBillDto {
    @IsString()
    @IsNotEmpty()
    name: string;
  
    @IsNumber()
    @IsNotEmpty()
    price: number;

    @IsString()
    frequency?: string;

    @IsNumber()
    interval?: number;

    @IsNumber()
    dueDay?: number;

    @IsNumber()
    dueMonth?: number;

    @IsNumber()
    dueDayOfWeek?: number;

    paidDates?: string[];

    @IsOptional()
    @IsIn(['bill', 'debt'])
    tag?: string;
}
