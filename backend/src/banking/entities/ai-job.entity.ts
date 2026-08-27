import { Check, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('ai_jobs')
@Check('"status" IN (\'queued\', \'running\', \'completed\', \'failed\')')
@Check('"provider" IN (\'local\', \'cloud\')')
@Check('"analysisType" IN (\'spending\', \'debt\')')
export class AiJob {
  @PrimaryGeneratedColumn('identity') id: number;
  @Column('date', { nullable: true }) startDate: string;
  @Column('date', { nullable: true }) endDate: string;
  @Column('varchar') status: string;
  @Column('varchar', { default: 'local' }) provider: string;
  @Column('varchar', { default: 'spending' }) analysisType: string;
  @Column('timestamptz') createdAt: Date;
  @Column('timestamptz', { nullable: true }) startedAt: Date;
  @Column('timestamptz', { nullable: true }) completedAt: Date;
  @Column('text', { nullable: true }) error: string;
  @Column('text', { nullable: true }) result: string;
}
