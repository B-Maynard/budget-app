import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('category_rules')
export class CategoryRule {
  @PrimaryColumn('text') pattern: string;
  @Column('varchar') category: string;
  @Column('timestamptz') updatedAt: Date;
}
