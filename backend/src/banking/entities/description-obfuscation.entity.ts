import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('description_obfuscations')
export class DescriptionObfuscation {
  @PrimaryColumn('text', { name: 'normalized_description' }) normalizedDescription: string;
  @Column('text', { unique: true, name: 'obfuscated_key' }) obfuscatedKey: string;
}
