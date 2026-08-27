import { IsInt, IsString, Min } from 'class-validator';
export class SetCategoryLimitDto { @IsString() category: string; @IsInt() @Min(1) limitCents: number; }
