import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from '../shared/auth.service';
import { Debt } from '../banking/entities/debt.entity';
import { Bill } from '../bills/entities/bill.entity';
import { DebtsController } from './debts.controller';
import { DebtsService } from './debts.service';

@Module({
  imports: [TypeOrmModule.forFeature([Debt, Bill])],
  controllers: [DebtsController],
  providers: [DebtsService, AuthService],
  exports: [DebtsService],
})
export class DebtsModule {}
