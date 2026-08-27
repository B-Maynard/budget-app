import { Check, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('debts')
@Check('"aprBps" >= 0')
@Check('"startingBalanceCents" >= 0')
@Check('"currentBalanceCents" >= 0')
@Check('"paymentAmountCents" > 0')
@Check('"paymentDay" BETWEEN 1 AND 28')
export class Debt {
  @PrimaryGeneratedColumn('identity') id: number;
  @Column('text') name: string;
  @Column('integer') aprBps: number;
  @Column('integer') startingBalanceCents: number;
  @Column('integer') currentBalanceCents: number;
  @Column('integer') paymentAmountCents: number;
  @Column('integer') paymentDay: number;
  @Column('date') lastAppliedMonth: string;
  @Column('timestamptz') createdAt: Date;
  @Column('timestamptz') updatedAt: Date;
}
