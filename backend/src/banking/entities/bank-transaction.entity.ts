import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { BankImport } from './bank-import.entity';

@Entity('bank_transactions')
@Index(['date'])
@Index(['date', 'amountCents'])
@Index(['category'])
@Index(['importId'])
export class BankTransaction {
  @PrimaryGeneratedColumn('identity')
  id: number;

  @Column('integer', { name: 'import_id' }) importId: number;
  @Column('date') date: string;
  @Column('text') description: string;
  @Column('integer', { name: 'amount_cents' }) amountCents: number;
  @Column('varchar', { default: 'Uncategorized' }) category: string;
  @Column('boolean', { default: false, name: 'category_manually_set' }) categoryManuallySet: boolean;

  @ManyToOne(() => BankImport, bankImport => bankImport.transactions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'import_id' })
  import: BankImport;
}
