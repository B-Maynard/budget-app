import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNativeBanking1788000000000 implements MigrationInterface {
  name = 'AddNativeBanking1788000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const tableExists = async (tableName: string) => {
      const result = await queryRunner.query(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${tableName}')`);
      return result[0].exists;
    };

    if (!(await tableExists('bank_imports'))) {
      await queryRunner.query(`
        CREATE TABLE "bank_imports" (
          "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          "filename" text NOT NULL,
          "account_label" text,
          "account_number" text,
          "account_type" text,
          "sha256" char(64) NOT NULL UNIQUE,
          "min_date" date,
          "max_date" date,
          "row_count" integer NOT NULL CHECK ("row_count" >= 0),
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "import_status" varchar NOT NULL DEFAULT 'completed' CHECK ("import_status" IN ('pending', 'categorizing', 'completed', 'failed'))
        )
      `);
    }
    if (!(await tableExists('bank_transactions'))) {
      await queryRunner.query(`
        CREATE TABLE "bank_transactions" (
          "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          "import_id" integer NOT NULL,
          "date" date NOT NULL,
          "description" text NOT NULL,
          "amount_cents" integer NOT NULL,
          "category" varchar NOT NULL DEFAULT 'Uncategorized',
          "category_manually_set" boolean NOT NULL DEFAULT false,
          CONSTRAINT "FK_bank_transactions_import" FOREIGN KEY ("import_id") REFERENCES "bank_imports"("id") ON DELETE CASCADE
        )
      `);
    }
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_bank_transactions_date" ON "bank_transactions" ("date")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_bank_transactions_date_amount" ON "bank_transactions" ("date", "amount_cents")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_bank_transactions_category" ON "bank_transactions" ("category")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_bank_transactions_import" ON "bank_transactions" ("import_id")`);

    if (!(await tableExists('category_limits'))) {
      await queryRunner.query(`
        CREATE TABLE "category_limits" (
          "category" varchar PRIMARY KEY,
          "limit_cents" integer NOT NULL CHECK ("limit_cents" > 0),
          "updated_at" timestamptz NOT NULL
        )
      `);
    }
    if (!(await tableExists('category_rules'))) {
      await queryRunner.query(`
        CREATE TABLE "category_rules" (
          "pattern" text PRIMARY KEY,
          "category" varchar NOT NULL,
          "updated_at" timestamptz NOT NULL
        )
      `);
    }
    if (!(await tableExists('description_obfuscations'))) {
      await queryRunner.query(`
        CREATE TABLE "description_obfuscations" (
          "normalized_description" text PRIMARY KEY,
          "obfuscated_key" text NOT NULL UNIQUE
        )
      `);
    }
    if (!(await tableExists('debts'))) {
      await queryRunner.query(`
        CREATE TABLE "debts" (
          "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          "name" text NOT NULL,
          "apr_bps" integer NOT NULL CHECK ("apr_bps" >= 0),
          "starting_balance_cents" integer NOT NULL CHECK ("starting_balance_cents" >= 0),
          "current_balance_cents" integer NOT NULL CHECK ("current_balance_cents" >= 0),
          "payment_amount_cents" integer NOT NULL CHECK ("payment_amount_cents" > 0),
          "payment_day" integer NOT NULL CHECK ("payment_day" BETWEEN 1 AND 28),
          "last_applied_month" date NOT NULL,
          "created_at" timestamptz NOT NULL,
          "updated_at" timestamptz NOT NULL
        )
      `);
    }
    if (!(await tableExists('ai_jobs'))) {
      await queryRunner.query(`
        CREATE TABLE "ai_jobs" (
          "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          "start_date" date,
          "end_date" date,
          "status" varchar NOT NULL CHECK ("status" IN ('queued', 'running', 'completed', 'failed')),
          "provider" varchar NOT NULL DEFAULT 'local' CHECK ("provider" IN ('local', 'cloud')),
          "analysis_type" varchar NOT NULL DEFAULT 'spending' CHECK ("analysis_type" IN ('spending', 'debt')),
          "created_at" timestamptz NOT NULL,
          "started_at" timestamptz,
          "completed_at" timestamptz,
          "error" text,
          "result_json" text
        )
      `);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_jobs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "debts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "description_obfuscations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "category_rules"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "category_limits"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "bank_transactions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "bank_imports"`);
  }
}
