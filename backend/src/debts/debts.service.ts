import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Debt } from '../banking/entities/debt.entity';
import { CreateDebtDto } from './dto/create-debt.dto';
import { UpdateDebtDto } from './dto/update-debt.dto';

export type DebtResult = Omit<Debt, 'lastAppliedMonth'> & { lastAppliedMonth: string };

@Injectable()
export class DebtsService {
  constructor(
    @InjectRepository(Debt) private readonly debtRepository: Repository<Debt>,
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
      const currentMonth = this.monthStart();
      for (const debt of debts) this.applyDuePayments(debt, currentMonth);
      await manager.save(debts);
      return debts.map((debt) => this.result(debt));
    });
  }

  async create(dto: CreateDebtDto): Promise<DebtResult> {
    const today = new Date();
    const currentMonth = this.monthStart(today);
    const lastAppliedMonth = today.getDate() >= dto.paymentDay ? this.previousMonth(currentMonth) : currentMonth;
    const debt = this.debtRepository.create({
      ...dto,
      currentBalanceCents: dto.startingBalanceCents,
      lastAppliedMonth,
      createdAt: today,
      updatedAt: today,
    });
    return this.result(await this.debtRepository.save(debt));
  }

  async update(id: number, dto: UpdateDebtDto): Promise<DebtResult> {
    const debt = await this.debtRepository.findOneBy({ id });
    if (!debt) throw new NotFoundException(`Debt with id ${id} not found`);
    Object.assign(debt, dto, { updatedAt: new Date() });
    return this.result(await this.debtRepository.save(debt));
  }

  async remove(id: number): Promise<void> {
    const debt = await this.debtRepository.findOneBy({ id });
    if (!debt) throw new NotFoundException(`Debt with id ${id} not found`);
    await this.debtRepository.remove(debt);
  }

  private applyDuePayments(debt: Debt, currentMonth: string) {
    while (debt.lastAppliedMonth < currentMonth && debt.currentBalanceCents > 0) {
      debt.lastAppliedMonth = this.nextMonth(debt.lastAppliedMonth);
      const interest = Math.round(debt.currentBalanceCents * debt.aprBps / 120000);
      const balance = debt.currentBalanceCents + interest;
      debt.currentBalanceCents = Math.max(0, balance - Math.min(debt.paymentAmountCents, balance));
    }
    debt.updatedAt = new Date();
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
