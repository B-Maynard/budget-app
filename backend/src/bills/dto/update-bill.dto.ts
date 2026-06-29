import { PartialType } from '@nestjs/mapped-types';
import { CreateBillDto } from './create-bill.dto';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateBillDto extends PartialType(CreateBillDto) {
    @IsString()
    @IsOptional()
    name?: string;
  
    @IsNumber()
    @IsOptional()
    price?: number;
}
