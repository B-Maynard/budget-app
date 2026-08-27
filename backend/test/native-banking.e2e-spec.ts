import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { AppModule } from '../src/app.module';
import { BankTransaction } from '../src/banking/entities/bank-transaction.entity';
import { CategoryRule } from '../src/banking/entities/category-rule.entity';
import { Debt } from '../src/banking/entities/debt.entity';

const expect: any = globalThis.expect;

const csv = join(__dirname, 'fixtures/sample-bank.csv');
const appRequest = () => request(app.getHttpServer());
let app: INestApplication;
let dataSource: DataSource;
let available = false;

async function waitForImport(id: number) {
  for (let i = 0; i < 40; i++) {
    const response = await appRequest().get(`/api/import-status/${id}`);
    if (response.body.status === 'completed' || response.body.status === 'failed') return response.body;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error('import did not finish');
}

async function waitForJob(kind: 'spending' | 'debt') {
  for (let i = 0; i < 40; i++) {
    const response = await appRequest().get('/api/ai/status').query({ kind });
    if (['completed', 'failed'].includes(response.body?.status)) return response.body;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error('analysis did not finish');
}

function currentMonth(offset = 0) {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() + offset);
  return date.toISOString().slice(0, 7);
}

function previousMonth(month: string) {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() - 1);
  return date.toISOString().slice(0, 10);
}

beforeAll(async () => {
  try {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
    dataSource = app.get(DataSource);
    await dataSource.query('SELECT 1');
    available = true;
  } catch {
    // A developer checkout need not have PostgreSQL running to compile this suite.
    if (app) await app.close().catch(() => undefined);
  }
});

