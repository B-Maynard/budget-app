import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { BankImport } from './entities/bank-import.entity';
import { BankTransaction } from './entities/bank-transaction.entity';
import { CategoryRule } from './entities/category-rule.entity';
import { BANKING_CATEGORIES } from './banking.constants';
import { normalizeDescription } from './imports.service';

const keywordMap: [string[], string][] = [
  [['payroll', 'salary', 'deposit', 'direct dep'], 'Income'], [['rent', 'mortgage', 'landlord'], 'Housing'], [['electric', 'water', 'internet', 'utility', 'phone'], 'Bills'], [['grocery', 'supermarket', 'whole foods', 'market'], 'Groceries'], [['restaurant', 'cafe', 'coffee', 'doordash', 'uber eats'], 'Dining'], [['uber', 'lyft', 'transit', 'parking', 'fuel', 'gas '], 'Transport'], [['doctor', 'clinic', 'pharmacy', 'medical', 'health'], 'Health'], [['fee', 'service charge', 'overdraft'], 'Fees'], [['transfer', 'venmo', 'paypal', 'zelle'], 'Transfer'], [['hotel', 'airline', 'flight'], 'Travel'], [['netflix', 'spotify', 'cinema', 'movie'], 'Entertainment']];
function keyword(description: string): string { const d = normalizeDescription(description); return keywordMap.find(([words]) => words.some(w => d.includes(w)))?.[1] || 'Uncategorized'; }

@Injectable()
export class CategorizationService {
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
  private async ollama(rows: BankTransaction[]): Promise<Map<string, string>> { const prompt = `Classify each description into exactly one of ${BANKING_CATEGORIES.join(', ')}. Return only JSON mapping description to category.\n${JSON.stringify(rows.map(r => ({ description: r.description, amount_cents: r.amountCents })))} `; const response = await fetch(`${process.env.OLLAMA_URL!.replace(/\/$/, '')}/api/generate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: process.env.OLLAMA_MODEL || 'llama3', prompt, format: 'json', stream: false }) }); if (!response.ok) throw new Error('Ollama failed'); const body = await response.json() as { response?: string }; const data = JSON.parse(body.response || '{}'); return new Map(Object.entries(data).filter(([, value]) => (BANKING_CATEGORIES as readonly string[]).includes(value as string)).map(([key, value]) => [normalizeDescription(key), value as string])); }
}
