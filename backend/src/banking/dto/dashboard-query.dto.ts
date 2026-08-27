import { IsOptional, IsString, Matches } from 'class-validator';
export class DashboardQuery { @IsOptional() @IsString() startDate?: string; @IsOptional() @IsString() endDate?: string; @IsOptional() @Matches(/^\d{4}-\d{2}$/) month?: string; @IsOptional() @IsString() category?: string; @IsOptional() @IsString() search?: string; }
