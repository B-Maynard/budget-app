import { Body, Controller, Delete, Get, Headers, Param, Patch, Post } from '@nestjs/common';
import { AuthService } from '../shared/auth.service';
import { CreateDebtDto } from './dto/create-debt.dto';
import { UpdateDebtDto } from './dto/update-debt.dto';
import { DebtsService } from './debts.service';

@Controller('api/debts')
export class DebtsController {
  constructor(private readonly auth: AuthService, private readonly debts: DebtsService) {}

  @Get()
  findAll(@Headers() headers: any) { this.auth.determineNotAuth(headers); return this.debts.findAll(); }

  @Post()
  create(@Headers() headers: any, @Body() dto: CreateDebtDto) { this.auth.determineNotAuth(headers); return this.debts.create(dto); }

  @Patch(':id')
  update(@Headers() headers: any, @Param('id') id: string, @Body() dto: UpdateDebtDto) { this.auth.determineNotAuth(headers); return this.debts.update(Number(id), dto); }

  @Delete(':id')
  remove(@Headers() headers: any, @Param('id') id: string) { this.auth.determineNotAuth(headers); return this.debts.remove(Number(id)); }
}
