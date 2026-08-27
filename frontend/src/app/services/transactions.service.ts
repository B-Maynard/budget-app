import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { apiConfig } from '../configs/apis.config';
import { sessionConfig } from '../configs/session.config';

export interface DashboardQuery { startDate?: string; endDate?: string; month?: string; category?: string; search?: string; }
export interface DashboardResult { kpis: { inflow: number; outflow: number; net: number; count: number }; series: { labels: string[]; values: number[] }; categories: { labels: string[]; values: number[] }; transactions: any[]; imports: any[]; months: string[]; categoryLimits: Record<string, number>; }
export interface ImportResult { id: number; rows: number; imported: number; skipped: number; message: string; }
export interface ImportStatus { id: number; status: string; rows: number; }

@Injectable({ providedIn: 'root' })
export class TransactionsService {
  constructor(private http: HttpClient) {}

  private headers() { return new HttpHeaders({ authToken: localStorage.getItem(sessionConfig.dbAccessToken) || '' }); }
  private url(path: string) { return apiConfig.databaseRootPath + path; }

  getDashboard(query: DashboardQuery): Observable<DashboardResult> {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => { if (value) params = params.set(key, value); });
    return this.http.get<DashboardResult>(this.url('/dashboard'), { headers: this.headers(), params });
  }
  importCsv(file: File, accountLabel?: string): Observable<ImportResult> {
    const data = new FormData(); data.append('file', file); if (accountLabel) data.append('account_label', accountLabel);
    return this.http.post<ImportResult>(this.url('/imports'), data, { headers: this.headers() });
  }
  getImportStatus(id: number) { return this.http.get<ImportStatus>(this.url(`/import-status/${id}`), { headers: this.headers() }); }
  updateTransactionCategory(id: number, category: string): Observable<void> { return this.http.patch<void>(this.url(`/transactions/${id}/category`), { category }, { headers: this.headers() }); }
  getCategoryLimits(): Observable<Record<string, number>> {
    return this.http.get<any[]>(this.url('/category-limits'), { headers: this.headers() }).pipe(map(rows => Object.fromEntries(rows.map(row => [row.category, row.limitCents]))));
  }
  setCategoryLimit(category: string, limitCents: number): Observable<void> { return this.http.post<void>(this.url('/category-limits'), { category, limitCents }, { headers: this.headers() }); }
  deleteCategoryLimit(category: string): Observable<void> { return this.http.delete<void>(this.url(`/category-limits/${encodeURIComponent(category)}`), { headers: this.headers() }); }
}
