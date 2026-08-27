import { IsIn } from 'class-validator';
import { BANKING_CATEGORIES } from '../banking.constants';
export class UpdateTransactionCategoryDto { @IsIn(BANKING_CATEGORIES) category: string; }
