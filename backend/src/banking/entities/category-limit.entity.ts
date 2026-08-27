import { Check, Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('category_limits')
@Check('"limitCents" > 0')
export class CategoryLimit {
  @PrimaryColumn('varchar') category: string;
  @Column('integer') limitCents: number;
  @Column('timestamptz') updatedAt: Date;
}
