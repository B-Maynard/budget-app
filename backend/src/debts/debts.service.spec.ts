import { Debt } from '../banking/entities/debt.entity';
import { DebtsService } from './debts.service';

const debt = (): Debt => ({ aprBps: 0, currentBalanceCents: 100000, paymentAmountCents: 10000, paymentDay: 15, lastAppliedMonth: '2026-09-01' } as Debt);
const run = (today: Date) => { const d = debt(); new DebtsService(null as any, null as any).applyDuePayments(d, today); return d; };

describe('DebtsService.applyDuePayments', () => {
  it('waits for the payment day', () => {
    expect(run(new Date(2026, 9, 14)).currentBalanceCents).toBe(100000);
  });
  it('applies on the payment day, once', () => {
    const d = run(new Date(2026, 9, 15));
    expect(d.currentBalanceCents).toBe(90000);
    expect(d.lastAppliedMonth).toBe('2026-10-01');
  });
  it('catches up on missed months', () => {
    expect(run(new Date(2026, 11, 20)).currentBalanceCents).toBe(70000); // Oct, Nov, Dec
  });
});