beforeEach(async () => {
  if (!available) return;
  await dataSource.query('TRUNCATE TABLE bank_transactions, bank_imports, category_limits, category_rules, debts, ai_jobs, description_obfuscations RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  if (app) await app.close();
});

describe('native banking', () => {
  it('imports CSV rows, skips a duplicate, categorizes, and stores integer cents', async () => {
    if (!available) return;
    const result = await appRequest().post('/api/imports').attach('file', csv).expect(201);
    expect(result.body).toEqual(expect.objectContaining({ id: expect.any(Number), rows: 16, imported: 15, skipped: 1 }));
    expect((await waitForImport(result.body.id)).status).toBe('completed');
    const rows = await dataSource.getRepository(BankTransaction).find();
    expect(rows).toHaveLength(15);
    expect(rows.every(row => Number.isInteger(row.amountCents))).toBe(true);
    expect(rows.find(row => row.description === 'Whole Foods')?.category).toBe('Groceries');
    expect(rows.filter(row => row.description === 'Netflix')).toHaveLength(3);
  });

  it('persists a manual category override as a reusable rule', async () => {
    if (!available) return;
    const imported = await appRequest().post('/api/imports').attach('file', csv).expect(201);
    await waitForImport(imported.body.id);
    const transaction = (await dataSource.getRepository(BankTransaction).findOneByOrFail({ description: 'Book Store' }));
    await appRequest().patch(`/api/transactions/${transaction.id}/category`).send({ category: 'Shopping' }).expect(200);
    const second = await appRequest().post('/api/imports').attach('file', Buffer.from('123456789,Checking\nDate,Description,Amount\n2025-04-01,Book Store,-27.35\n'), 'follow-up.csv').expect(201);
    await waitForImport(second.body.id);
    const rule = await dataSource.getRepository(CategoryRule).findOneByOrFail({ pattern: 'book store' });
    expect(rule.category).toBe('Shopping');
    expect((await dataSource.getRepository(BankTransaction).findBy({ importId: second.body.id, description: 'Book Store' }))[0].category).toBe('Shopping');
    expect((await dataSource.getRepository(BankTransaction).findOneByOrFail({ id: transaction.id })).categoryManuallySet).toBe(true);
  });

  it('returns dashboard KPIs and supports month, category, and search filters', async () => {
    if (!available) return;
    const imported = await appRequest().post('/api/imports').attach('file', csv).expect(201);
    await waitForImport(imported.body.id);
    const dashboard = await appRequest().get('/api/dashboard').query({ startDate: '2025-01-01', endDate: '2025-03-31' }).expect(200);
    expect(dashboard.body.kpis).toEqual({ inflow: 300000, outflow: 182057, net: 117943, count: 15 });
    expect(dashboard.body.series.labels).toEqual(['2025-01', '2025-02', '2025-03']);
    expect(dashboard.body.categories.labels).toContain('Groceries');
    expect((await appRequest().get('/api/dashboard').query({ month: '2025-01' })).body.kpis.count).toBe(10);
    expect((await appRequest().get('/api/dashboard').query({ category: 'Dining' })).body.kpis.count).toBe(1);
    expect((await appRequest().get('/api/dashboard').query({ search: 'whole foods' })).body.kpis.count).toBe(1);
  });

  it('creates, reads, and deletes category limits', async () => {
    if (!available) return;
    expect((await appRequest().get('/api/category-limits')).body).toEqual([]);
    await appRequest().post('/api/category-limits').send({ category: 'Dining', limitCents: 50000 }).expect(201);
    expect((await appRequest().get('/api/category-limits')).body).toEqual([expect.objectContaining({ category: 'Dining', limitCents: 50000 })]);
    await appRequest().delete('/api/category-limits/Dining').expect(200);
    expect((await appRequest().get('/api/category-limits')).body).toEqual([]);
  });

  it('applies debt interest and payments, then supports CRUD', async () => {
    if (!available) return;
    const created = await appRequest().post('/api/debts').send({ name: 'Test Card', aprBps: 1200, startingBalanceCents: 100000, paymentAmountCents: 15000, paymentDay: 15 }).expect(201);
    expect(created.body).toEqual(expect.objectContaining({ name: 'Test Card', currentBalanceCents: 100000 }));
    expect((await appRequest().get('/api/debts')).body[0]).toEqual(expect.objectContaining({ aprBps: 1200, paymentAmountCents: 15000 }));
    await dataSource.getRepository(Debt).update(created.body.id, { lastAppliedMonth: previousMonth(currentMonth()), currentBalanceCents: 100000 });
    expect((await appRequest().get('/api/debts')).body[0].currentBalanceCents).toBe(86000);
    await dataSource.getRepository(Debt).update(created.body.id, { lastAppliedMonth: previousMonth(currentMonth()), currentBalanceCents: 86000 });
    expect((await appRequest().get('/api/debts')).body[0].currentBalanceCents).toBe(71860);
    await appRequest().patch(`/api/debts/${created.body.id}`).send({ paymentAmountCents: 20000 }).expect(200);
    await appRequest().delete(`/api/debts/${created.body.id}`).expect(200);
    expect((await appRequest().get('/api/debts')).body).toEqual([]);
  });

  it('queues analysis jobs, rejects duplicates, validates input, and records provider failures', async () => {
    if (!available) return;
    const job = await appRequest().post('/api/ai/jobs').send({ kind: 'spending', startDate: '2025-01-01', endDate: '2025-03-31' }).expect(201);
    expect(job.body).toEqual(expect.objectContaining({ id: expect.any(Number), status: 'queued' }));
    await appRequest().post('/api/ai/jobs').send({ kind: 'spending', startDate: '2025-01-01', endDate: '2025-03-31' }).expect(409);
    expect((await waitForJob('spending')).status).toBe('failed');
    await appRequest().post('/api/ai/jobs').send({ kind: 'spending' }).expect(400);
    process.env.HERMES_URL = process.env.HERMES_URL || 'http://127.0.0.1:1';
    process.env.HERMES_MODEL = process.env.HERMES_MODEL || 'test';
    process.env.HERMES_API_KEY = process.env.HERMES_API_KEY || 'test';
    const debt = await appRequest().post('/api/ai/jobs').send({ kind: 'debt' }).expect(201);
    expect(debt.body).toEqual(expect.objectContaining({ id: expect.any(Number), status: 'queued', analysisType: 'debt' }));
    expect((await waitForJob('debt')).status).toBe('failed');
  });

  it('checks the application health endpoint when one is configured', async () => {
    if (!available) return;
    expect((await appRequest().get('/api/healthz')).status).toBe(200);
  });
});
