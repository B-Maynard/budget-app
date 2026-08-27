import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BankImport } from './entities/bank-import.entity';
import { BankTransaction } from './entities/bank-transaction.entity';
import { CategoryLimit } from './entities/category-limit.entity';
import { CategoryRule } from './entities/category-rule.entity';
import { DescriptionObfuscation } from './entities/description-obfuscation.entity';
import { Debt } from './entities/debt.entity';
import { AiJob } from './entities/ai-job.entity';
import { ImportsService } from './imports.service';
import { CategorizationService } from './categorization.service';
import { BankingService } from './banking.service';
import { BankingController } from './banking.controller';
import { AuthService } from '../shared/auth.service';

@Module({
  imports: [TypeOrmModule.forFeature([BankImport, BankTransaction, CategoryLimit, CategoryRule, DescriptionObfuscation, Debt, AiJob])],
  controllers: [BankingController],
  providers: [ImportsService, CategorizationService, BankingService, AuthService],
})
export class BankingModule {}
