// ponytail: hardcoded synchronize: false; migrations are the only path to a usable schema
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Bill } from './bills/entities/bill.entity';
import { Payday } from './paydays/entities/payday.entity';
import { AppConfig } from './config/entities/app-config.entity';

export default new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT, 10) || 5432,
  username: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgrespassword',
  database: process.env.POSTGRES_DB || 'budget_app',
  entities: [Bill, Payday, AppConfig],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  synchronize: false,
});
