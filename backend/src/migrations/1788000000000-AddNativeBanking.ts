import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNativeBanking1788000000000 implements MigrationInterface {
  name = 'AddNativeBanking1788000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "bank_imports" (
        "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        "filename" text NOT NULL,
        "accountLabel" text,
        "accountNumber" text,
        "accountType" text,
        "sha256" char(64) NOT NULL UNIQUE,
        "minDate" date,
        "maxDate" date,
        "rowCount" integer NOT NULL CHECK ("rowCount" >= 0),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "importStatus" varchar NOT NULL DEFAULT 'completed' CHECK ("importStatus" IN ('pending', 'categorizing', 'completed', 'failed'))
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "bank_transactions" (
        "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        "importId" integer NOT NULL,
        "date" date NOT NULL,
        "description" text NOT NULL,
        "amountCents" integer NOT NULL,
        "category" varchar NOT NULL DEFAULT 'Uncategorized',
        "categoryManuallySet" boolean NOT NULL DEFAULT false,
        CONSTRAINT "FK_bank_transactions_import" FOREIGN KEY ("importId") REFERENCES "bank_imports"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_bank_transactions_date" ON "bank_transactions" ("date")`);
    await queryRunner.query(`CREATE INDEX "IDX_bank_transactions_date_amount" ON "bank_transactions" ("date", "amountCents")`);
    await queryRunner.query(`CREATE INDEX "IDX_bank_transactions_category" ON "bank_transactions" ("category")`);
    await queryRunner.query(`CREATE INDEX "IDX_bank_transactions_import" ON "bank_transactions" ("importId")`);

    await queryRunner.query(`
      CREATE TABLE "category_limits" (
        "category" varchar PRIMARY KEY,
        "limitCents" integer NOT NULL CHECK ("limitCents" > 0),
        "updatedAt" timestamptz NOT NULL
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "category_rules" (
        "pattern" text PRIMARY KEY,
        "category" varchar NOT NULL,
        "updatedAt" timestamptz NOT NULL
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "description_obfuscations" (
        "normalizedDescription" text PRIMARY KEY,
        "obfuscatedKey" text NOT NULL UNIQUE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "debts" (
        "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        "name" text NOT NULL,
        "aprBps" integer NOT NULL CHECK ("aprBps" >= 0),
        "startingBalanceCents" integer NOT NULL CHECK ("startingBalanceCents" >= 0),
        "currentBalanceCents" integer NOT NULL CHECK ("currentBalanceCents" >= 0),
        "paymentAmountCents" integer NOT NULL CHECK ("paymentAmountCents" > 0),
        "paymentDay" integer NOT NULL CHECK ("paymentDay" BETWEEN 1 AND 28),
        "lastAppliedMonth" date NOT NULL,
        "createdAt" timestamptz NOT NULL,
        "updatedAt" timestamptz NOT NULL
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "ai_jobs" (
        "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        "startDate" date,
        "endDate" date,
        "status" varchar NOT NULL CHECK ("status" IN ('queued', 'running', 'completed', 'failed')),
        "provider" varchar NOT NULL DEFAULT 'local' CHECK ("provider" IN ('local', 'cloud')),
        "analysisType" varchar NOT NULL DEFAULT 'spending' CHECK ("analysisType" IN ('spending', 'debt')),
        "createdAt" timestamptz NOT NULL,
        "startedAt" timestamptz,
        "completedAt" timestamptz,
        "error" text,
        "result" text
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "ai_jobs"`);
    await queryRunner.query(`DROP TABLE "debts"`);
    await queryRunner.query(`DROP TABLE "description_obfuscations"`);
    await queryRunner.query(`DROP TABLE "category_rules"`);
    await queryRunner.query(`DROP TABLE "category_limits"`);
    await queryRunner.query(`DROP TABLE "bank_transactions"`);
    await queryRunner.query(`DROP TABLE "bank_imports"`);
  }
}
