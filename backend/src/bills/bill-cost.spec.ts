import { billMonthlyCents, priceForMonthlyCents } from './bill-cost';

describe('bill-cost', () => {
  it('turns a bill into a monthly cost in cents', () => {
    expect(billMonthlyCents({ price: '1676.00', frequency: 'monthly', interval: 1 })).toBe(167600);
    expect(billMonthlyCents({ price: 120, frequency: 'yearly', interval: 1 })).toBe(1000);
    expect(billMonthlyCents({ price: 99, frequency: 'one-time', interval: 1 })).toBe(0);
  });
  it('prices a bill so its monthly cost covers the planned payment', () => {
    const bill = { price: 0, frequency: 'weekly', interval: 1 };
    const price = priceForMonthlyCents(bill, 51000) / 100;
    expect(billMonthlyCents({ ...bill, price })).toBeGreaterThanOrEqual(51000);
  });
});
