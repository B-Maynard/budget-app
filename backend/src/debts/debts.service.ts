import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Debt } from '../banking/entities/debt.entity';
import { Bill } from '../bills/entities/bill.entity';
import { billMonthlyCents, priceForMonthlyCents } from '../bills/bill-cost';
import { CreateDebtDto } from './dto/create-debt.dto';
import { UpdateDebtDto } from './dto/update-debt.dto';

export type DebtResult = Omit<Debt, 'lastAppliedMonth'> & { lastAppliedMonth: string };

@Injectable()
export class DebtsService {
  constructor(
    @InjectRepository(Debt) private readonly debtRepository: Repository<Debt>,
    @InjectRepository(Bill) private readonly billRepository: Repository<Bill>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(): Promise<DebtResult[]> {
    return this.dataSource.transaction(async (manager) => {
      const debts = await manager
        .getRepository(Debt)
        .createQueryBuilder('debt')
        .setLock('pessimistic_write')
        .orderBy('debt.currentBalanceCents', 'DESC')
        .getMany();
      // A linked debt's payment is its bill's monthly cost. A link to a deleted bill is dropped; the debt keeps its last payment.
      const bills = new Map((await manager.getRepository(Bill).find()).map((b) => [b.id, b]));
      for (const debt of debts) {
        if (!debt.billId) continue;
        const bill = bills.get(debt.billId);
        if (bill) debt.paymentAmountCents = billMonthlyCents(bill);
        else debt.billId = null;
      }
      const today = new Date();
      for (const debt of debts) this.applyDuePayments(debt, today);
      await manager.save(debts);
      return debts.map((debt) => this.result(debt));
    });
  }

  async create(dto: CreateDebtDto): Promise<DebtResult> {
    const { billId, paymentAmountCents, ...fields } = dto;
    const bill = billId ? await this.assertBillLinkable(billId, null) : null;
    const today = new Date();
    const currentMonth = this.monthStart(today);
    // starting balance is as of today: this month's payment is already in it if the payment day has passed
    const lastAppliedMonth = today.getDate() >= fields.paymentDay ? currentMonth : this.previousMonth(currentMonth);
    const debt = this.debtRepository.create({
      ...fields,
      billId: bill?.id ?? null,
      paymentAmountCents: bill ? billMonthlyCents(bill) : paymentAmountCents,
      currentBalanceCents: fields.startingBalanceCents,
      lastAppliedMonth,
      createdAt: today,
      updatedAt: today,
    });
    return this.result(await this.debtRepository.save(debt));
  }

  async update(id: number, dto: UpdateDebtDto): Promise<DebtResult> {
    const debt = await this.debtRepository.findOneBy({ id });
    if (!debt) throw new NotFoundException(`Debt with id ${id} not found`);
    const { billId, paymentAmountCents, ...fields } = dto;
    let bill: Bill | null = null;
    let unlinkedBillId: string | null = null;
    if (billId === null) {
      // Unlink: the bill was this debt's payment record. Deleting it keeps the payment counted once, on the debt.
      unlinkedBillId = debt.billId;
      debt.billId = null;
    } else if (billId !== undefined && billId !== debt.billId) {
      if (debt.billId) throw new BadRequestException('Unlink the current bill before linking another');
      bill = await this.assertBillLinkable(billId, id);
      debt.billId = bill.id;
    }
    Object.assign(debt, fields, { updatedAt: new Date() });
    if (debt.billId) {
      bill ??= await this.billRepository.findOneBy({ id: debt.billId });
      if (bill && paymentAmountCents !== undefined && paymentAmountCents !== billMonthlyCents(bill)) {
        // Setting the payment on a linked debt sets its bill's price, so the bill stays the source of truth.
        bill.price = priceForMonthlyCents(bill, paymentAmountCents) / 100;
        bill = await this.billRepository.save(bill);
      }
      if (bill) debt.paymentAmountCents = billMonthlyCents(bill);
    } else if (paymentAmountCents !== undefined) {
      debt.paymentAmountCents = paymentAmountCents;
    }
    const saved = await this.debtRepository.save(debt);
    if (unlinkedBillId) await this.billRepository.delete({ id: unlinkedBillId });
    return this.result(saved);
  }

  async remove(id: number): Promise<void> {
    const debt = await this.debtRepository.findOneBy({ id });
    if (!debt) throw new NotFoundException(`Debt with id ${id} not found`);
    await this.debtRepository.remove(debt);
  }

  applyDuePayments(debt: Debt, today: Date) {
    // a month's payment is due on its payment day, so this month only counts once that day has arrived
    const currentMonth = this.monthStart(today);
    const dueThrough = today.getDate() >= debt.paymentDay ? currentMonth : this.previousMonth(currentMonth);
    while (debt.lastAppliedMonth < dueThrough && debt.currentBalanceCents > 0) {
      debt.lastAppliedMonth = this.nextMonth(debt.lastAppliedMonth);
      const interest = Math.round(debt.currentBalanceCents * debt.aprBps / 120000);
      const balance = debt.currentBalanceCents + interest;
      debt.currentBalanceCents = Math.max(0, balance - Math.min(debt.paymentAmountCents, balance));
    }
    debt.updatedAt = new Date();
  }

  /** One debt per bill: the bill must be tagged 'debt', recur, and not already be linked to a different debt. */
  private async assertBillLinkable(billId: string, debtId: number | null): Promise<Bill> {
    const bill = await this.billRepository.findOneBy({ id: billId });
    if (!bill || bill.tag !== 'debt') throw new BadRequestException('Linked bill must be tagged Debt');
    if (billMonthlyCents(bill) < 1) throw new BadRequestException('Linked bill must recur (not one-time)');
    const taken = await this.debtRepository.findOneBy({ billId });
    if (taken && taken.id !== debtId) throw new ConflictException('That bill is already linked to another debt');
    return bill;
  }

  private result(debt: Debt): DebtResult {
    return { ...debt, lastAppliedMonth: String(debt.lastAppliedMonth).slice(0, 7) };
  }

  private monthStart(date = new Date()): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
  }

  private previousMonth(month: string): string {
    const date = new Date(`${month}T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() - 1);
    return date.toISOString().slice(0, 10);
  }

  private nextMonth(month: string): string {
    const date = new Date(`${month}T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + 1);
    return date.toISOString().slice(0, 10);
  }
}
