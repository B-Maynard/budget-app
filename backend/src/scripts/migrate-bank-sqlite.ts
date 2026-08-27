import { existsSync } from 'node:fs';
import AppDataSource from '../data-source';

// node:sqlite is available in the Node runtime, but is newer than this repo's @types/node.
const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (path: string, options: { readOnly: boolean }) => unknown };

const CATEGORIES = new Set([
  'Housing', 'Bills', 'Groceries', 'Dining', 'Transport', 'Shopping',
  'Health', 'Income', 'Transfer', 'One Time Payment', 'Entertainment',
  'Fees', 'Travel', 'Uncategorized',
]);

const TABLES = {
  imports: ['id', 'filename', 'account_label', 'account_number', 'account_type', 'sha256', 'min_date', 'max_date', 'row_count', 'created_at', 'import_status'],
  transactions: ['id', 'import_id', 'date', 'description', 'amount_cents', 'category', 'category_manually_set'],
  category_limits: ['category', 'limit_cents', 'updated_at'],
  category_rules: ['pattern', 'category', 'updated_at'],
  description_obfuscation: ['normalized_description', 'obfuscated_key'],
  debts: ['id', 'name', 'apr_bps', 'starting_balance_cents', 'current_balance_cents', 'payment_amount_cents', 'payment_day', 'last_applied_month', 'created_at', 'updated_at'],
  ai_jobs: ['id', 'start_date', 'end_date', 'status', 'provider', 'created_at', 'started_at', 'completed_at', 'error', 'result_json', 'analysis_type'],
} as const;

const DEST_TABLES = ['bank_imports', 'bank_transactions', 'category_limits', 'category_rules', 'description_obfuscations', 'debts', 'ai_jobs'];
const CENT_FIELDS = new Set(['amount_cents', 'limit_cents', 'starting_balance_cents', 'current_balance_cents', 'payment_amount_cents']);
const DATE_FIELDS = new Set(['date', 'min_date', 'max_date', 'created_at', 'updated_at', 'start_date', 'end_date', 'started_at', 'completed_at', 'last_applied_month']);

type Row = Record<string, any>;
type Sqlite = { prepare(sql: string): { all(...args: any[]): Row[] }; close(): void };

function die(message: string): never { throw new Error(message); }

function args() {
  const argv = process.argv.slice(2);
  const sqlite = argv[argv.indexOf('--sqlite') + 1];
  if (!sqlite || sqlite.startsWith('--')) die('Usage: npm run migrate:bank-sqlite -- --sqlite /absolute/path/to/bank.db [--dry-run]');
  if (!sqlite.startsWith('/')) die('--sqlite must be an absolute path');
  return { sqlite, dryRun: argv.includes('--dry-run') };
}

function openSqlite(path: string): Sqlite {
  if (!existsSync(path)) die(`SQLite file does not exist: ${path}`);
  try { return new DatabaseSync(path, { readOnly: true }) as unknown as Sqlite; }
  catch (error) { die(`Cannot open SQLite database read-only: ${error}`); }
}

function iso(value: any, field: string, table: string, nullable = true): any {
  if (value === null || value === undefined || value === '') {
    if (nullable) return null;
    die(`${table}.${field} is empty`);
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) die(`Invalid date in ${table}.${field}: ${value}`);
  return date;
}

