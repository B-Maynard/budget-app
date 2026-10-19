import { CategorizationService } from './categorization.service';

const systemOne = jest.fn();
jest.mock('@typesafe-ai/sdk', () => ({ choice: (q: string, c: unknown) => ({ q, c }), TypeSafeClient: jest.fn(() => ({ systemOne })) }));

const rows = [
  { id: 1, description: 'Shell  Oil', amountCents: -4000, category: 'Uncategorized', categoryManuallySet: false },
  { id: 2, description: 'Netflix', amountCents: -1500, category: 'Bills', categoryManuallySet: false },
  { id: 3, description: 'Kroger', amountCents: -9000, category: 'Dining', categoryManuallySet: true },
];
const update = jest.fn().mockResolvedValue({ affected: 1 });
const query = {
  leftJoin: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(), addOrderBy: jest.fn().mockReturnThis(),
  getMany: async () => rows.filter(r => !r.categoryManuallySet),
};
const service = new CategorizationService(
  null as any, null as any,
  { createQueryBuilder: () => query, find: async (o?: any) => rows.filter(r => !o?.where || r.categoryManuallySet === o.where.categoryManuallySet), findOne: async (o: any) => rows.find(r => r.id === o.where.id), update } as any,
  { find: async () => [{ pattern: 'netflix', category: 'Entertainment' }] } as any,
);

describe('Jev AI categorization', () => {
  beforeEach(() => { process.env.TYPESAFE_API_KEY = 'k'; update.mockClear(); });

  it('skips manual entries and entries covered by a saved rule', async () => {
    expect(await service.jevPendingIds()).toEqual([1]);
  });

  it('saves Jev\'s pick without touching the manual flag, and never overwrites a manual entry', async () => {
    systemOne.mockResolvedValue({ answers: { category: { choice: 'Transport', confidence: 0.9 } } });
    expect(await service.jevCategorize(1)).toEqual({ category: 'Transport', changed: true });
    expect(update).toHaveBeenCalledWith({ id: 1, categoryManuallySet: false }, { category: 'Transport' });
    expect(await service.jevCategorize(3)).toEqual({ category: 'Dining', changed: false });
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('leaves the entry alone when Jev is not confident', async () => {
    systemOne.mockResolvedValue({ answers: { category: { choice: 'Shopping', confidence: 0.3 } } });
    expect(await service.jevCategorize(1)).toEqual({ category: 'Uncategorized', changed: false, lowConfidence: true });
    expect(update).not.toHaveBeenCalled();
  });

  it('refuses when Jev has no key', async () => {
    delete process.env.TYPESAFE_API_KEY;
    const err = await service.jevCategorize(1).catch((e: Error) => e);
    expect((err as Error).message).toContain('not configured');
  });
});
