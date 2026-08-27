import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TransactionsService, DashboardResult, DashboardQuery } from '../../services/transactions.service';
import { MoneyPipe } from '../../pipes/money.pipe';
import { interval, startWith, switchMap, takeWhile } from 'rxjs';

@Component({ selector: 'app-transactions', standalone: true, imports: [CommonModule, FormsModule, MoneyPipe], templateUrl: './transactions.component.html', styleUrl: './transactions.component.scss' })
export class TransactionsComponent implements OnInit {
  readonly categories = ['Housing', 'Bills', 'Groceries', 'Dining', 'Transport', 'Shopping', 'Health', 'Income', 'Transfer', 'One Time Payment', 'Entertainment', 'Fees', 'Travel', 'Uncategorized'];
  result: DashboardResult = { kpis: { inflow: 0, outflow: 0, net: 0, count: 0 }, series: { labels: [], values: [] }, categories: { labels: [], values: [] }, transactions: [], imports: [], months: [], categoryLimits: {} };
  month = ''; startDate = ''; endDate = ''; category = ''; search = ''; accountLabel = ''; file: File | null = null; loading = false; error = ''; importMessage = ''; importStatus = '';
  limitCategory = ''; limit = 0;
  constructor(private service: TransactionsService) {}
  ngOnInit() { this.load(); }
  load() { this.loading = true; this.error = ''; this.service.getDashboard(this.query()).subscribe({ next: value => this.result = value, error: () => this.error = 'Could not load transactions.', complete: () => this.loading = false }); this.service.getCategoryLimits().subscribe({ next: value => this.result.categoryLimits = value }); }
  query(): DashboardQuery { return { month: this.month || undefined, startDate: this.startDate || undefined, endDate: this.endDate || undefined, category: this.category || undefined, search: this.search || undefined }; }
  picked(event: Event) { this.file = (event.target as HTMLInputElement).files?.[0] || null; }
  upload() { if (!this.file) return; this.importMessage = ''; this.importStatus = 'Uploading…'; this.service.importCsv(this.file, this.accountLabel).subscribe({ next: r => { this.importMessage = `${r.message} (${r.imported} imported, ${r.skipped} skipped)`; this.poll(r.id); }, error: () => this.importStatus = 'Import failed.' }); }
  poll(id: number) { interval(1000).pipe(startWith(0), switchMap(() => this.service.getImportStatus(id)), takeWhile(s => !['completed', 'failed'].includes(s.status), true)).subscribe({ next: s => this.importStatus = s.status === 'completed' ? 'Import completed.' : s.status === 'failed' ? 'Import failed.' : `Import ${s.status}…`, complete: () => this.load() }); }
  updateCategory(transaction: any) { this.service.updateTransactionCategory(transaction.id, transaction.category).subscribe({ error: () => this.error = 'Could not update category.' }); }
  saveLimit() { if (!this.limitCategory || this.limit < 1) return; this.service.setCategoryLimit(this.limitCategory, Math.round(this.limit * 100)).subscribe({ next: () => { this.result.categoryLimits[this.limitCategory] = Math.round(this.limit * 100); this.limitCategory = ''; this.limit = 0; }, error: () => this.error = 'Could not save limit.' }); }
  removeLimit(category: string) { this.service.deleteCategoryLimit(category).subscribe({ next: () => delete this.result.categoryLimits[category], error: () => this.error = 'Could not delete limit.' }); }
}
