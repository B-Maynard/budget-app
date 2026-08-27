import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiJob } from '../banking/entities/ai-job.entity';
import { BankTransaction } from '../banking/entities/bank-transaction.entity';
import { CategoryLimit } from '../banking/entities/category-limit.entity';
import { DescriptionObfuscation } from '../banking/entities/description-obfuscation.entity';
import { Debt } from '../banking/entities/debt.entity';
import { DebtsModule } from '../debts/debts.module';
import { AuthService } from '../shared/auth.service';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';

@Module({
  imports: [TypeOrmModule.forFeature([AiJob, BankTransaction, CategoryLimit, DescriptionObfuscation, Debt]), DebtsModule],
  controllers: [AnalysisController],
  providers: [AnalysisService, AuthService],
  exports: [DebtsModule],
})
export class AnalysisModule {}
