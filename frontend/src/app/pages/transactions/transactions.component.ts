import { IconComponent } from '../../components/icon.component';
import { BankConnectionsComponent } from '../../components/bank-connections.component';
import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  TransactionsService,
  DashboardResult,
  DashboardQuery,
} from '../../services/transactions.service';
import { MoneyPipe } from '../../pipes/money.pipe';
import {
  finalize,
  firstValueFrom,
  interval,
  startWith,
  switchMap,
  takeWhile,
} from 'rxjs';

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [
    IconComponent,
    BankConnectionsComponent,
    CommonModule,
    FormsModule,
    MoneyPipe,
  ],
  templateUrl: './transactions.component.html',
  styleUrl: './transactions.component.scss',
})
export class TransactionsComponent implements OnInit {
  readonly categories = [
    'Housing',
    'Bills',
    'Groceries',
    'Dining',
    'Transport',
    'Shopping',
    'Health',
    'Income',
    'Transfer',
    'One Time Payment',
    'Entertainment',
    'Fees',
    'Travel',
    'Uncategorized',
  ];
  result: DashboardResult = {
    kpis: { inflow: 0, outflow: 0, net: 0, count: 0 },
    series: { labels: [], values: [] },
    categories: { labels: [], values: [] },
    transactions: [],
    imports: [],
    months: [],
    categoryLimits: {},
  };
  month = '';
  startDate = '';
  endDate = '';
  category = '';
  search = '';
  accountLabel = '';
  file: File | null = null;
  loading = false;
  error = '';
  importMessage = '';
  importStatus = '';
  aiProgress = '';
  aiRunning = false;
  private aiStop = false;
  limitCategory = '';
  limit = 0;
  constructor(private service: TransactionsService) {}
  ngOnInit() {
    this.load();
  }
  load(silent = false) {
    if (!silent) {
      this.loading = true;
      this.error = '';
    }
    this.service
      .getDashboard(this.query(), silent)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (value) => (this.result = value),
        error: () => (this.error = 'Could not load transactions.'),
      });
  }
  accountName(importId: number): string {
    const account = this.result.imports.find((i) => i.id === importId);
    return account
      ? `${account.accountLabel || 'Bank account'}${account.accountNumber ? ' ••' + account.accountNumber : ''}`
      : 'Connected bank';
  }
  spendingWidth(amount: number) {
    return (
      (Math.abs(amount) /
        Math.max(1, ...this.result.categories.values.map(Math.abs))) *
      100
    );
  }
  query(): DashboardQuery {
    return {
      month: this.month || undefined,
      startDate: this.startDate || undefined,
      endDate: this.endDate || undefined,
      category: this.category || undefined,
      search: this.search || undefined,
    };
  }
  picked(event: Event) {
    this.file = (event.target as HTMLInputElement).files?.[0] || null;
  }
  upload() {
    if (!this.file) return;
    this.importMessage = '';
    this.importStatus = 'Uploading…';
    this.service.importCsv(this.file, this.accountLabel).subscribe({
      next: (r) => {
        this.importMessage = `${r.message} (${r.imported} imported, ${r.skipped} skipped)`;
        this.poll(r.id);
      },
      error: () => (this.importStatus = 'Import failed.'),
    });
  }
  poll(id: number) {
    interval(1000)
      .pipe(
        startWith(0),
        switchMap(() => this.service.getImportStatus(id)),
        takeWhile((s) => !['completed', 'failed'].includes(s.status), true),
      )
      .subscribe({
        next: (s) =>
          (this.importStatus =
            s.status === 'completed'
              ? 'Import completed.'
              : s.status === 'failed'
                ? 'Import failed.'
                : `Import ${s.status}…`),
        complete: () => this.load(),
      });
  }
  updateCategory(transaction: any) {
    this.service
      .updateTransactionCategory(transaction.id, transaction.category)
      .subscribe({ error: () => (this.error = 'Could not update category.') });
  }
  /** Walks every entry Jev may change, one at a time, updating the table as it goes. */
  async aiCategorize() {
    if (this.aiRunning) return void (this.aiStop = true);
    this.aiRunning = true;
    this.aiStop = false;
    this.error = '';
    let done = 0;
    let changed = 0;
    let unsure = 0;
    try {
      const ids = await firstValueFrom(this.service.getAiPendingIds());
      for (const id of ids) {
        if (this.aiStop) break;
        this.aiProgress = `Jev is categorizing ${done + 1} of ${ids.length}…`;
        const r = await firstValueFrom(this.service.aiCategorize(id));
        done++;
        if (r.changed) changed++;
        if (r.lowConfidence) unsure++;
        const row = this.result.transactions.find((t) => t.id === id);
        if (row) row.category = r.category;
      }
      this.aiProgress = `${this.aiStop ? 'Stopped' : 'Done'}: ${changed} of ${done} entries re-categorized${unsure ? `, ${unsure} left for you (Jev wasn't confident)` : ''}.`;
    } catch (e: any) {
      this.aiProgress = '';
      this.error = e?.error?.message || 'AI categorization failed.';
    } finally {
      this.aiRunning = false;
      this.load();
    }
  }
  saveLimit() {
    if (!this.limitCategory || this.limit < 1) return;
    this.service
      .setCategoryLimit(this.limitCategory, Math.round(this.limit * 100))
      .subscribe({
        next: () => {
          this.result.categoryLimits[this.limitCategory] = Math.round(
            this.limit * 100,
          );
          this.limitCategory = '';
          this.limit = 0;
        },
        error: () => (this.error = 'Could not save limit.'),
      });
  }
  removeLimit(category: string) {
    this.service.deleteCategoryLimit(category).subscribe({
      next: () => delete this.result.categoryLimits[category],
      error: () => (this.error = 'Could not delete limit.'),
    });
  }
}
