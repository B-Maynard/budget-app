import { IsInt, IsNotEmpty, IsNumber, IsString, Max, Min } from 'class-validator';

export class CreateDebtDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @Min(0)
  aprBps: number;

  @IsInt()
  @Min(0)
  startingBalanceCents: number;

  @IsInt()
  @Min(1)
  paymentAmountCents: number;

  @IsInt()
  @Min(1)
  @Max(28)
  paymentDay: number;
}
