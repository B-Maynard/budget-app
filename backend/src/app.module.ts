import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BillsModule } from './bills/bills.module';
import { PaydaysModule } from './paydays/paydays.module';
import { AppConfigModule } from './config/app-config.module';
import dataSource from './data-source';
import { BankingModule } from './banking/banking.module';
import { DebtsModule } from './debts/debts.module';
import { AnalysisModule } from './analysis/analysis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({ ...dataSource.options }),
    BillsModule,
    PaydaysModule,
    AppConfigModule,
    BankingModule,
    DebtsModule,
    AnalysisModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
