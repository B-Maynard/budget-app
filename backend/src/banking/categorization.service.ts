import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { choice, TypeSafeClient } from '@typesafe-ai/sdk';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { BankImport } from './entities/bank-import.entity';
import { BankTransaction } from './entities/bank-transaction.entity';
import { CategoryRule } from './entities/category-rule.entity';
import { BANKING_CATEGORIES } from './banking.constants';
import { normalizeDescription } from './imports.service';
import { currentTransactions } from './current-transactions';

const keywordMap: [string[], string][] = [
  [['payroll', 'salary', 'deposit', 'direct dep'], 'Income'], [['rent', 'mortgage', 'landlord'], 'Housing'], [['electric', 'water', 'internet', 'utility', 'phone'], 'Bills'], [['grocery', 'supermarket', 'whole foods', 'market'], 'Groceries'], [['restaurant', 'cafe', 'coffee', 'doordash', 'uber eats'], 'Dining'], [['uber', 'lyft', 'transit', 'parking', 'fuel', 'gas '], 'Transport'], [['doctor', 'clinic', 'pharmacy', 'medical', 'health'], 'Health'], [['fee', 'service charge', 'overdraft'], 'Fees'], [['transfer', 'venmo', 'paypal', 'zelle'], 'Transfer'], [['hotel', 'airline', 'flight'], 'Travel'], [['netflix', 'spotify', 'cinema', 'movie'], 'Entertainment']];
function keyword(description: string): string { const d = normalizeDescription(description); return keywordMap.find(([words]) => words.some(w => d.includes(w)))?.[1] || 'Uncategorized'; }

// Jev only judges (it can't write text), so it picks one label from this list. Uncategorized is what it's rescuing us from.
const JEV_CATEGORIES: Record<string, string> = {
  Housing: 'rent, mortgage, property tax, home insurance, HOA', Bills: 'recurring utilities, phone, internet, insurance, subscriptions to services',
  Groceries: 'supermarkets and food shopping', Dining: 'restaurants, cafes, bars, takeout and food delivery', Transport: 'fuel, rideshare, transit, parking, car payments and repairs',
  Shopping: 'retail, online shopping, clothing, household goods', Health: 'doctors, dental, pharmacy, gym, medical bills', Income: 'paychecks, deposits, refunds, interest received',
  Transfer: 'moving money between accounts, person-to-person payments, credit card or loan payments', 'One Time Payment': 'a single large or unusual purchase that fits no regular category',
  Entertainment: 'streaming, games, movies, events, hobbies', Fees: 'bank fees, overdraft, service charges, interest charged, late fees', Travel: 'flights, hotels, rental cars, vacation spending',
};

// Jev's confidence in its pick must reach this, or the entry is left as it was for the user to categorize.
// ponytail: 0.6 is a guess, not measured on real transactions. Tune it after looking at a run's "left for you" count.
const JEV_MIN_CONFIDENCE = 0.6;

