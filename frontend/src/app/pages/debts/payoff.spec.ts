import { billMonthly, paymentDate, paymentsBy, requiredPayment, simulate } from './payoff';

describe('payoff', () => {
  it('0% APR splits evenly', () => {
    expect(requiredPayment(180000, 0, 18)).toEqual({ payment: 10000, interest: 0, months: 18 });
  });
  it('interest-bearing payment clears the debt in exactly n months and no sooner than n-1', () => {
    const r = requiredPayment(500000, 2400, 12)!;
    expect(simulate(500000, 2400, r.payment, 12).left).toBe(0);
    expect(simulate(500000, 2400, r.payment - 1, 12).left).toBeGreaterThan(0);
    expect(r.payment).toBeCloseTo(47280, -2); // $472.80/mo for $5k @ 24% over 12
  });
  it('counts payment dates after today', () => {
    expect(paymentDate(15, 1, '2026-10-14')).toBe('2026-10-15');
    expect(paymentDate(15, 1, '2026-10-15')).toBe('2026-11-15');
    expect(paymentDate(15, 3, '2026-11-20')).toBe('2027-02-15');
    expect(paymentsBy(15, '2027-04-15', '2026-10-14')).toBe(7);
    expect(paymentsBy(15, '2026-10-14', '2026-10-14')).toBe(0);
  });
  it('normalises bills to a monthly cost', () => {
    expect(billMonthly({ price: '120.00', frequency: 'yearly' })).toBe(10);
    expect(billMonthly({ price: 100, frequency: 'monthly', interval: 2 })).toBe(50);
    expect(billMonthly({ price: 12, frequency: 'weekly' })).toBe(52);
    expect(billMonthly({ price: 99, frequency: 'one-time' })).toBe(0);
  });
});
