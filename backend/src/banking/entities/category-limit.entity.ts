import { Check, Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('category_limits')
@Check('"limit_cents" > 0')
export class CategoryLimit {
  @PrimaryColumn('varchar') category: string;
  @Column('integer', { name: 'limit_cents' }) limitCents: number;
  @Column('timestamptz', { name: 'updated_at' }) updatedAt: Date;
}
