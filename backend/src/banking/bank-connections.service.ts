import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import {
  AccountBase,
  CountryCode,
  Products,
  Transaction,
  TransactionsSyncResponse,
} from 'plaid';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { BankConnection } from './entities/bank-connection.entity';
import { BankImport } from './entities/bank-import.entity';
import { BankTransaction } from './entities/bank-transaction.entity';
import { CategoryRule } from './entities/category-rule.entity';
import { ExchangePlaidTokenDto } from './dto/plaid.dto';
import { normalizeDescription } from './imports.service';
import { plaidErrorCode, PlaidService } from './plaid.service';

const RETRY_MS = 10 * 60 * 1000;
const ATTENTION = new Set([
  'ITEM_LOGIN_REQUIRED',
  'ITEM_LOCKED',
  'PENDING_EXPIRATION',
  'USER_PERMISSION_REVOKED',
  'USER_ACCOUNT_REVOKED',
  'ITEM_NOT_SUPPORTED',
  'ACCESS_NOT_GRANTED',
  'INVALID_ACCESS_TOKEN',
]);

@Injectable()
export class BankConnectionsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BankConnectionsService.name);
  private timer?: ReturnType<typeof setInterval>;
  private draining = false;
  private stopped = false;

  constructor(
    private readonly db: DataSource,
    private readonly plaid: PlaidService,
    @InjectRepository(BankConnection)
    private readonly connections: Repository<BankConnection>,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.drain();
    }, 30000);
    this.timer.unref();
    void this.drain();
  }
  onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
  }

  async state() {
    const connections = await this.connections.find({
      where: { environment: this.plaid.configuration.environment },
      order: { createdAt: 'DESC' },
    });
    const accounts = await this.db.getRepository(BankImport).find({
      where: { bankConnectionId: In(connections.map((c) => c.id)) },
      order: { id: 'ASC' },
    });
    return {
      ...this.plaid.configuration,
      connections: connections.map((c) => ({
        id: c.id,
        institutionName: c.institutionName,
        status: c.status,
        errorCode: c.errorCode,
        importStartDate: c.importStartDate,
        lastSyncedAt: c.lastSyncedAt,
        lastRefreshRequestedAt: c.lastRefreshRequestedAt,
        accounts: accounts
          .filter((a) => a.bankConnectionId === c.id)
          .map((a) => ({
            id: a.id,
            name: a.accountLabel,
            mask: a.accountNumber,
            type: a.accountType,
          })),
      })),
    };
  }

  async createLinkToken(id?: number) {
    const connection = id ? await this.secretConnection(id) : null;
    try {
      const { data } = await this.plaid.client.linkTokenCreate({
        user: { client_user_id: 'budget-app-owner' },
        client_name: 'Current Budget',
        language: 'en',
        country_codes: [CountryCode.Us],
        ...(connection
          ? { access_token: this.plaid.cipher.decrypt(connection.accessToken) }
          : {
              products: [Products.Transactions],
              transactions: { days_requested: 730 },
            }),
        ...(process.env.PLAID_WEBHOOK_URL
          ? { webhook: process.env.PLAID_WEBHOOK_URL }
          : {}),
        ...(process.env.PLAID_REDIRECT_URI
          ? { redirect_uri: process.env.PLAID_REDIRECT_URI }
          : {}),
      });
      return { linkToken: data.link_token };
    } catch (error) {
      this.providerFailure(error);
    }
  }

  async exchange(dto: ExchangePlaidTokenDto) {
    let token: string;
    let itemId: string;
    try {
      const { data } = await this.plaid.client.itemPublicTokenExchange({
        public_token: dto.publicToken,
      });
      token = data.access_token;
      itemId = data.item_id;
    } catch (error) {
      this.providerFailure(error);
    }
    let id: number;
    try {
      const { data } = await this.plaid.client.accountsGet({
        access_token: token,
      });
      if (
        data.accounts.some(
          (a) =>
            !!a.balances.unofficial_currency_code ||
            (a.balances.iso_currency_code &&
              a.balances.iso_currency_code !== 'USD'),
        )
      )
        throw new BadRequestException(
          'This budget currently supports USD bank accounts. Select only USD accounts.',
        );
      let institutionName = 'Connected bank';
      if (data.item.institution_id) {
        const institution = await this.plaid.client.institutionsGetById({
          institution_id: data.item.institution_id,
          country_codes: [CountryCode.Us],
        });
        institutionName = institution.data.institution.name;
      }
      id = await this.db.transaction(async (manager) => {
        const connection = await manager.save(
          BankConnection,
          manager.create(BankConnection, {
            itemId,
            environment: this.plaid.configuration.environment,
            accessToken: this.plaid.cipher.encrypt(token),
            institutionName,
            importStartDate: dto.importStartDate,
            cursor: null,
            status: 'active',
            errorCode: null,
            nextSyncAt: new Date(),
          }),
        );
        await this.saveAccounts(manager, connection, data.accounts);
        return connection.id;
      });
    } catch (error) {
      // Do not leave a billable orphaned Item when local setup fails.
      try {
        await this.plaid.client.itemRemove({ access_token: token });
      } catch {
        this.logger.warn(
          'Could not revoke an Item after connection setup failed. Check the Plaid dashboard.',
        );
      }
      if (error instanceof BadRequestException) throw error;
      this.providerFailure(error);
    }
    void this.drain();
    return {
      id,
      message:
        'Bank connected. Transactions will appear as Plaid makes them available.',
    };
  }

  async requestSync(id: number, refresh = false) {
    if (refresh && !this.plaid.configuration.refreshEnabled)
      throw new BadRequestException('On-demand bank refresh is not enabled.');
    await this.db.transaction(async (manager) => {
      const connection = await this.secretConnection(id, manager, true);
      if (refresh) {
        if (
          connection.lastRefreshRequestedAt &&
          Date.now() - connection.lastRefreshRequestedAt.getTime() < 5 * 60000
        )
          throw new ConflictException(
            'Wait five minutes before refreshing this bank again.',
          );
        try {
          await this.plaid.client.transactionsRefresh({
            access_token: this.plaid.cipher.decrypt(connection.accessToken),
          });
        } catch (error) {
          this.providerFailure(error);
        }
        connection.lastRefreshRequestedAt = new Date();
      }
      connection.nextSyncAt = new Date();
      await manager.save(connection);
    });
    void this.drain();
    return {
      message: refresh
        ? 'Bank refresh requested. New data will appear when available.'
        : 'Checking for available transactions.',
    };
  }

  async disconnect(id: number) {
    await this.db.transaction(async (manager) => {
      const connection = await this.secretConnection(id, manager, true, true);
      if (connection.status === 'disconnected') return;
      try {
        await this.plaid.client.itemRemove({
          access_token: this.plaid.cipher.decrypt(connection.accessToken),
        });
      } catch (error) {
        if (
          !['ITEM_NOT_FOUND', 'INVALID_ACCESS_TOKEN'].includes(
            plaidErrorCode(error),
          )
        )
          this.providerFailure(error);
      }
      connection.accessToken = null;
      connection.cursor = null;
      connection.status = 'disconnected';
      connection.errorCode = null;
      await manager.save(connection);
    });
    return {
      message: 'Bank disconnected. Previously imported transactions are kept.',
    };
  }

  async webhook(body: {
    webhook_type?: string;
    webhook_code?: string;
    item_id?: string;
    environment?: string;
    error?: { error_code?: string };
  }) {
    if (
      body.environment &&
      body.environment !== this.plaid.configuration.environment
    )
      return { received: true };
    if (typeof body.item_id !== 'string') return { received: true };
    const connection = await this.connections
      .createQueryBuilder('c')
      .where('c.item_id = :itemId', { itemId: body.item_id })
      .andWhere('c.environment = :environment', {
        environment: this.plaid.configuration.environment,
      })
      .getOne();
    if (!connection || connection.status === 'disconnected')
      return { received: true };
    if (
      body.webhook_type === 'TRANSACTIONS' &&
      body.webhook_code === 'SYNC_UPDATES_AVAILABLE'
    ) {
      // Commit the work before acknowledging: a restart cannot lose this webhook.
      await this.connections.update(
        { id: connection.id, status: In(['active', 'attention', 'error']) },
        { nextSyncAt: new Date() },
      );
      void this.drain();
    } else if (body.webhook_type === 'ITEM') {
      const code =
        body.webhook_code === 'ERROR'
          ? body.error?.error_code
          : body.webhook_code;
      if (code && ATTENTION.has(code))
        await this.connections.update(
          { id: connection.id, status: In(['active', 'attention', 'error']) },
          { status: 'attention', errorCode: code },
        );
    }
    return { received: true };
  }

  private async secretConnection(
    id: number,
    manager = this.db.manager,
    lock = false,
    allowDisconnected = false,
  ) {
    const query = manager
      .getRepository(BankConnection)
      .createQueryBuilder('c')
      .addSelect(['c.accessToken', 'c.itemId', 'c.cursor'])
      .where('c.id = :id', { id })
      .andWhere('c.environment = :environment', {
        environment: this.plaid.configuration.environment,
      });
    if (lock) query.setLock('pessimistic_write');
    const connection = await query.getOne();
    if (
      !connection ||
      (!allowDisconnected && connection.status === 'disconnected')
    )
      throw new NotFoundException('Bank connection not found.');
    return connection;
  }

  private async saveAccounts(
    manager: EntityManager,
    connection: BankConnection,
    accounts: AccountBase[],
  ) {
    const result = new Map<string, BankImport>();
    for (const account of accounts) {
      let row = await manager.findOneBy(BankImport, {
        providerAccountId: account.account_id,
      });
      const fields = {
        bankConnectionId: connection.id,
        providerAccountId: account.account_id,
        accountLabel: `${connection.institutionName} · ${account.name}`,
        accountNumber: account.mask || '',
        accountType: account.subtype || account.type,
      };
      if (!row)
        row = manager.create(BankImport, {
          ...fields,
          filename: 'Plaid automatic sync',
          sha256: createHash('sha256')
            .update(`plaid:${account.account_id}`)
            .digest('hex'),
          minDate: null,
          maxDate: null,
          rowCount: 0,
          importStatus: 'completed',
        });
      else Object.assign(row, fields);
      result.set(account.account_id, await manager.save(row));
    }
    return result;
  }

  /** The cursor and every page commit together. Restart ALL pages on mutation. */
  private async fetchChanges(token: string, originalCursor: string | null) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const pages: TransactionsSyncResponse[] = [];
      let cursor = originalCursor || undefined;
      try {
        do {
          const { data } = await this.plaid.client.transactionsSync({
            access_token: token,
            cursor,
            count: 500,
          });
          pages.push(data);
          cursor = data.next_cursor;
        } while (pages[pages.length - 1].has_more);
        return { pages, cursor: cursor || null };
      } catch (error) {
        if (
          plaidErrorCode(error) !==
            'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION' ||
          attempt === 2
        )
          throw error;
      }
    }
    throw new Error('Sync pagination failed');
  }

  async sync(id: number) {
    await this.db.transaction(async (manager) => {
      // A nonblocking database lock coordinates workers across API processes.
      const [lock] = await manager.query(
        'SELECT pg_try_advisory_xact_lock(179400, $1) AS acquired',
        [id],
      );
      if (!lock.acquired) return;
      const connection = await this.secretConnection(id, manager, true, true);
      if (
        connection.status === 'disconnected' ||
        connection.nextSyncAt.getTime() > Date.now()
      )
        return;
      await manager.query('SAVEPOINT bank_sync');
      try {
        const token = this.plaid.cipher.decrypt(connection.accessToken);
        const changes = await this.fetchChanges(token, connection.cursor);
        const { data } = await this.plaid.client.accountsGet({
          access_token: token,
        });
        const accounts = await this.saveAccounts(
          manager,
          connection,
          data.accounts,
        );
        const rules = new Map(
          (await manager.find(CategoryRule)).map((r) => [
            r.pattern,
            r.category,
          ]),
        );
        // Apply all upserts before removals so pending edits can move to posted entries.
        for (const page of changes.pages) {
          for (const transaction of [...page.added, ...page.modified])
            await this.saveTransaction(
              manager,
              connection,
              accounts,
              rules,
              transaction,
            );
        }
        const removed = changes.pages.flatMap((p) =>
          p.removed.map((t) => t.transaction_id),
        );
        const storedAccounts = await manager.findBy(BankImport, {
          bankConnectionId: connection.id,
        });
        if (removed.length && storedAccounts.length)
          await manager.delete(BankTransaction, {
            providerTransactionId: In(removed),
            importId: In(storedAccounts.map((a) => a.id)),
          });
        for (const account of storedAccounts) {
          const [stats] = await manager.query(
            'SELECT count(*)::integer AS count, min(date) AS min, max(date) AS max FROM bank_transactions WHERE import_id = $1',
            [account.id],
          );
          await manager.update(BankImport, account.id, {
            rowCount: stats.count,
            minDate: stats.min,
            maxDate: stats.max,
          });
        }
        connection.cursor = changes.cursor;
        connection.lastSyncedAt = new Date();
        connection.status = 'active';
        connection.errorCode = null;
      } catch (error) {
        // Roll back every page and account change before recording a failure.
        if ((error as { driverError?: unknown })?.driverError) throw error;
        await manager.query('ROLLBACK TO SAVEPOINT bank_sync');
        connection.errorCode = plaidErrorCode(error);
        connection.status = ATTENTION.has(connection.errorCode)
          ? 'attention'
          : 'error';
        this.logger.warn(
          `Bank sync failed for connection ${id}: ${connection.errorCode}`,
        );
      }
      await manager.query('RELEASE SAVEPOINT bank_sync');
      connection.nextSyncAt = new Date(
        Date.now() +
          (connection.status === 'active' && !connection.cursor
            ? 30000
            : RETRY_MS),
      );
      await manager.save(connection);
    });
  }

  private async saveTransaction(
    manager: EntityManager,
    connection: BankConnection,
    accounts: Map<string, BankImport>,
    rules: Map<string, string>,
    transaction: Transaction,
  ) {
    if (
      transaction.unofficial_currency_code ||
      (transaction.iso_currency_code && transaction.iso_currency_code !== 'USD')
    )
      throw new BadRequestException(
        'Only USD bank transactions are supported.',
      );
    const account = accounts.get(transaction.account_id);
    if (!account) throw new Error('Unknown bank account');
    const repository = manager.getRepository(BankTransaction);
    let row = await repository.findOneBy({
      providerTransactionId: transaction.transaction_id,
    });
    if (!row && transaction.pending_transaction_id)
      row = await repository.findOneBy({
        providerTransactionId: transaction.pending_transaction_id,
        importId: account.id,
      });
    // Existing/pending records still receive corrections across the start date.
    if (!row && transaction.date < connection.importStartDate) return;
    const description =
      transaction.name || transaction.merchant_name || 'Bank transaction';
    const amountCents = -Math.round(transaction.amount * 100); // Plaid: positive = debit; app: negative = debit.
    if (
      !Number.isSafeInteger(amountCents) ||
      Math.abs(amountCents) > 2147483647
    )
      throw new Error('Bank amount out of range');
    if (!row)
      row = repository.create({
        importId: account.id,
        category:
          rules.get(normalizeDescription(description)) ||
          this.category(transaction),
        categoryManuallySet: false,
      });
    Object.assign(row, {
      providerTransactionId: transaction.transaction_id,
      date: transaction.date,
      description,
      amountCents,
      pending: transaction.pending,
    });
    // Only bank fields are updated on existing records, preserving user category edits.
    if (row.id)
      await repository.update(row.id, {
        providerTransactionId: row.providerTransactionId,
        date: row.date,
        description: row.description,
        amountCents: row.amountCents,
        pending: row.pending,
      });
    else await repository.save(row);
  }

  private category(transaction: Transaction): string {
    const categories: Record<string, string> = {
      INCOME: 'Income',
      TRANSFER_IN: 'Transfer',
      TRANSFER_OUT: 'Transfer',
      LOAN_PAYMENTS: 'Transfer',
      BANK_FEES: 'Fees',
      ENTERTAINMENT: 'Entertainment',
      FOOD_AND_DRINK: 'Dining',
      GENERAL_MERCHANDISE: 'Shopping',
      HOME_IMPROVEMENT: 'Shopping',
      MEDICAL: 'Health',
      PERSONAL_CARE: 'Health',
      GENERAL_SERVICES: 'Bills',
      GOVERNMENT_AND_NON_PROFIT: 'Bills',
      TRANSPORTATION: 'Transport',
      TRAVEL: 'Travel',
      RENT_AND_UTILITIES: 'Bills',
    };
    const detail = transaction.personal_finance_category?.detailed || '';
    if (detail === 'FOOD_AND_DRINK_GROCERIES') return 'Groceries';
    if (detail === 'RENT_AND_UTILITIES_RENT') return 'Housing';
    return (
      categories[transaction.personal_finance_category?.primary] ||
      'Uncategorized'
    );
  }

  async drain() {
    if (this.draining || this.stopped || !this.plaid.configuration.enabled)
      return;
    this.draining = true;
    try {
      const due = await this.connections
        .createQueryBuilder('c')
        .where("c.status <> 'disconnected' AND c.next_sync_at <= now()")
        .andWhere('c.environment = :environment', {
          environment: this.plaid.configuration.environment,
        })
        .orderBy('c.next_sync_at', 'ASC')
        .take(20)
        .getMany();
      for (const connection of due) {
        if (this.stopped) break;
        try {
          await this.sync(connection.id);
        } catch {
          this.logger.warn(
            `Bank sync could not commit for connection ${connection.id}; it will be retried.`,
          );
        }
      }
    } catch {
      this.logger.warn('Bank sync queue is unavailable; it will be retried.');
    } finally {
      this.draining = false;
    }
  }

  private providerFailure(error: unknown): never {
    if (error instanceof ServiceUnavailableException) throw error;
    throw new BadGatewayException(
      `Bank provider request failed (${plaidErrorCode(error)}). Please try again.`,
    );
  }
}
