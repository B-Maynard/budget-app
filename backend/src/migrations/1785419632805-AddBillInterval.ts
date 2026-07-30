import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBillInterval1785419632805 implements MigrationInterface {
    name = 'AddBillInterval1785419632805'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "bills" ADD "interval" integer NOT NULL DEFAULT 1`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // No-op: dropping the interval column would lose data.
    }

}
