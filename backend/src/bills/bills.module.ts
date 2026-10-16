import { Module } from '@nestjs/common';
import { BillsService } from './bills.service';
import { BillsController } from './bills.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bill } from './entities/bill.entity';
import { Debt } from '../banking/entities/debt.entity';
import { AuthService } from 'src/shared/auth.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Bill, Debt])
  ],
  controllers: [BillsController],
  providers: [BillsService, AuthService],
})
export class BillsModule {}
