import { Entity, Column, PrimaryColumn, BeforeInsert } from 'typeorm';
import { randomUUID } from 'crypto';

@Entity('bills')
export class Bill {
  @PrimaryColumn()
  id: string;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = randomUUID();
    }
  }

  @Column()
  name: string;

  @Column('decimal')
  price: number;

  @Column({ default: 'monthly' })
  frequency: string;

  @Column({ nullable: true })
  dueDay: number;

  @Column({ nullable: true })
  dueMonth: number;

  @Column({ nullable: true })
  dueDayOfWeek: number;

  @Column('simple-array', { nullable: true })
  paidDates: string[];
}
