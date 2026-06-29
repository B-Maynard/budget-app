import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('app_config')
export class AppConfig {
  @PrimaryColumn({ default: 1 })
  id: number;

  @Column('decimal', { default: 0 })
  income: number;

  @Column('decimal', { default: 0 })
  spendingOffset: number;

  @Column('simple-json', { nullable: true })
  currentPurchases: any[];
}
