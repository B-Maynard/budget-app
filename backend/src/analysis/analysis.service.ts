import { ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository, Between, In, MoreThan } from 'typeorm';
import { AiJob } from '../banking/entities/ai-job.entity';
import { BankTransaction } from '../banking/entities/bank-transaction.entity';
import { CategoryLimit } from '../banking/entities/category-limit.entity';
import { DescriptionObfuscation } from '../banking/entities/description-obfuscation.entity';
import { Debt } from '../banking/entities/debt.entity';
import { DebtsService } from '../debts/debts.service';

export interface SpendingMetrics { period: any; kpis: any; priorPeriod: any; periodChangePercentages: any; categorySpending: any; categorySpendingPercentages: any; categoryLimits: any; largestExpenses: any[]; weeklySpending: any; frequentPayees: any[]; recurringTransactions: RecurringItem[]; }
export interface RecurringItem { description: string; occurrences: number; averageAmount: number; estimatedMonthlyCost: number; dates: string[]; }

const day = (s: string, n: number) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const money = (n: number) => `$${(n / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (a: number, b: number) => b ? Math.round((a - b) * 10000 / b) / 100 : null;

@Injectable()
export class AnalysisService {
  constructor(
    @InjectRepository(AiJob) private readonly jobs: Repository<AiJob>,
    @InjectRepository(BankTransaction) private readonly transactions: Repository<BankTransaction>,
    @InjectRepository(CategoryLimit) private readonly limits: Repository<CategoryLimit>,
    @InjectRepository(DescriptionObfuscation) private readonly obfuscations: Repository<DescriptionObfuscation>,
    @InjectRepository(Debt) private readonly debts: Repository<Debt>,
    private readonly debtService: DebtsService,
  ) {}

  normalizeDescription(value: string): string { return (value || '').trim().toLowerCase().replace(/\s+/g, ' '); }

  async getOrCreateObfuscation(description: string): Promise<string> {
    const normalizedDescription = this.normalizeDescription(description);
    const existing = await this.obfuscations.findOneBy({ normalizedDescription });
    if (existing) return existing.obfuscatedKey;
    for (let i = 0; i < 10; i++) {
      try { return (await this.obfuscations.save(this.obfuscations.create({ normalizedDescription, obfuscatedKey: `MERCHANT_${randomBytes(8).toString('hex')}` }))).obfuscatedKey; }
      catch { const found = await this.obfuscations.findOneBy({ normalizedDescription }); if (found) return found.obfuscatedKey; }
    }
    throw new Error('could not create unique obfuscation key');
  }

  restoreObfuscatedDescriptions(text: string, mappings: Map<string, string>): string { for (const [key, value] of mappings) text = text.replaceAll(key, value); return text; }

  private kpis(rows: BankTransaction[]) { return { inflow: rows.reduce((s, r) => s + Math.max(0, r.amountCents), 0), outflow: rows.reduce((s, r) => s - Math.min(0, r.amountCents), 0), net: rows.reduce((s, r) => s + r.amountCents, 0), count: rows.length }; }

  async calculateSpendingMetrics(startDate: string, endDate: string): Promise<SpendingMetrics> {
    const periodDays = Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000) + 1;
    const priorEnd = day(startDate, -1), priorStart = day(priorEnd, -(periodDays - 1));
    const [current, prior, limits] = await Promise.all([
      this.transactions.find({ where: { date: Between(startDate, endDate) }, order: { amountCents: 'ASC' } }),
      this.transactions.find({ where: { date: Between(priorStart, priorEnd) } }), this.limits.find(),
    ]);
    const kpis = this.kpis(current), previous = this.kpis(prior), expenses = current.filter(r => r.amountCents < 0);
    const categories: Record<string, number> = {}, weeks: Record<string, number> = {}, payees: Record<string, { count: number; total: number; description: string }> = {};
    for (const row of expenses) {
      categories[row.category] = (categories[row.category] || 0) - row.amountCents;
      const d = new Date(`${row.date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - d.getUTCDay() + (d.getUTCDay() === 0 ? -6 : 1)); const week = d.toISOString().slice(0, 10); weeks[week] = (weeks[week] || 0) - row.amountCents;
      const key = this.normalizeDescription(row.description); payees[key] ||= { count: 0, total: 0, description: row.description }; payees[key].count++; payees[key].total -= row.amountCents;
    }
    const categoryLimits: any = {}; for (const limit of limits) { const spent = categories[limit.category] || 0; categoryLimits[limit.category] = { limit: limit.limitCents, spent, remaining: Math.max(0, limit.limitCents - spent), percentUsed: Math.round(spent * 1000 / limit.limitCents) / 10 }; }
    return { period: { start: startDate, end: endDate }, kpis, priorPeriod: { start: priorStart, end: priorEnd, ...previous }, periodChangePercentages: { inflow: pct(kpis.inflow, previous.inflow), outflow: pct(kpis.outflow, previous.outflow), net: pct(kpis.net, previous.net) }, categorySpending: categories, categorySpendingPercentages: Object.fromEntries(Object.entries(categories).map(([k, v]) => [k, kpis.outflow ? Math.round(v * 10000 / kpis.outflow) / 100 : 0])), categoryLimits, largestExpenses: expenses.slice(0, 10).map(r => ({ description: r.description, amount: -r.amountCents, date: r.date, category: r.category })), weeklySpending: Object.fromEntries(Object.entries(weeks).sort()), frequentPayees: Object.values(payees).sort((a, b) => b.count - a.count || b.total - a.total).slice(0, 10), recurringTransactions: this.detectRecurring(expenses) };
  }

  detectRecurring(transactions: BankTransaction[]): RecurringItem[] {
    const groups: Record<string, BankTransaction[]> = {}; for (const row of transactions.filter(r => r.amountCents < 0)) (groups[this.normalizeDescription(row.description)] ||= []).push(row);
    return Object.values(groups).flatMap(rows => { if (rows.length < 3) return []; rows.sort((a, b) => a.date.localeCompare(b.date)); const amounts = rows.map(r => -r.amountCents), average = amounts.reduce((a, b) => a + b, 0) / amounts.length; if (Math.max(...amounts) - Math.min(...amounts) > Math.max(100, average * .1)) return []; const span = (Date.parse(`${rows.at(-1).date}T00:00:00Z`) - Date.parse(`${rows[0].date}T00:00:00Z`)) / 86400000; return [{ description: rows[0].description, occurrences: rows.length, averageAmount: Math.round(average), estimatedMonthlyCost: Math.round(span ? average * (rows.length - 1) / Math.max(1, span / 30.44) : average), dates: rows.map(r => r.date) }]; }).sort((a, b) => b.estimatedMonthlyCost - a.estimatedMonthlyCost);
  }

  async startSpendingAnalysis(startDate: string, endDate: string, provider = 'local'): Promise<AiJob> { this.validateProvider(provider); const job = await this.createJob('spending', startDate, endDate, provider); void this.runSpendingJob(job.id, startDate, endDate, provider).catch(() => undefined); return job; }
  async startDebtAnalysis(): Promise<AiJob> { this.validateProvider('cloud'); const job = await this.createJob('debt', null, null, 'cloud'); void this.runDebtJob(job.id).catch(() => undefined); return job; }
  async getStatus(kind: 'spending' | 'debt'): Promise<AiJob | null> { return this.jobs.findOne({ where: { analysisType: kind }, order: { id: 'DESC' } }); }
  private validateProvider(provider: string) { if (provider === 'cloud' && (!process.env.HERMES_URL || !process.env.HERMES_MODEL || !process.env.HERMES_API_KEY)) throw new ServiceUnavailableException('cloud AI is not configured'); if (provider !== 'local' && provider !== 'cloud') throw new Error('invalid provider'); }
  private async createJob(kind: string, startDate: string, endDate: string, provider: string) { if (await this.jobs.findOne({ where: { analysisType: kind, status: In(['queued', 'running']) } })) throw new ConflictException('analysis already running'); return this.jobs.save(this.jobs.create({ analysisType: kind, startDate, endDate, provider, status: 'queued', createdAt: new Date() })); }

  private async markRunning(id: number) { await this.jobs.update(id, { status: 'running', startedAt: new Date() }); }
  private async markCompleted(id: number, result: string) { await this.jobs.update(id, { status: 'completed', result, completedAt: new Date() }); }
  private async markFailed(id: number, error: string) { await this.jobs.update(id, { status: 'failed', error: error.replace(/\s+/g, ' ').slice(0, 500), completedAt: new Date() }); }
  private async runSpendingJob(id: number, start: string, end: string, provider: string) { try { await this.markRunning(id); const metrics = await this.calculateSpendingMetrics(start, end); let result: string; if (provider === 'local') result = await this.callOllamaAnalysis(this.spendingSystem(), `Investigate this spending data and report the most useful findings, not a generic summary:\n${JSON.stringify(this.serializedMetrics(metrics))}`); else { const mappings = new Map<string, string>(); const payload = await this.cloudSpending(metrics, mappings); result = this.restoreObfuscatedDescriptions(await this.callHermes(this.spendingCloudPrompt(payload)), mappings); } await this.markCompleted(id, result); } catch (e) { await this.markFailed(id, `AI analysis failed (${e instanceof Error ? e.name : 'unknown error'})`); } }

  private serializedMetrics(m: SpendingMetrics) { return { ...m, kpis: { ...m.kpis, inflow: money(m.kpis.inflow), outflow: money(m.kpis.outflow), net: money(m.kpis.net) }, priorPeriod: { ...m.priorPeriod, inflow: money(m.priorPeriod.inflow), outflow: money(m.priorPeriod.outflow), net: money(m.priorPeriod.net) }, periodChangePercentages: Object.fromEntries(['inflow', 'outflow', 'net'].map(k => [k, pct(m.kpis[k] as number, m.priorPeriod[k] as number)])), categorySpending: Object.fromEntries(Object.entries(m.categorySpending).map(([k, v]) => [k, money(v as number)])), largestExpenses: m.largestExpenses.map(x => ({ ...x, amount: money(x.amount) })) }; }
  private spendingSystem() { return 'You are an expert personal finance advisor analyzing real transaction data. The user wants actionable guidance, not a summary of what they already know.\n\nINSTRUCTIONS:\n- Analyze income vs spending: is the user living within their means?\n- Propose concrete monthly spending limits for each category based on observed income.\n- For each category with high spending: show current spend, proposed limit, and monthly reduction.\n- Identify specific transactions or categories to cut or reduce.\n- When category limits exist, analyze over-budget and under-budget categories and suggest adjustments.\n- Identify recurring subscriptions or payments that could be cancelled or reduced.\n- Flag any months where spending exceeded income and explain the gap.\n- Compare current month to prior month — what improved, what got worse.\n- Give concrete dollar amounts, not vague advice.\n- Use plain text with ALL CAPS headings and bullet points beginning with "-".'; }
  private async cloudSpending(m: SpendingMetrics, mappings: Map<string, string>) { const rows = await this.transactions.find({ where: { date: Between(m.period.start, m.period.end) } }); const merchants: any = {}; for (const row of rows.filter(r => r.amountCents < 0)) { const key = await this.getOrCreateObfuscation(row.description); mappings.set(key, row.description); merchants[key] ||= { key, category: row.category, dates: [], amount: 0 }; merchants[key].dates.push(row.date); merchants[key].amount -= row.amountCents; } const facts: any = this.serializedMetrics(m); facts.categoryLimits = Object.fromEntries(Object.entries(m.categoryLimits).map(([k, v]: [string, any]) => [k, { ...v, limit: money(v.limit), spent: money(v.spent), remaining: money(v.remaining) }])); for (const item of facts.largestExpenses) { const key = await this.getOrCreateObfuscation(item.description); mappings.set(key, item.description); item.description = key; } const frequent_payees = await Promise.all(m.frequentPayees.map(async p => { const key = await this.getOrCreateObfuscation(p.description); mappings.set(key, p.description); return { ...p, description: key, total: money(p.total) }; })); const recurring_transactions = await Promise.all(m.recurringTransactions.map(async p => { const key = await this.getOrCreateObfuscation(p.description); mappings.set(key, p.description); return { ...p, description: key, averageAmount: money(p.averageAmount), estimatedMonthlyCost: money(p.estimatedMonthlyCost) }; })); return { ...facts, merchants: Object.values(merchants).map((x: any) => ({ ...x, amount: money(x.amount) })), frequent_payees, recurring_transactions }; }
  private spendingCloudPrompt(payload: any) { return 'You are an expert personal finance advisor analyzing real transaction data. Merchant names are obfuscated for privacy — you may only refer to merchants by their obfuscated key (e.g. "MERCHANT_abc123").\n\nGive actionable advice, identify recurring payments, unusual expenses, changes, high categories, limits, weekly patterns, and debt/fee issues. Use concrete dollar amounts and dates, ALL CAPS headings, and bullets beginning with "-".\n\nDATA:\n' + JSON.stringify(payload, null, 2); }

  private async runDebtJob(id: number) { try { await this.markRunning(id); await this.debtService.findAll(); const debts = await this.debts.find({ where: { currentBalanceCents: MoreThan(0) }, order: { currentBalanceCents: 'DESC' } }); if (!debts.length) throw new Error('No active debts to analyze'); const mappings = new Map<string, string>(); const records = []; for (const d of debts) { const key = await this.getOrCreateObfuscation(d.name); mappings.set(key, d.name); records.push({ provider: key, apr_percent: Math.round(d.aprBps) / 100, starting_balance: money(d.startingBalanceCents), current_balance: money(d.currentBalanceCents), payment_amount: money(d.paymentAmountCents), payment_day: d.paymentDay }); } const now = new Date(), start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, end = day(start, new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0)).getUTCDate() - 1), rows = await this.transactions.find({ where: { date: Between(start, end) } }), k = this.kpis(rows); const payload = { debts: records, total_remaining: money(debts.reduce((s, d) => s + d.currentBalanceCents, 0)), total_monthly_payments: money(debts.reduce((s, d) => s + d.paymentAmountCents, 0)), current_month: { inflow: money(k.inflow), outflow: money(k.outflow), net: money(k.net), category_spending: Object.fromEntries(Object.entries(rows.filter(r => r.amountCents < 0).reduce((a, r) => { a[r.category] = (a[r.category] || 0) - r.amountCents; return a; }, {} as Record<string, number>)).map(([x, v]) => [x, money(v as number)])) } }; const prompt = 'You are an expert debt management advisor. Analyze this debt portfolio and provide actionable advice. Provider names are obfuscated for privacy — refer to them only by their key. Calculate payoff timelines, compare avalanche vs snowball, identify debt traps, and provide a concrete payoff plan and interest comparison. Use plain text with ALL CAPS headings and bullet points beginning with "-".\n\nDATA:\n' + JSON.stringify(payload, null, 2); await this.markCompleted(id, this.restoreObfuscatedDescriptions(await this.callHermes(prompt), mappings)); } catch (e) { await this.markFailed(id, `AI analysis failed (${e instanceof Error ? e.name : 'unknown error'})`); } }

  private async callOllamaAnalysis(systemPrompt: string, userPrompt: string): Promise<string> { const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 120000); try { const r = await fetch(`${process.env.OLLAMA_URL || 'http://localhost:11434'}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.OLLAMA_MODEL || 'gemma4:e2b', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], stream: false }), signal: controller.signal }); const data: any = await r.json(); if (!r.ok || data.error) throw new Error(data.error || `HTTP ${r.status}`); if (!data.message?.content) throw new Error('Ollama returned no analysis response'); return data.message.content; } finally { clearTimeout(timer); } }
  private async callHermes(prompt: string): Promise<string> { const base = process.env.HERMES_URL!, headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.HERMES_API_KEY}` }; const request = async (url: string, init: any = {}) => { const c = new AbortController(); const timer = setTimeout(() => c.abort(), 30000); try { const r = await fetch(url, { ...init, headers: { ...headers, ...(init.headers || {}) }, signal: c.signal }); const data: any = await r.json(); if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`); return data; } finally { clearTimeout(timer); } }; const created: any = await request(`${base.replace(/\/$/, '')}/runs`, { method: 'POST', body: JSON.stringify({ model: process.env.HERMES_MODEL, input: prompt }) }); if (!created.run_id) throw new Error('Hermes returned no run id'); const deadline = Date.now() + 600000; while (Date.now() < deadline) { await new Promise(r => setTimeout(r, 2000)); const data: any = await request(`${base.replace(/\/$/, '')}/runs/${created.run_id}`, { headers: { 'Content-Type': 'application/json' } }); if (['queued', 'started', 'running'].includes(data.status)) continue; if (['failed', 'error'].includes(data.status)) throw new Error(data.error || data.message || data.status); const result = data.result || data.output || data.text || data.response; if (!result) throw new Error('Hermes returned no analysis response'); return result; } throw new Error('Hermes run timed out'); }
}
