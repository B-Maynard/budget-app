import {
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import request = require('supertest');
import dataSource from '../src/data-source';
import { BankingModule } from '../src/banking/banking.module';
import { BankConnectionsService } from '../src/banking/bank-connections.service';
import { BankConnection } from '../src/banking/entities/bank-connection.entity';
import { BankTransaction } from '../src/banking/entities/bank-transaction.entity';
import { PlaidService } from '../src/banking/plaid.service';
import { PlaidTokenCipher } from '../src/banking/plaid-token-cipher';

// Explicit, isolated database required; never silently use the developer's budget.
const testUrl = process.env.BANK_SYNC_TEST_DATABASE_URL;
const expect = (globalThis as unknown as { expect: jest.Expect }).expect;
const describe = (globalThis as unknown as { describe: jest.Describe })
  .describe;
const suite = testUrl ? describe : describe.skip;
suite('bank connections with PostgreSQL', () => {
  let app: INestApplication;
  let db: DataSource;
  let banking: BankConnectionsService;
  const previousToken = process.env.TOKEN;
  const previousBankEnvironment = process.env.PLAID_ENV;
  const sdk = {
    itemPublicTokenExchange: jest.fn(),
    accountsGet: jest.fn(),
    institutionsGetById: jest.fn(),
    transactionsSync: jest.fn(),
    transactionsRefresh: jest.fn(),
    itemRemove: jest.fn(),
    linkTokenCreate: jest.fn(),
  };
  const plaid = {
    configuration: {
      enabled: true,
      environment: 'sandbox',
      refreshEnabled: true,
      message: null,
    },
    client: sdk,
    cipher: new PlaidTokenCipher(Buffer.alloc(32, 1)),
    verifyWebhook: jest.fn(),
  };
  const account = {
    account_id: 'account-1',
    name: 'Checking',
    mask: '1234',
    type: 'depository',
    subtype: 'checking',
    balances: { iso_currency_code: 'USD' },
  };
  const transaction = (id: string, extra = {}) => ({
    transaction_id: id,
    account_id: 'account-1',
    date: '2026-10-19',
    name: 'Coffee',
    amount: 12.34,
    pending: false,
    iso_currency_code: 'USD',
    personal_finance_category: {
      primary: 'FOOD_AND_DRINK',
      detailed: 'FOOD_AND_DRINK_COFFEE',
    },
    ...extra,
  });
  const page = (added = [], extra = {}) => ({
    data: {
      added,
      modified: [],
      removed: [],
      next_cursor: 'cursor-1',
      has_more: false,
      ...extra,
    },
  });
  const api = () => request(app.getHttpServer());
  const auth = { authToken: 'bank-integration-test-token' };
  const connect = async () =>
    (
      await api()
        .post('/api/bank-connections/exchange')
        .set(auth)
        .send({ publicToken: 'public-test', importStartDate: '2026-10-01' })
        .expect(201)
    ).body.id as number;
  const due = async (id: number) => {
    await db
      .getRepository(BankConnection)
      .update(id, { nextSyncAt: new Date(0) });
  };

  beforeAll(async () => {
    if (!new URL(testUrl).pathname.endsWith('_test'))
      throw new Error(
        'BANK_SYNC_TEST_DATABASE_URL database name must end with _test',
      );
    process.env.TOKEN = auth.authToken;
    process.env.PLAID_ENV = 'sandbox';
    const module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: testUrl,
          entities: dataSource.options.entities,
          migrations: dataSource.options.migrations,
          migrationsRun: true,
          synchronize: false,
        }),
        BankingModule,
      ],
    })
      .overrideProvider(PlaidService)
      .useValue(plaid)
      .compile();
    banking = module.get(BankConnectionsService);
    jest.spyOn(banking, 'drain').mockResolvedValue(undefined); // Explicitly drive each sync.
    app = module.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
    db = module.get(DataSource);
  }, 30000);
  beforeEach(async () => {
    await db.query(
      'TRUNCATE bank_connections, bank_imports, bank_transactions, category_rules RESTART IDENTITY CASCADE',
    );
    Object.values(sdk).forEach((mock) => mock.mockReset());
    plaid.verifyWebhook.mockReset().mockResolvedValue(undefined);
    sdk.itemPublicTokenExchange.mockResolvedValue({
      data: { access_token: 'access-secret', item_id: 'item-1' },
    });
    sdk.accountsGet.mockResolvedValue({
      data: { accounts: [account], item: { institution_id: 'ins-1' } },
    });
    sdk.institutionsGetById.mockResolvedValue({
      data: { institution: { name: 'Test bank' } },
    });
    sdk.transactionsSync.mockResolvedValue(page());
    sdk.itemRemove.mockResolvedValue({ data: {} });
    sdk.transactionsRefresh.mockResolvedValue({ data: {} });
    sdk.linkTokenCreate.mockResolvedValue({
      data: { link_token: 'link-test' },
    });
  });
  afterAll(async () => {
    if (app) await app.close();
    if (previousToken === undefined) delete process.env.TOKEN;
    else process.env.TOKEN = previousToken;
    if (previousBankEnvironment === undefined) delete process.env.PLAID_ENV;
    else process.env.PLAID_ENV = previousBankEnvironment;
  });

  it('authenticates connection endpoints and validates public-token input', async () => {
    await api().get('/api/bank-connections').expect(401);
    await api()
      .post('/api/bank-connections/exchange')
      .set(auth)
      .send({ publicToken: '', importStartDate: '2026-02-30' })
      .expect(400);
    expect(sdk.itemPublicTokenExchange).not.toHaveBeenCalled();
  });
  it('encrypts stored tokens, omits secrets from state, and initializes transaction sync', async () => {
    const id = await connect();
    const [stored] = await db.query(
      'SELECT access_token FROM bank_connections WHERE id=$1',
      [id],
    );
    expect(stored.access_token).not.toContain('access-secret');
    expect(plaid.cipher.decrypt(stored.access_token)).toBe('access-secret');
    const state = await api()
      .get('/api/bank-connections')
      .set(auth)
      .expect(200);
    expect(state.text).not.toMatch(/access-secret|item-1|accessToken|cursor/);
    sdk.transactionsSync.mockResolvedValue(page([transaction('t-1')]));
    await banking.sync(id);
    expect(sdk.transactionsSync).toHaveBeenCalledWith({
      access_token: 'access-secret',
      cursor: undefined,
      count: 500,
    });
    const result = await api().get('/api/dashboard').set(auth).expect(200);
    expect(result.body.kpis).toMatchObject({ outflow: 1234, count: 1 });
    expect(result.body.transactions[0]).toMatchObject({
      providerTransactionId: 't-1',
      amountCents: -1234,
      category: 'Dining',
    });
  });
  it('respects the import boundary, signs credits correctly, and applies saved category rules', async () => {
    const id = await connect();
    await db.query(
      "INSERT INTO category_rules(pattern, category, updated_at) VALUES ('coffee', 'Shopping', now())",
    );
    sdk.transactionsSync.mockResolvedValue(
      page([
        transaction('old', { date: '2026-09-30' }),
        transaction('debit'),
        transaction('credit', {
          name: 'Payroll',
          amount: -2500,
          personal_finance_category: { primary: 'INCOME' },
        }),
      ]),
    );
    await banking.sync(id);
    const rows = await db.getRepository(BankTransaction).find();
    expect(rows).toHaveLength(2);
    expect(
      rows.find((t) => t.providerTransactionId === 'credit'),
    ).toMatchObject({ amountCents: 250000, category: 'Income' });
    expect(rows.find((t) => t.providerTransactionId === 'debit')).toMatchObject(
      { amountCents: -1234, category: 'Shopping' },
    );
    await due(id);
    sdk.transactionsSync.mockResolvedValue(
      page([], { modified: [transaction('debit', { amount: 20 })] }),
    );
    await banking.sync(id);
    expect(
      await db
        .getRepository(BankTransaction)
        .findOneByOrFail({ providerTransactionId: 'debit' }),
    ).toMatchObject({ amountCents: -2000, category: 'Shopping' });
  });

  it('isolates Sandbox connections and transactions from Production while keeping CSV history visible', async () => {
    const id = await connect();
    sdk.transactionsSync.mockResolvedValue(page([transaction('sample')]));
    await banking.sync(id);
    const [source] = await db.query(
      "INSERT INTO bank_imports(filename, sha256, row_count) VALUES ('history.csv', $1, 1) RETURNING id",
      ['f'.repeat(64)],
    );
    const csv = await db
      .getRepository(BankTransaction)
      .save({
        importId: source.id,
        date: '2026-10-19',
        description: 'CSV history',
        amountCents: -100,
        category: 'Uncategorized',
      });
    const previousEnvironment = process.env.PLAID_ENV;
    try {
      process.env.PLAID_ENV = 'production';
      plaid.configuration.environment = 'production';
      const result = await api().get('/api/dashboard').set(auth).expect(200);
      expect(result.body.kpis).toMatchObject({ count: 1, outflow: 100 });
      expect(result.body.transactions[0].id).toBe(csv.id);
      expect(
        (await api().get('/api/bank-connections').set(auth).expect(200)).body
          .connections,
      ).toEqual([]);
      expect(
        (await api().get('/api/transactions/ai-pending').set(auth).expect(200))
          .body,
      ).toEqual([csv.id]);
      sdk.transactionsSync.mockClear();
      await due(id);
      await BankConnectionsService.prototype.drain.call(banking);
      expect(sdk.transactionsSync).not.toHaveBeenCalled();
      await api().delete(`/api/bank-connections/${id}`).set(auth).expect(404);
    } finally {
      plaid.configuration.environment = 'sandbox';
      if (previousEnvironment === undefined) delete process.env.PLAID_ENV;
      else process.env.PLAID_ENV = previousEnvironment;
    }
  });

  it('resumes persisted work in a new worker instance after a restart', async () => {
    const id = await connect();
    sdk.transactionsSync.mockResolvedValue(page([transaction('queued')]));
    const restarted = new BankConnectionsService(
      db,
      plaid as unknown as PlaidService,
      db.getRepository(BankConnection),
    );
    await restarted.drain();
    expect(await db.getRepository(BankTransaction).count()).toBe(1);
    expect(
      (await db.getRepository(BankConnection).findOneByOrFail({ id }))
        .lastSyncedAt,
    ).not.toBeNull();
    sdk.transactionsSync.mockClear();
    await restarted.drain();
    expect(sdk.transactionsSync).not.toHaveBeenCalled();
  });

  it('retries every page from the original cursor on pagination mutation and is idempotent', async () => {
    const id = await connect();
    sdk.transactionsSync
      .mockResolvedValueOnce(
        page([transaction('discarded')], {
          next_cursor: 'intermediate',
          has_more: true,
        }),
      )
      .mockRejectedValueOnce({
        response: {
          data: { error_code: 'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION' },
        },
      })
      .mockResolvedValueOnce(
        page([transaction('kept')], { next_cursor: 'restart', has_more: true }),
      )
      .mockResolvedValueOnce(
        page([transaction('kept-2')], { next_cursor: 'final' }),
      );
    await banking.sync(id);
    expect(sdk.transactionsSync.mock.calls.map(([r]) => r.cursor)).toEqual([
      undefined,
      'intermediate',
      undefined,
      'restart',
    ]);
    expect(
      (await db.getRepository(BankTransaction).find())
        .map((t) => t.providerTransactionId)
        .sort(),
    ).toEqual(['kept', 'kept-2']);
    await due(id);
    sdk.transactionsSync.mockResolvedValue(page([transaction('kept')]));
    await banking.sync(id);
    expect(await db.getRepository(BankTransaction).count()).toBe(2);
  });
  it('moves a pending record to posted without losing a manual category, then applies removals', async () => {
    const id = await connect();
    sdk.transactionsSync.mockResolvedValue(
      page([transaction('pending-1', { pending: true })]),
    );
    await banking.sync(id);
    const pending = await db
      .getRepository(BankTransaction)
      .findOneByOrFail({ providerTransactionId: 'pending-1' });
    await api()
      .patch(`/api/transactions/${pending.id}/category`)
      .set(auth)
      .send({ category: 'Shopping' })
      .expect(200);
    await due(id);
    sdk.transactionsSync.mockResolvedValue(
      page(
        [
          transaction('posted-1', {
            pending_transaction_id: 'pending-1',
            amount: 15,
          }),
        ],
        { removed: [{ transaction_id: 'pending-1' }] },
      ),
    );
    await banking.sync(id);
    expect(await db.getRepository(BankTransaction).find()).toEqual([
      expect.objectContaining({
        id: pending.id,
        providerTransactionId: 'posted-1',
        pending: false,
        amountCents: -1500,
        category: 'Shopping',
        categoryManuallySet: true,
      }),
    ]);
    await due(id);
    sdk.transactionsSync.mockResolvedValue(
      page([], { removed: [{ transaction_id: 'posted-1' }] }),
    );
    await banking.sync(id);
    expect(await db.getRepository(BankTransaction).count()).toBe(0);
  });
  it('keeps an existing pending record when its posted date crosses the import boundary', async () => {
    const id = await connect();
    sdk.transactionsSync.mockResolvedValue(
      page([transaction('pending-1', { pending: true })]),
    );
    await banking.sync(id);
    await due(id);
    sdk.transactionsSync.mockResolvedValue(
      page(
        [
          transaction('posted-1', {
            pending_transaction_id: 'pending-1',
            date: '2026-09-30',
          }),
        ],
        { removed: [{ transaction_id: 'pending-1' }] },
      ),
    );
    await banking.sync(id);
    expect(await db.getRepository(BankTransaction).count()).toBe(1);
    expect(
      (await db.getRepository(BankTransaction).find())[0].providerTransactionId,
    ).toBe('posted-1');
  });
  it('rolls back all transaction changes and the cursor when a later entry is invalid', async () => {
    const id = await connect();
    sdk.transactionsSync.mockResolvedValue(
      page([transaction('valid'), transaction('invalid', { amount: 1e12 })]),
    );
    await banking.sync(id);
    expect(await db.getRepository(BankTransaction).count()).toBe(0);
    const [state] = await db.query(
      'SELECT cursor, status FROM bank_connections WHERE id=$1',
      [id],
    );
    expect(state).toEqual({ cursor: null, status: 'error' });
    await due(id);
    sdk.transactionsSync.mockResolvedValue(page([transaction('valid')]));
    await banking.sync(id);
    expect(await db.getRepository(BankTransaction).count()).toBe(1);
  });
  it('uses database locks to avoid concurrent syncs of the same Item', async () => {
    const id = await connect();
    let release: (value: unknown) => void;
    let started: () => void;
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    sdk.transactionsSync.mockImplementationOnce(() => {
      started();
      return new Promise((resolve) => {
        release = resolve;
      });
    });
    const first = banking.sync(id);
    await entered;
    await banking.sync(id);
    expect(sdk.transactionsSync).toHaveBeenCalledTimes(1);
    release(page([transaction('t-1')]));
    await first;
    expect(await db.getRepository(BankTransaction).count()).toBe(1);
  });
  it('preserves the raw webhook body and queues work without the app auth token', async () => {
    const id = await connect();
    await banking.sync(id);
    const body =
      '{ "webhook_type": "TRANSACTIONS", "webhook_code": "SYNC_UPDATES_AVAILABLE", "item_id": "item-1" }';
    await api()
      .post('/api/bank-connections/webhook')
      .set('Content-Type', 'application/json')
      .set('Plaid-Verification', 'signed-test')
      .send(body)
      .expect(200);
    expect(plaid.verifyWebhook).toHaveBeenCalledWith(
      'signed-test',
      Buffer.from(body),
    );
    expect(
      (
        await db.getRepository(BankConnection).findOneByOrFail({ id })
      ).nextSyncAt.getTime(),
    ).toBeLessThanOrEqual(Date.now());
    plaid.verifyWebhook.mockRejectedValue(new UnauthorizedException());
    await api().post('/api/bank-connections/webhook').send({}).expect(401);
  });
  it('tracks login errors, supports update mode and limits paid refreshes', async () => {
    const id = await connect();
    sdk.transactionsSync.mockRejectedValueOnce({
      response: { data: { error_code: 'ITEM_LOGIN_REQUIRED' } },
    });
    await banking.sync(id);
    expect(
      (await db.getRepository(BankConnection).findOneByOrFail({ id })).status,
    ).toBe('attention');
    await api()
      .post(`/api/bank-connections/${id}/link-token`)
      .set(auth)
      .expect(201);
    expect(sdk.linkTokenCreate.mock.calls[0][0]).toMatchObject({
      access_token: 'access-secret',
    });
    expect(sdk.linkTokenCreate.mock.calls[0][0]).not.toHaveProperty('products');
    await api()
      .post(`/api/bank-connections/${id}/refresh`)
      .set(auth)
      .expect(201);
    await api()
      .post(`/api/bank-connections/${id}/refresh`)
      .set(auth)
      .expect(409);
    expect(sdk.transactionsRefresh).toHaveBeenCalledTimes(1);
  });
  it('retains the token when revocation fails, allowing disconnect to be retried', async () => {
    const id = await connect();
    sdk.itemRemove.mockRejectedValueOnce({
      response: { data: { error_code: 'INTERNAL_SERVER_ERROR' } },
    });
    await api().delete(`/api/bank-connections/${id}`).set(auth).expect(502);
    const [row] = await db.query(
      'SELECT access_token, status FROM bank_connections WHERE id=$1',
      [id],
    );
    expect(row.status).toBe('active');
    expect(row.access_token).not.toBeNull();
    await api().delete(`/api/bank-connections/${id}`).set(auth).expect(200);
  });

  it('revokes a new Item if unsupported currency prevents connection setup', async () => {
    sdk.accountsGet.mockResolvedValueOnce({
      data: {
        accounts: [{ ...account, balances: { iso_currency_code: 'EUR' } }],
        item: {},
      },
    });
    await api()
      .post('/api/bank-connections/exchange')
      .set(auth)
      .send({ publicToken: 'public-test', importStartDate: '2026-10-01' })
      .expect(400);
    expect(await db.getRepository(BankConnection).count()).toBe(0);
    expect(sdk.itemRemove).toHaveBeenCalledWith({
      access_token: 'access-secret',
    });
  });

  it('revokes bank access and erases its token on disconnect while keeping history', async () => {
    const id = await connect();
    sdk.transactionsSync.mockResolvedValue(page([transaction('t-1')]));
    await banking.sync(id);
    await api().delete(`/api/bank-connections/${id}`).set(auth).expect(200);
    expect(sdk.itemRemove).toHaveBeenCalledWith({
      access_token: 'access-secret',
    });
    const [row] = await db.query(
      'SELECT access_token, cursor, status FROM bank_connections WHERE id=$1',
      [id],
    );
    expect(row).toEqual({
      access_token: null,
      cursor: null,
      status: 'disconnected',
    });
    expect(await db.getRepository(BankTransaction).count()).toBe(1);
    await due(id);
    sdk.transactionsSync.mockClear();
    await banking.sync(id);
    expect(sdk.transactionsSync).not.toHaveBeenCalled();
    await api().delete(`/api/bank-connections/${id}`).set(auth).expect(200);
  });
});
