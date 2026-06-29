import { Entity, Column, PrimaryColumn, BeforeInsert } from 'typeorm';
import { randomUUID } from 'crypto';

@Entity('paydays')
export class Payday {
  @PrimaryColumn()
  id: string;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = randomUUID();
    }
  }

  @Column('date')
  date: string; // YYYY-MM-DD
}
