import { BadRequestException } from '@nestjs/common';

type BillCost = { price: number | string; frequency?: string | null; interval?: number | null };

// Mirrors frontend billMonthly(). One-time bills don't recur, so they have no monthly cost.
const PER_MONTH: Record<string, number> = { monthly: 1, weekly: 52 / 12, yearly: 1 / 12 };

const perMonth = (b: BillCost) => PER_MONTH[b.frequency || 'monthly'] ?? 0;

/** A bill's cost per month, in cents. */
export function billMonthlyCents(b: BillCost): number {
  return Math.round((Number(b.price) * perMonth(b) * 100) / (b.interval || 1));
}

/** Smallest bill price, in cents, whose monthly cost is at least `monthlyCents`. */
export function priceForMonthlyCents(b: BillCost, monthlyCents: number): number {
  const f = perMonth(b);
  if (!f) throw new BadRequestException('Linked bill must recur (not one-time)');
  return Math.ceil((monthlyCents * (b.interval || 1)) / f);
}