function sourceData(db: Sqlite) {
  const data = {} as Record<keyof typeof TABLES, Row[]>;
  for (const [table, columns] of Object.entries(TABLES)) {
    const actual = db.prepare(`PRAGMA table_info("${table}")`).all();
    if (!actual.length) die(`Missing SQLite table: ${table}`);
    const names = new Set(actual.map(row => row.name));
    const missing = columns.filter(column => !names.has(column));
    if (missing.length) die(`Missing SQLite columns in ${table}: ${missing.join(', ')}`);
    data[table as keyof typeof TABLES] = db.prepare(`SELECT * FROM "${table}"`).all();
    console.log(`SQLite ${table}: ${data[table as keyof typeof TABLES].length} rows`);
  }

  const imports = new Set(data.imports.map(row => row.id));
  for (const row of data.transactions) {
    if (!Number.isSafeInteger(row.amount_cents)) die(`Unsafe amount_cents in transaction ${row.id}`);
    if (!imports.has(row.import_id)) die(`Orphaned transaction import_id ${row.import_id}`);
    if (!CATEGORIES.has(row.category)) console.warn(`Mapping invalid category on transaction ${row.id} to Uncategorized: ${row.category}`);
    iso(row.date, 'date', 'transactions', false);
  }
  for (const row of data.category_limits) if (!Number.isSafeInteger(row.limit_cents)) die('Unsafe category limit cents');
  for (const row of data.debts) {
    for (const field of ['apr_bps', 'starting_balance_cents', 'current_balance_cents', 'payment_amount_cents']) if (!Number.isSafeInteger(row[field])) die(`Unsafe ${field} in debt ${row.id}`);
  }
  for (const [table, rows] of Object.entries(data)) for (const row of rows) {
    for (const field of Object.keys(row)) if (DATE_FIELDS.has(field)) iso(row[field], field, table);
  }
  return data;
}

