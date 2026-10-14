import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { CreateDebtDto, Debt, DebtsService } from '../../services/debts.service';
import { BillsService } from '../../services/bills.service';
import { TransactionsService } from '../../services/transactions.service';
import { sessionConfig } from '../../configs/session.config';
import { MoneyPipe } from '../../pipes/money.pipe';
import { billMonthly, fmt, paymentDate, paymentsBy, requiredPayment, todayIso } from './payoff';

type Plan = { months: number; date: string; apr: number };
type Result = NonNullable<ReturnType<typeof requiredPayment>> & { lastDate: string };

@Component({ selector: 'app-debts', standalone: true, imports: [CommonModule, FormsModule, MoneyPipe], templateUrl: './debts.component.html', styleUrl: './debts.component.scss' })
export class DebtsComponent implements OnInit {
  debts: Debt[] = []; loading = false; error = ''; editing: number | null = null;
  form = { name: '', apr: 0, starting: 0, payment: 0, day: 1 };
  today = todayIso(); allMonths = 18;
  plans: Record<number, Plan> = {}; results: Record<number, Result | null> = {};
  income = 0; incomeNote = 'Loading…'; bills: any[] = [];
  constructor(private service: DebtsService, private billsService: BillsService, private transactions: TransactionsService) {}
  ngOnInit() { this.load(); this.loadBudget(); }
  load() { this.loading = true; this.service.getDebts().subscribe({ next: d => { d.forEach(x => this.plans[x.id] ||= this.newPlan(x, this.allMonths)); this.debts = d; this.recalc(); }, error: () => this.error = 'Could not load debts.', complete: () => this.loading = false }); }
  loadBudget() {
    const now = new Date(), startDate = fmt(new Date(now.getFullYear(), now.getMonth() - 3, 1)), endDate = fmt(new Date(now.getFullYear(), now.getMonth(), 0)); // last 3 full months
    this.transactions.getDashboard({ startDate, endDate }).subscribe({
      next: r => {
        const inc = r.transactions.filter(t => t.category === 'Income' && t.amountCents > 0), months = new Set(inc.map(t => String(t.date).slice(0, 7))).size;
        this.income = months ? Math.round(inc.reduce((s, t) => s + t.amountCents, 0) / months) / 100 : 0;
        this.incomeNote = months ? `Average of your Income transactions over the last ${months} month${months > 1 ? 's' : ''}. Edit if it's off.` : 'No Income transactions found. Enter your monthly income.';
      },
      error: () => this.incomeNote = 'Could not load transactions. Enter your monthly income.',
    });
    this.billsService.getBills(localStorage.getItem(sessionConfig.dbAccessToken) || '').subscribe({ next: (b: any) => this.bills = b, error: () => this.error = 'Could not load bills.' });
  }
  submit() { const dto: CreateDebtDto = { name: this.form.name, aprBps: Math.round(this.form.apr * 100), startingBalanceCents: Math.round(this.form.starting * 100), paymentAmountCents: Math.round(this.form.payment * 100), paymentDay: this.form.day }; const request = this.editing === null ? this.service.createDebt(dto) : this.service.updateDebt(this.editing, dto); request.subscribe({ next: () => { if (this.editing !== null) delete this.plans[this.editing]; this.cancel(); this.load(); }, error: () => this.error = 'Could not save debt.' }); }
  edit(debt: Debt) { this.editing = debt.id; this.form = { name: debt.name, apr: debt.aprBps / 100, starting: debt.startingBalanceCents / 100, payment: debt.paymentAmountCents / 100, day: debt.paymentDay }; }
  cancel() { this.editing = null; this.form = { name: '', apr: 0, starting: 0, payment: 0, day: 1 }; }
  remove(debt: Debt) { if (!confirm(`Delete ${debt.name}?`)) return; this.service.deleteDebt(debt.id).subscribe({ next: () => this.load(), error: () => this.error = 'Could not delete debt.' }); }
  updateBalance(debt: Debt) { this.service.updateDebt(debt.id, { currentBalanceCents: debt.currentBalanceCents }).subscribe({ next: () => this.recalc(), error: () => this.error = 'Could not update balance.' }); }

  // --- payoff planner ---
  newPlan(d: Debt, months: number): Plan { return { months, date: paymentDate(d.paymentDay, months, this.today), apr: d.aprBps / 100 }; }
  setAll(months: number) { this.allMonths = months; this.active.forEach(d => this.plans[d.id] = { ...this.newPlan(d, months), apr: this.plans[d.id].apr }); this.recalc(); }
  setMonths(d: Debt, months: number) { const p = this.plans[d.id]; p.months = months; p.date = months >= 1 ? paymentDate(d.paymentDay, Math.floor(months), this.today) : ''; this.recalc(); }
  setDate(d: Debt, date: string) { const p = this.plans[d.id]; p.date = date; p.months = date ? paymentsBy(d.paymentDay, date, this.today) : 0; this.recalc(); }
  firstDate(d: Debt) { return paymentDate(d.paymentDay, 1, this.today); }
  recalc() {
    this.results = {};
    for (const d of this.active) {
      const p = this.plans[d.id], n = Math.floor(p.months), need = requiredPayment(d.currentBalanceCents, Math.round((p.apr || 0) * 100), n);
      this.results[d.id] = need && { ...need, lastDate: paymentDate(d.paymentDay, n, this.today) };
    }
  }
  applyPlan() {
    if (!confirm('Replace each debt\'s monthly payment with the planned amount?')) return;
    const calls = this.active.filter(d => this.results[d.id]).map(d => this.service.updateDebt(d.id, { paymentAmountCents: this.results[d.id]!.payment }));
    forkJoin(calls).subscribe({ next: () => this.load(), error: () => this.error = 'Could not apply plan.' });
  }

  get active() { return this.debts.filter(d => d.currentBalanceCents > 0); }
  get planned() { return Object.values(this.results).filter((r): r is Result => !!r); }
  get neededCents() { return this.planned.reduce((s, r) => s + r.payment, 0); }
  get interestCents() { return this.planned.reduce((s, r) => s + r.interest, 0); }
  get debtFreeDate() { return this.planned.map(r => r.lastDate).sort().pop() || ''; }
  /** Monthly bills, minus any bill named like a debt (that payment is already part of the plan). */
  get billsCents() { const debtNames = new Set(this.debts.map(d => d.name.trim().toLowerCase())); return Math.round(this.bills.filter(b => !debtNames.has(String(b.name).trim().toLowerCase())).reduce((s, b) => s + billMonthly(b), 0) * 100); }
  get availableCents() { return Math.round((this.income || 0) * 100) - this.billsCents; }
  get totalBalance() { return this.debts.reduce((sum, d) => sum + d.currentBalanceCents, 0); }
  get totalPayment() { return this.debts.reduce((sum, d) => sum + d.paymentAmountCents, 0); }
}
