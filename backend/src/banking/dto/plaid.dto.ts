import {
  IsDateString,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class ExchangePlaidTokenDto {
  @IsString() @IsNotEmpty() @MaxLength(512) publicToken: string;
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  importStartDate: string;
}
