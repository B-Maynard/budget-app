import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CreateDebtDto, Debt, DebtsService, UpdateDebtDto } from '../../services/debts.service';
import { MoneyPipe } from '../../pipes/money.pipe';

@Component({ selector: 'app-debts', standalone: true, imports: [CommonModule, FormsModule, MoneyPipe], templateUrl: './debts.component.html', styleUrl: './debts.component.scss' })
export class DebtsComponent implements OnInit {
  debts: Debt[] = []; loading = false; error = ''; editing: number | null = null;
  form = { name: '', apr: 0, starting: 0, payment: 0, day: 1 };
  constructor(private service: DebtsService) {}
  ngOnInit() { this.load(); }
  load() { this.loading = true; this.service.getDebts().subscribe({ next: d => this.debts = d, error: () => this.error = 'Could not load debts.', complete: () => this.loading = false }); }
  submit() { const dto: CreateDebtDto = { name: this.form.name, aprBps: Math.round(this.form.apr * 100), startingBalanceCents: Math.round(this.form.starting * 100), paymentAmountCents: Math.round(this.form.payment * 100), paymentDay: this.form.day }; const request = this.editing === null ? this.service.createDebt(dto) : this.service.updateDebt(this.editing, dto); request.subscribe({ next: () => { this.cancel(); this.load(); }, error: () => this.error = 'Could not save debt.' }); }
  edit(debt: Debt) { this.editing = debt.id; this.form = { name: debt.name, apr: debt.aprBps / 100, starting: debt.startingBalanceCents / 100, payment: debt.paymentAmountCents / 100, day: debt.paymentDay }; }
  cancel() { this.editing = null; this.form = { name: '', apr: 0, starting: 0, payment: 0, day: 1 }; }
  remove(debt: Debt) { if (!confirm(`Delete ${debt.name}?`)) return; this.service.deleteDebt(debt.id).subscribe({ next: () => this.load(), error: () => this.error = 'Could not delete debt.' }); }
  updateBalance(debt: Debt) { const dto: UpdateDebtDto = { currentBalanceCents: debt.currentBalanceCents }; this.service.updateDebt(debt.id, dto).subscribe({ error: () => this.error = 'Could not update balance.' }); }
  get totalBalance() { return this.debts.reduce((sum, d) => sum + d.currentBalanceCents, 0); }
  get totalPayment() { return this.debts.reduce((sum, d) => sum + d.paymentAmountCents, 0); }
}
