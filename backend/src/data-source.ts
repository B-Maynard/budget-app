// ponytail: hardcoded synchronize: false; migrations are the only path to a usable schema
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Bill } from './bills/entities/bill.entity';
import { Payday } from './paydays/entities/payday.entity';
import { AppConfig } from './config/entities/app-config.entity';
import { BankImport } from './banking/entities/bank-import.entity';
import { BankTransaction } from './banking/entities/bank-transaction.entity';
import { CategoryLimit } from './banking/entities/category-limit.entity';
import { CategoryRule } from './banking/entities/category-rule.entity';
import { DescriptionObfuscation } from './banking/entities/description-obfuscation.entity';
import { Debt } from './banking/entities/debt.entity';
import { AiJob } from './banking/entities/ai-job.entity';

export default new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT, 10) || 5432,
  username: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgrespassword',
  database: process.env.POSTGRES_DB || 'budget_app',
  entities: [Bill, Payday, AppConfig, BankImport, BankTransaction, CategoryLimit, CategoryRule, DescriptionObfuscation, Debt, AiJob],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  synchronize: false,
});
