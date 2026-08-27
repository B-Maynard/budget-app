import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { createHash } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { BankImport } from './entities/bank-import.entity';
import { BankTransaction } from './entities/bank-transaction.entity';
import { parseBankCsv } from './csv-import';
import { CategorizationService } from './categorization.service';

export interface ImportResult { id: number; rows: number; imported: number; skipped: number; sha256: string; message: string; accountNumber: string; accountType: string; }
export interface ImportStatus { id: number; status: string; rows: number; }
export interface UploadedCsv { buffer: Buffer; originalname?: string; }
export function normalizeDescription(value: string): string { return String(value || '').trim().toLowerCase().replace(/\s+/g, ' '); }

@Injectable()
export class ImportsService {
  constructor(private readonly dataSource: DataSource, private readonly categorization: CategorizationService, @InjectRepository(BankImport) private readonly imports: Repository<BankImport>) {}

  async importCsv(file: UploadedCsv, accountLabel = ''): Promise<ImportResult> {
    if (!file?.buffer?.length) throw new BadRequestException('file required');
    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    let parsed; try { parsed = parseBankCsv(file.buffer.toString('utf8'), accountLabel); } catch (e) { throw new BadRequestException((e as Error).message); }
    const total = parsed.rows.length;
    const id = await this.dataSource.transaction(async manager => {
      const old = await manager.findOne(BankImport, { where: { sha256 } }); if (old) await manager.remove(old);
      const candidate = new Set(parsed.rows.map(r => `${r.date}|${r.amountCents}`));
      const existing = await manager.createQueryBuilder(BankTransaction, 't').innerJoinAndSelect('t.import', 'i').where("t.date::text || '|' || t.amountCents::text IN (:...keys)", { keys: [...candidate] }).getMany();
      const counts = new Map<string, number>(); existing.forEach(t => { const k = this.key(t.date, t.amountCents, t.description, t.import); counts.set(k, (counts.get(k) || 0) + 1); });
      const seen = new Map<string, number>(); const rows = parsed.rows.filter(r => { const k = this.key(r.date, r.amountCents, r.description, { accountLabel, accountNumber: parsed.accountNumber, accountType: parsed.accountType } as BankImport); const n = seen.get(k) || 0; seen.set(k, n + 1); return n === (counts.get(k) || 0); });
      const entity = manager.create(BankImport, { filename: file.originalname || 'upload.csv', accountLabel, accountNumber: parsed.accountNumber, accountType: parsed.accountType, sha256, minDate: rows.length ? rows.reduce((a, b) => a.date < b.date ? a : b).date : null, maxDate: rows.length ? rows.reduce((a, b) => a.date > b.date ? a : b).date : null, rowCount: rows.length, importStatus: 'pending' });
      const saved = await manager.save(entity);
      await manager.save(rows.map(r => manager.create(BankTransaction, { importId: saved.id, date: r.date, description: r.description, amountCents: r.amountCents, category: 'Uncategorized' })));
      return saved.id;
    });
    void this.categorization.categorizeImport(id);
    const skipped = total - (await this.imports.findOneByOrFail({ id })).rowCount;
    return { id, rows: total, imported: total - skipped, skipped, sha256, message: `Added ${total - skipped} new transaction(s); skipped ${skipped} duplicate(s)`, accountNumber: parsed.accountNumber, accountType: parsed.accountType };
  }
  async getImportStatus(id: number): Promise<ImportStatus> { const row = await this.imports.findOne({ where: { id }, select: ['id', 'importStatus', 'rowCount'] }); if (!row) throw new NotFoundException('import not found'); return { id: row.id, status: row.importStatus, rows: row.rowCount }; }
  private key(date: string, amount: number, description: string, i: Partial<BankImport>): string { return `${date}|${amount}|${normalizeDescription(description)}|${i.accountLabel || ''}|${i.accountNumber || ''}|${i.accountType || ''}`; }
}
