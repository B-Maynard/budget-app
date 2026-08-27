import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { apiConfig } from '../configs/apis.config';
import { sessionConfig } from '../configs/session.config';

export interface Debt { id: number; name: string; aprBps: number; startingBalanceCents: number; currentBalanceCents: number; paymentAmountCents: number; paymentDay: number; }
export interface CreateDebtDto { name: string; aprBps: number; startingBalanceCents: number; paymentAmountCents: number; paymentDay: number; }
export interface UpdateDebtDto extends Partial<CreateDebtDto> { currentBalanceCents?: number; }

@Injectable({ providedIn: 'root' })
export class DebtsService {
  constructor(private http: HttpClient) {}
  private options() { return { headers: new HttpHeaders({ authToken: localStorage.getItem(sessionConfig.dbAccessToken) || '' }) }; }
  getDebts() { return this.http.get<Debt[]>(apiConfig.databaseRootPath + '/debts', this.options()); }
  createDebt(dto: CreateDebtDto) { return this.http.post<Debt>(apiConfig.databaseRootPath + '/debts', dto, this.options()); }
  updateDebt(id: number, dto: UpdateDebtDto) { return this.http.patch<Debt>(`${apiConfig.databaseRootPath}/debts/${id}`, dto, this.options()); }
  deleteDebt(id: number) { return this.http.delete<void>(`${apiConfig.databaseRootPath}/debts/${id}`, this.options()); }
}
