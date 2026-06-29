import { Controller, Get, Post, Body, Patch, Param, Delete, Headers } from '@nestjs/common';
import { BillsService } from './bills.service';
import { CreateBillDto } from './dto/create-bill.dto';
import { UpdateBillDto } from './dto/update-bill.dto';
import { AuthService } from 'src/shared/auth.service';

@Controller('bills')
export class BillsController {
  constructor(
    private readonly billsService: BillsService,
    private authService: AuthService
  ) {}

  @Post()
  create(@Headers() headers: any, @Body() createBillDto: CreateBillDto) {
    this.authService.determineNotAuth(headers);
    return this.billsService.create(createBillDto);
  }

  @Get()
  findAll(@Headers() headers: any) {
    this.authService.determineNotAuth(headers);
    return this.billsService.findAll();
  }

  @Get(':id')
  findOne(@Headers() headers: any, @Param('id') id: string) {
    this.authService.determineNotAuth(headers);
    return this.billsService.findOne(id);
  }

  @Patch(':id')
  update(@Headers() headers: any, @Param('id') id: string, @Body() updateBillDto: UpdateBillDto) {
    this.authService.determineNotAuth(headers);
    return this.billsService.update(id, updateBillDto);
  }

  @Delete(':id')
  remove(@Headers() headers: any, @Param('id') id: string) {
    this.authService.determineNotAuth(headers);
    return this.billsService.remove(id);
  }
}
