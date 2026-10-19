import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('bank_connections')
export class BankConnection {
  @Column('varchar') environment: string;
  @PrimaryGeneratedColumn('identity') id: number;
  @Column('text', { unique: true, name: 'item_id', select: false })
  itemId: string;
  @Column('text', { nullable: true, name: 'access_token', select: false })
  accessToken: string | null;
  @Column('text', { name: 'institution_name' }) institutionName: string;
  @Column('varchar', { default: 'active' }) status: string;
  @Column('date', { name: 'import_start_date' }) importStartDate: string;
  @Column('text', { nullable: true, select: false }) cursor: string | null;
  @Column('text', { nullable: true, name: 'error_code' }) errorCode:
    string | null;
  @Column('timestamptz', { default: () => 'now()', name: 'next_sync_at' })
  nextSyncAt: Date;
  @Column('timestamptz', { nullable: true, name: 'last_synced_at' })
  lastSyncedAt: Date | null;
  @Column('timestamptz', { nullable: true, name: 'last_refresh_requested_at' })
  lastRefreshRequestedAt: Date | null;
  @Column('timestamptz', { default: () => 'now()', name: 'created_at' })
  createdAt: Date;
}
