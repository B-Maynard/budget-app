import { IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateDebtDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  aprBps?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  startingBalanceCents?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  currentBalanceCents?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  paymentAmountCents?: number;

  @IsInt()
  @Min(1)
  @Max(28)
  @IsOptional()
  paymentDay?: number;
}
