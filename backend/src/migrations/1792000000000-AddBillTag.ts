import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBillTag1792000000000 implements MigrationInterface {
    name = 'AddBillTag1792000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('bills');
        if (table && !table.findColumnByName('tag')) {
            await queryRunner.query(`ALTER TABLE "bills" ADD "tag" character varying NOT NULL DEFAULT 'bill'`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // No-op: dropping the tag column would lose data.
    }

}
