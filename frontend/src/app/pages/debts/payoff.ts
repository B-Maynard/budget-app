// Payoff math. Mirrors backend DebtsService.applyDuePayments: monthly interest (rounded to the cent) is added, then the payment is taken.
export const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const todayIso = () => fmt(new Date());

/** k-th (1-based) payment date strictly after `today` (YYYY-MM-DD). paymentDay <= 28 so no month overflow. */
export function paymentDate(day: number, k: number, today = todayIso()): string {
  const [y, m, d] = today.split('-').map(Number);
  return fmt(new Date(y, m - 1 + (d >= day ? 1 : 0) + k - 1, day));
}

/** How many payments land after `today` and on/before `target`. */
export function paymentsBy(day: number, target: string, today = todayIso()): number {
  let n = 0;
  while (n < 1200 && paymentDate(day, n + 1, today) <= target) n++;
  return n;
}

export function simulate(balance: number, aprBps: number, payment: number, maxMonths: number) {
  let months = 0, interest = 0;
  while (balance > 0 && months < maxMonths) {
    const i = Math.round(balance * aprBps / 120000);
    balance += i; interest += i;
    balance -= Math.min(payment, balance);
    months++;
  }
  return { months, interest, left: balance };
}

/** Smallest whole-cent monthly payment that clears `balance` in `n` payments. */
export function requiredPayment(balance: number, aprBps: number, n: number) {
  if (balance <= 0 || n < 1) return null;
  const r = aprBps / 120000;
  let payment = Math.ceil(r ? balance * r / (1 - Math.pow(1 + r, -n)) : balance / n);
  let sim = simulate(balance, aprBps, payment, n);
  while (sim.left > 0) sim = simulate(balance, aprBps, ++payment, n); // cent rounding can leave a few cents over
  return { payment, interest: sim.interest, months: sim.months };
}

/** A bill's cost per month. One-time bills don't recur, so they count as 0. */
export function billMonthly(b: { price: any; frequency?: string; interval?: number }): number {
  const price = Number(b.price) || 0;
  const perMonth = ({ monthly: price, weekly: price * 52 / 12, yearly: price / 12 } as Record<string, number>)[b.frequency || 'monthly'];
  return (perMonth || 0) / (b.interval || 1);
}
