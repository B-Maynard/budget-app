import { Check, Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { BankTransaction } from './bank-transaction.entity';

@Entity('bank_imports')
@Check('"row_count" >= 0')
@Check('"import_status" IN (\'pending\', \'categorizing\', \'completed\', \'failed\')')
export class BankImport {
  @PrimaryGeneratedColumn('identity')
  id: number;

  @Column('text') filename: string;
  @Column('text', { nullable: true, name: 'account_label' }) accountLabel: string;
  @Column('text', { nullable: true, name: 'account_number' }) accountNumber: string;
  @Column('text', { nullable: true, name: 'account_type' }) accountType: string;
  @Column('char', { length: 64, unique: true }) sha256: string;
  @Column('date', { nullable: true, name: 'min_date' }) minDate: string;
  @Column('date', { nullable: true, name: 'max_date' }) maxDate: string;
  @Column('integer', { name: 'row_count' }) rowCount: number;
  @Column('timestamptz', { default: () => 'now()', name: 'created_at' }) createdAt: Date;
  @Column('varchar', { default: 'completed', name: 'import_status' }) importStatus: string;

  @OneToMany(() => BankTransaction, transaction => transaction.import)
  transactions: BankTransaction[];
}
