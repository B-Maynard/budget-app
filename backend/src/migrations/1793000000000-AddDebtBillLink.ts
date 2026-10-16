import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDebtBillLink1793000000000 implements MigrationInterface {
    name = 'AddDebtBillLink1793000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('debts');
        if (table && !table.findColumnByName('bill_id')) {
            await queryRunner.query(`ALTER TABLE "debts" ADD "bill_id" character varying`);
            await queryRunner.query(`ALTER TABLE "debts" ADD CONSTRAINT "UQ_debts_bill_id" UNIQUE ("bill_id")`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // No-op: dropping the link would lose data.
    }

}
