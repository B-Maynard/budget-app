import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameBankingColumnsToSnakeCase1789000000000 implements MigrationInterface {
  name = 'RenameBankingColumnsToSnakeCase1789000000000';

  private readonly renames: [string, string, string][] = [
    ['bank_imports', 'accountLabel', 'account_label'],
    ['bank_imports', 'accountNumber', 'account_number'],
    ['bank_imports', 'accountType', 'account_type'],
    ['bank_imports', 'minDate', 'min_date'],
    ['bank_imports', 'maxDate', 'max_date'],
    ['bank_imports', 'rowCount', 'row_count'],
    ['bank_imports', 'createdAt', 'created_at'],
    ['bank_imports', 'importStatus', 'import_status'],
    ['bank_transactions', 'importId', 'import_id'],
    ['bank_transactions', 'amountCents', 'amount_cents'],
    ['bank_transactions', 'categoryManuallySet', 'category_manually_set'],
    ['category_limits', 'limitCents', 'limit_cents'],
    ['category_limits', 'updatedAt', 'updated_at'],
    ['category_rules', 'updatedAt', 'updated_at'],
    ['description_obfuscations', 'normalizedDescription', 'normalized_description'],
    ['description_obfuscations', 'obfuscatedKey', 'obfuscated_key'],
    ['debts', 'aprBps', 'apr_bps'],
    ['debts', 'startingBalanceCents', 'starting_balance_cents'],
    ['debts', 'currentBalanceCents', 'current_balance_cents'],
    ['debts', 'paymentAmountCents', 'payment_amount_cents'],
    ['debts', 'paymentDay', 'payment_day'],
    ['debts', 'lastAppliedMonth', 'last_applied_month'],
    ['debts', 'createdAt', 'created_at'],
    ['debts', 'updatedAt', 'updated_at'],
    ['ai_jobs', 'startDate', 'start_date'],
    ['ai_jobs', 'endDate', 'end_date'],
    ['ai_jobs', 'analysisType', 'analysis_type'],
    ['ai_jobs', 'createdAt', 'created_at'],
    ['ai_jobs', 'startedAt', 'started_at'],
    ['ai_jobs', 'completedAt', 'completed_at'],
    ['ai_jobs', 'result', 'result_json'],
  ];

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const [tableName, oldName, newName] of this.renames) {
      const table = await queryRunner.getTable(tableName);
      if (table && !table.findColumnByName(newName) && table.findColumnByName(oldName)) {
        await queryRunner.renameColumn(tableName, oldName, newName);
      }
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const [tableName, oldName, newName] of [...this.renames].reverse()) {
      const table = await queryRunner.getTable(tableName);
      if (table && !table.findColumnByName(oldName) && table.findColumnByName(newName)) {
        await queryRunner.renameColumn(tableName, newName, oldName);
      }
    }
  }
}
