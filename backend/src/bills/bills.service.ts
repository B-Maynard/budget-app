import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateBillDto } from './dto/create-bill.dto';
import { UpdateBillDto } from './dto/update-bill.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Bill } from './entities/bill.entity';
import { Repository } from 'typeorm';

@Injectable()
export class BillsService {

  constructor(
    @InjectRepository(Bill)
    private billRepository: Repository<Bill>
  ) {}

  async create(createBillDto: CreateBillDto) {
    const createdBill = this.billRepository.create(createBillDto);
    return this.billRepository.save(createdBill);
  }

  async findAll() {
    return this.billRepository.find();
  }

  async findOne(id: string) {
    const bill = await this.billRepository.findOneBy({ id });
    if (!bill) {
      throw new NotFoundException(`Bill with id ${id} not found`);
    }

    return bill;
  }

  async update(id: string, updateBillDto: UpdateBillDto) {
    const bill = await this.findOne(id);
    const updatedBill = Object.assign(bill, updateBillDto);
    return this.billRepository.save(updatedBill);
  }

  async remove(id: string) {
    const bill = await this.findOne(id);
    const removedBill = { ...bill };
    await this.billRepository.remove(bill);
    return removedBill;
  }
}
