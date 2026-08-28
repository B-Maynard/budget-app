import { Check, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('debts')
@Check('"apr_bps" >= 0')
@Check('"starting_balance_cents" >= 0')
@Check('"current_balance_cents" >= 0')
@Check('"payment_amount_cents" > 0')
@Check('"payment_day" BETWEEN 1 AND 28')
export class Debt {
  @PrimaryGeneratedColumn('identity') id: number;
  @Column('text') name: string;
  @Column('integer', { name: 'apr_bps' }) aprBps: number;
  @Column('integer', { name: 'starting_balance_cents' }) startingBalanceCents: number;
  @Column('integer', { name: 'current_balance_cents' }) currentBalanceCents: number;
  @Column('integer', { name: 'payment_amount_cents' }) paymentAmountCents: number;
  @Column('integer', { name: 'payment_day' }) paymentDay: number;
  @Column('date', { name: 'last_applied_month' }) lastAppliedMonth: string;
  @Column('timestamptz', { name: 'created_at' }) createdAt: Date;
  @Column('timestamptz', { name: 'updated_at' }) updatedAt: Date;
}
