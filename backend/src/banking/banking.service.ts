import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BankImport } from './entities/bank-import.entity';
import { BankTransaction } from './entities/bank-transaction.entity';
import { CategoryLimit } from './entities/category-limit.entity';
import { DashboardQuery } from './dto/dashboard-query.dto';
import { SetCategoryLimitDto } from './dto/set-category-limit.dto';

export interface DashboardResult { kpis: { inflow: number; outflow: number; net: number; count: number }; series: { labels: string[]; values: number[] }; categories: { labels: string[]; values: number[] }; transactions: BankTransaction[]; imports: BankImport[]; months: string[]; categoryLimits: Record<string, number>; }
@Injectable()
export class BankingService {
  constructor(@InjectRepository(BankTransaction) private readonly transactions: Repository<BankTransaction>, @InjectRepository(BankImport) private readonly imports: Repository<BankImport>, @InjectRepository(CategoryLimit) private readonly limits: Repository<CategoryLimit>) {}
  async getTransactions(query: DashboardQuery): Promise<BankTransaction[]> { return this.filtered(query).orderBy('t.date', 'DESC').addOrderBy('t.id', 'DESC').getMany(); }
  async getDashboard(query: DashboardQuery): Promise<DashboardResult> {
    const rows = await this.getTransactions(query); const inflow = rows.reduce((n, r) => n + Math.max(0, r.amountCents), 0); const outflow = rows.reduce((n, r) => n + Math.max(0, -r.amountCents), 0); const monthly = new Map<string, number>(); const categories = new Map<string, number>();
    rows.forEach(r => { monthly.set(r.date.slice(0, 7), (monthly.get(r.date.slice(0, 7)) || 0) + r.amountCents); categories.set(r.category, (categories.get(r.category) || 0) + Math.abs(r.amountCents)); });
    const ids = [...new Set(rows.map(r => r.importId))]; const imports = ids.length ? await this.imports.findByIds(ids) : [];
    const globalMonths = await this.transactions.createQueryBuilder('t').select('DISTINCT to_char(t.date, \'YYYY-MM\')', 'month').orderBy('month', 'DESC').getRawMany();
    const limits = Object.fromEntries((await this.limits.find()).map(l => [l.category, l.limitCents]));
    const labels = [...monthly.keys()].sort(); return { kpis: { inflow, outflow, net: inflow - outflow, count: rows.length }, series: { labels, values: labels.map(k => monthly.get(k)!) }, categories: { labels: [...categories.keys()], values: [...categories.values()] }, transactions: rows, imports: imports.sort((a, b) => b.id - a.id), months: globalMonths.map(r => r.month), categoryLimits: limits };
  }
  async getCategoryLimits(): Promise<CategoryLimit[]> { return this.limits.find(); }
  async setCategoryLimit(dto: SetCategoryLimitDto): Promise<void> { await this.limits.upsert({ category: dto.category, limitCents: dto.limitCents, updatedAt: new Date() }, ['category']); }
  async deleteCategoryLimit(category: string): Promise<void> { await this.limits.delete({ category }); }
  private filtered(query: DashboardQuery) { const qb = this.transactions.createQueryBuilder('t'); if (query.month) { const start = `${query.month}-01`; const [year, month] = query.month.split('-').map(Number); const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10); qb.andWhere('t.date >= :start AND t.date <= :end', { start, end }); } else { if (query.startDate) qb.andWhere('t.date >= :start', { start: query.startDate }); if (query.endDate) qb.andWhere('t.date <= :end', { end: query.endDate }); } if (query.category) qb.andWhere('t.category = :category', { category: query.category }); if (query.search) qb.andWhere('t.description ILIKE :search', { search: `%${query.search}%` }); return qb; }
}
