import { Injectable, NotFoundException } from '@nestjs/common';
import { CreatePaydayDto } from './dto/create-payday.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Payday } from './entities/payday.entity';
import { Repository } from 'typeorm';

@Injectable()
export class PaydaysService {

  constructor(
    @InjectRepository(Payday)
    private paydayRepository: Repository<Payday>
  ) {}

  async create(createPaydayDto: CreatePaydayDto) {
    // Check if it already exists
    const existing = await this.paydayRepository.findOneBy({ date: createPaydayDto.date });
    if (existing) return existing;
    
    const createdPayday = this.paydayRepository.create(createPaydayDto);
    return this.paydayRepository.save(createdPayday);
  }

  async findAll() {
    return this.paydayRepository.find();
  }

  async remove(id: string) {
    const payday = await this.paydayRepository.findOneBy({ id });
    if (payday) {
      await this.paydayRepository.remove(payday);
    }
    return { deleted: true };
  }
}