async function main() {
  const { sqlite, dryRun } = args();
  const db = openSqlite(sqlite);
  let source: Record<string, Row[]>;
  try { source = sourceData(db); } finally { db.close(); }

  await AppDataSource.initialize();
  const runner = AppDataSource.createQueryRunner();
  await runner.connect();
  try {
    const migration = await runner.query(`SELECT 1 FROM "migrations" WHERE "name" = $1`, ['AddNativeBanking1788000000000']);
    if (!migration.length) die('PostgreSQL banking migration has not run');
    for (const table of DEST_TABLES) {
      if (!(await runner.hasTable(table))) die(`Missing PostgreSQL table: ${table}`);
      const [{ count }] = await runner.query(`SELECT count(*)::int AS count FROM "${table}"`);
      if (count) die(`Destination table ${table} is not empty (${count} rows)`);
    }
    if (dryRun) { console.log('Dry run passed; PostgreSQL was not modified.'); return; }

    await runner.startTransaction();
    const importIds = new Map<number, number>();
    for (const row of source.imports) {
      const [out] = await runner.query(`INSERT INTO "bank_imports" ("filename","accountLabel","accountNumber","accountType","sha256","minDate","maxDate","rowCount","createdAt","importStatus") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING "id"`, [row.filename, row.account_label, row.account_number, row.account_type, row.sha256, row.min_date || null, row.max_date || null, row.row_count, iso(row.created_at, 'created_at', 'imports', false), row.import_status]);
      importIds.set(row.id, out.id);
    }
    for (const row of source.transactions) await runner.query(`INSERT INTO "bank_transactions" ("importId","date","description","amountCents","category","categoryManuallySet") VALUES ($1,$2,$3,$4,$5,$6)`, [importIds.get(row.import_id), iso(row.date, 'date', 'transactions', false), row.description, row.amount_cents, CATEGORIES.has(row.category) ? row.category : 'Uncategorized', Boolean(row.category_manually_set)]);
    for (const row of source.category_limits) await runner.query(`INSERT INTO "category_limits" ("category","limitCents","updatedAt") VALUES ($1,$2,$3)`, [row.category, row.limit_cents, iso(row.updated_at, 'updated_at', 'category_limits', false)]);
    for (const row of source.category_rules) await runner.query(`INSERT INTO "category_rules" ("pattern","category","updatedAt") VALUES ($1,$2,$3)`, [row.pattern, CATEGORIES.has(row.category) ? row.category : 'Uncategorized', iso(row.updated_at, 'updated_at', 'category_rules', false)]);
    for (const row of source.description_obfuscation) await runner.query(`INSERT INTO "description_obfuscations" ("normalizedDescription","obfuscatedKey") VALUES ($1,$2)`, [row.normalized_description, row.obfuscated_key]);
    for (const row of source.debts) await runner.query(`INSERT INTO "debts" ("name","aprBps","startingBalanceCents","currentBalanceCents","paymentAmountCents","paymentDay","lastAppliedMonth","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [row.name, row.apr_bps, row.starting_balance_cents, row.current_balance_cents, row.payment_amount_cents, row.payment_day, row.last_applied_month || null, iso(row.created_at, 'created_at', 'debts', false), iso(row.updated_at, 'updated_at', 'debts', false)]);
    for (const row of source.ai_jobs) {
      const interrupted = row.status === 'queued' || row.status === 'running';
      await runner.query(`INSERT INTO "ai_jobs" ("startDate","endDate","status","provider","analysisType","createdAt","startedAt","completedAt","error","result") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [row.start_date || null, row.end_date || null, interrupted ? 'failed' : row.status, row.provider, row.analysis_type, iso(row.created_at, 'created_at', 'ai_jobs', false), iso(row.started_at, 'started_at', 'ai_jobs'), interrupted ? new Date() : iso(row.completed_at, 'completed_at', 'ai_jobs'), interrupted ? `${row.error ? `${row.error}; ` : ''}Marked failed during SQLite migration` : row.error, row.result_json]);
    }

    const destinationCounts: Record<string, number> = {};
    for (const table of DEST_TABLES) {
      const [{ count }] = await runner.query(`SELECT count(*)::int AS count FROM "${table}"`);
      destinationCounts[table] = Number(count);
    }
    const expectedCounts = { bank_imports: source.imports.length, bank_transactions: source.transactions.length, category_limits: source.category_limits.length, category_rules: source.category_rules.length, description_obfuscations: source.description_obfuscation.length, debts: source.debts.length, ai_jobs: source.ai_jobs.length };
    const expectedTotals = source.transactions.reduce((a, r) => ({ rows: a.rows + 1, total: a.total + r.amount_cents, inflow: a.inflow + (r.amount_cents > 0 ? r.amount_cents : 0), outflow: a.outflow + (r.amount_cents < 0 ? Math.abs(r.amount_cents) : 0) }), { rows: 0, total: 0, inflow: 0, outflow: 0 });
    const [sourceTotals] = await runner.query(`SELECT count(*)::int AS rows, coalesce(sum("amountCents"),0)::bigint AS total, coalesce(sum("amountCents") FILTER (WHERE "amountCents" > 0),0)::bigint AS inflow, coalesce(sum(abs("amountCents")) FILTER (WHERE "amountCents" < 0),0)::bigint AS outflow FROM "bank_transactions"`);
    const [debtTotals] = await runner.query(`SELECT coalesce(sum("startingBalanceCents"),0)::bigint AS starting, coalesce(sum("currentBalanceCents"),0)::bigint AS current FROM "debts"`);
    const expectedDebtTotals = source.debts.reduce((a, r) => ({ starting: a.starting + r.starting_balance_cents, current: a.current + r.current_balance_cents }), { starting: 0, current: 0 });
    console.log('Reconciliation:', { sourceCounts: expectedCounts, destinationCounts, source: expectedTotals, destination: sourceTotals, debtTotals: { source: expectedDebtTotals, destination: debtTotals }, categoryLimits: destinationCounts.category_limits, obfuscations: destinationCounts.description_obfuscations });
    if (DEST_TABLES.some(table => destinationCounts[table] !== expectedCounts[table]) || Number(sourceTotals.rows) !== expectedTotals.rows || Number(sourceTotals.total) !== expectedTotals.total || Number(sourceTotals.inflow) !== expectedTotals.inflow || Number(sourceTotals.outflow) !== expectedTotals.outflow || Number(debtTotals.starting) !== expectedDebtTotals.starting || Number(debtTotals.current) !== expectedDebtTotals.current) die('Reconciliation failed');
    if (Number(sourceTotals.rows) !== expectedTotals.rows || Number(sourceTotals.total) !== expectedTotals.total || Number(sourceTotals.inflow) !== expectedTotals.inflow || Number(sourceTotals.outflow) !== expectedTotals.outflow) die('Transaction reconciliation failed');
    await runner.commitTransaction();
    console.log('Bank SQLite migration completed successfully.');
  } catch (error) {
    if (runner.isTransactionActive) await runner.rollbackTransaction();
    throw error;
  } finally { await runner.release(); await AppDataSource.destroy(); }
}

main().catch(error => { console.error(`Migration aborted: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; });
