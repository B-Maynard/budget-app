import { Repository } from 'typeorm';
import { BankConnection } from './entities/bank-connection.entity';
import { BankTransaction } from './entities/bank-transaction.entity';

/** Keep Sandbox samples out of the real budget while retaining CSV history. */
export function currentTransactions(repository: Repository<BankTransaction>) {
  return repository
    .createQueryBuilder('t')
    .leftJoin('t.import', 'source')
    .leftJoin(BankConnection, 'bank', 'bank.id = source.bank_connection_id')
    .where(
      '(source.bank_connection_id IS NULL OR bank.environment = :bankEnvironment)',
      {
        bankEnvironment: process.env.PLAID_ENV || 'sandbox',
      },
    );
}
