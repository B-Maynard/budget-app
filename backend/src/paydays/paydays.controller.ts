import { Controller, Get, Post, Body, Param, Delete, Headers } from '@nestjs/common';
import { PaydaysService } from './paydays.service';
import { CreatePaydayDto } from './dto/create-payday.dto';
import { AuthService } from '../shared/auth.service';

@Controller('paydays')
export class PaydaysController {
  constructor(
    private readonly paydaysService: PaydaysService,
    private authService: AuthService
  ) {}

  @Post()
  create(@Headers() headers: any, @Body() createPaydayDto: CreatePaydayDto) {
    this.authService.determineNotAuth(headers);
    return this.paydaysService.create(createPaydayDto);
  }

  @Get()
  findAll(@Headers() headers: any) {
    this.authService.determineNotAuth(headers);
    return this.paydaysService.findAll();
  }

  @Delete(':id')
  remove(@Headers() headers: any, @Param('id') id: string) {
    this.authService.determineNotAuth(headers);
    return this.paydaysService.remove(id);
  }
}