@Injectable()
export class CategorizationService {
  private jev?: TypeSafeClient;
  constructor(private readonly dataSource: DataSource, @InjectRepository(BankImport) private readonly imports: Repository<BankImport>, @InjectRepository(BankTransaction) private readonly transactions: Repository<BankTransaction>, @InjectRepository(CategoryRule) private readonly rules: Repository<CategoryRule>) {}
  async categorizeImport(importId: number): Promise<void> {
    await this.imports.update(importId, { importStatus: 'categorizing' });
    try {
      const rows = await this.transactions.find({ where: { importId, category: 'Uncategorized', categoryManuallySet: false } });
      const saved = new Map((await this.rules.find()).map(r => [r.pattern, r.category]));
      for (let start = 0; start < rows.length; start += 100) {
        const batch = rows.slice(start, start + 100); let categories = new Map<string, string>();
        if (process.env.OLLAMA_URL) { try { categories = await this.ollama(batch); } catch { /* fallback below */ } }
        for (const row of batch) { const key = normalizeDescription(row.description); const category = saved.get(key) || categories.get(key) || keyword(row.description); if (category !== 'Uncategorized') await this.transactions.update({ id: row.id, category: 'Uncategorized', categoryManuallySet: false }, { category }); }
      }
      await this.imports.update(importId, { importStatus: 'completed' });
    } catch (error) {
      console.error('Categorization failed', { importId, error: error instanceof Error ? error.message : String(error) });
      await this.imports.update(importId, { importStatus: 'failed' });
    }
  }
  async updateTransactionCategory(id: number, category: string): Promise<void> { if (!(BANKING_CATEGORIES as readonly string[]).includes(category)) throw new Error('invalid category'); const row = await this.transactions.findOne({ where: { id } }); if (!row) throw new NotFoundException('not found'); await this.dataSource.transaction(async manager => { await manager.update(BankTransaction, id, { category, categoryManuallySet: true }); if (normalizeDescription(row.description)) await manager.upsert(CategoryRule, { pattern: normalizeDescription(row.description), category, updatedAt: new Date() }, ['pattern']); }); }
  /** Ids of every entry AI Categorization may change: not set by hand, and not covered by a saved rule. */
  async jevPendingIds(): Promise<number[]> {
    const ruled = new Set((await this.rules.find()).map(r => r.pattern));
    const rows = await currentTransactions(this.transactions).select(['t.id', 't.description']).andWhere('t.category_manually_set = false').orderBy('t.date', 'DESC').addOrderBy('t.id', 'DESC').getMany();
    return rows.filter(r => !ruled.has(normalizeDescription(r.description))).map(r => r.id);
  }
  /** Asks Jev for the best-fit category of one entry and saves it (unless the user set it by hand meanwhile). */
  async jevCategorize(id: number): Promise<{ category: string; changed: boolean; lowConfidence?: boolean }> {
    if (!process.env.TYPESAFE_API_KEY?.trim()) throw new ServiceUnavailableException('Jev is not configured (set TYPESAFE_API_KEY)');
    const row = await this.transactions.findOne({ where: { id } }); if (!row) throw new NotFoundException('not found');
    if (row.categoryManuallySet) return { category: row.category, changed: false };
    this.jev ??= new TypeSafeClient({ apiKey: process.env.TYPESAFE_API_KEY.trim(), defaultModel: process.env.TYPESAFE_MODEL?.trim() || 'jev-1.13.0', retry: { maxRetries: 1 } });
    // The bank's words go in `state`, never in the instructions.
    const { answers } = await this.jev.systemOne({ state: { description: row.description, amount_dollars: row.amountCents / 100 }, questions: { category: choice('Which category best fits this bank transaction? A negative amount is money spent, a positive amount is money received.', JEV_CATEGORIES) } });
    const { choice: category, confidence } = answers.category;
    if (confidence < JEV_MIN_CONFIDENCE) return { category: row.category, changed: false, lowConfidence: true };
    const { affected } = await this.transactions.update({ id, categoryManuallySet: false }, { category });
    return { category, changed: !!affected && category !== row.category };
  }
  private async ollama(rows: BankTransaction[]): Promise<Map<string, string>> { const prompt = `Classify each description into exactly one of ${BANKING_CATEGORIES.join(', ')}. Return only JSON mapping description to category.\n${JSON.stringify(rows.map(r => ({ description: r.description, amount_cents: r.amountCents })))} `; const response = await fetch(`${process.env.OLLAMA_URL!.replace(/\/$/, '')}/api/generate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: process.env.OLLAMA_MODEL || 'llama3', prompt, format: 'json', stream: false }) }); if (!response.ok) throw new Error('Ollama failed'); const body = await response.json() as { response?: string }; const data = JSON.parse(body.response || '{}'); return new Map(Object.entries(data).filter(([, value]) => (BANKING_CATEGORIES as readonly string[]).includes(value as string)).map(([key, value]) => [normalizeDescription(key), value as string])); }
}
