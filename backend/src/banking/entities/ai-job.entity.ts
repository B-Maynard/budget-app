import { Check, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('ai_jobs')
@Check('"status" IN (\'queued\', \'running\', \'completed\', \'failed\')')
@Check('"provider" IN (\'local\', \'cloud\')')
@Check('"analysis_type" IN (\'spending\', \'debt\')')
export class AiJob {
  @PrimaryGeneratedColumn('identity') id: number;
  @Column('date', { nullable: true, name: 'start_date' }) startDate: string;
  @Column('date', { nullable: true, name: 'end_date' }) endDate: string;
  @Column('varchar') status: string;
  @Column('varchar', { default: 'local' }) provider: string;
  @Column('varchar', { default: 'spending', name: 'analysis_type' }) analysisType: string;
  @Column('timestamptz', { name: 'created_at' }) createdAt: Date;
  @Column('timestamptz', { nullable: true, name: 'started_at' }) startedAt: Date;
  @Column('timestamptz', { nullable: true, name: 'completed_at' }) completedAt: Date;
  @Column('text', { nullable: true }) error: string;
  @Column('text', { nullable: true, name: 'result_json' }) result: string;
}
