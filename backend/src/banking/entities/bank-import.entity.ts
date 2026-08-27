import { Check, Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { BankTransaction } from './bank-transaction.entity';

@Entity('bank_imports')
@Check('"rowCount" >= 0')
@Check('"importStatus" IN (\'pending\', \'categorizing\', \'completed\', \'failed\')')
export class BankImport {
  @PrimaryGeneratedColumn('identity')
  id: number;

  @Column('text') filename: string;
  @Column('text', { nullable: true }) accountLabel: string;
  @Column('text', { nullable: true }) accountNumber: string;
  @Column('text', { nullable: true }) accountType: string;
  @Column('char', { length: 64, unique: true }) sha256: string;
  @Column('date', { nullable: true }) minDate: string;
  @Column('date', { nullable: true }) maxDate: string;
  @Column('integer') rowCount: number;
  @Column('timestamptz', { default: () => 'now()' }) createdAt: Date;
  @Column('varchar', { default: 'completed' }) importStatus: string;

  @OneToMany(() => BankTransaction, transaction => transaction.import)
  transactions: BankTransaction[];
}
