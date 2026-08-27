import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('description_obfuscations')
export class DescriptionObfuscation {
  @PrimaryColumn('text') normalizedDescription: string;
  @Column('text', { unique: true }) obfuscatedKey: string;
}
