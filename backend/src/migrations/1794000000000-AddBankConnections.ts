import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBankConnections1794000000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE bank_connections (
      id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      item_id text NOT NULL UNIQUE, access_token text,
      environment varchar NOT NULL CHECK (environment IN ('sandbox', 'production')),
      institution_name text NOT NULL, status varchar NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'attention', 'error', 'disconnected')),
      import_start_date date NOT NULL, cursor text, error_code text,
      next_sync_at timestamptz NOT NULL DEFAULT now(), last_synced_at timestamptz,
      last_refresh_requested_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await runner.query(
      `CREATE INDEX bank_connections_next_sync ON bank_connections (next_sync_at) WHERE status <> 'disconnected'`,
    );
    await runner.query(
      `ALTER TABLE bank_imports ADD bank_connection_id integer REFERENCES bank_connections(id), ADD provider_account_id text UNIQUE`,
    );
    await runner.query(
      `CREATE INDEX bank_imports_connection ON bank_imports(bank_connection_id)`,
    );
    await runner.query(
      `ALTER TABLE bank_transactions ADD provider_transaction_id text UNIQUE, ADD pending boolean NOT NULL DEFAULT false`,
    );
  }

  async down(runner: QueryRunner): Promise<void> {
    // Preserve imported transactions; disconnect and revoke Items before reverting.
    await runner.query(
      `ALTER TABLE bank_transactions DROP COLUMN pending, DROP COLUMN provider_transaction_id`,
    );
    await runner.query(
      `ALTER TABLE bank_imports DROP COLUMN provider_account_id, DROP COLUMN bank_connection_id`,
    );
    await runner.query(`DROP TABLE bank_connections`);
  }
}
