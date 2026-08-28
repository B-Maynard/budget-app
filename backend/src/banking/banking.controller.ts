import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthService } from '../shared/auth.service';
import { ImportsService, UploadedCsv } from './imports.service';
import { CategorizationService } from './categorization.service';
import { BankingService } from './banking.service';
import { DashboardQuery } from './dto/dashboard-query.dto';
import { SetCategoryLimitDto } from './dto/set-category-limit.dto';
import { UpdateTransactionCategoryDto } from './dto/update-transaction-category.dto';

@Controller()
export class BankingController {
  constructor(private readonly auth: AuthService, private readonly imports: ImportsService, private readonly categorization: CategorizationService, private readonly banking: BankingService) {}
  @Post('imports') @UseInterceptors(FileInterceptor('file')) import(@Headers() h: any, @UploadedFile() file: UploadedCsv, @Body('account_label') label?: string) { this.auth.determineNotAuth(h); return this.imports.importCsv(file, label); }
  @Get('import-status/:id') status(@Headers() h: any, @Param('id') id: string) { this.auth.determineNotAuth(h); return this.imports.getImportStatus(Number(id)); }
  @Get('dashboard') dashboard(@Headers() h: any, @Query() q: DashboardQuery) { this.auth.determineNotAuth(h); return this.banking.getDashboard(q); }
  @Get('category-limits') limits(@Headers() h: any) { this.auth.determineNotAuth(h); return this.banking.getCategoryLimits(); }
  @Post('category-limits') setLimit(@Headers() h: any, @Body() dto: SetCategoryLimitDto) { this.auth.determineNotAuth(h); return this.banking.setCategoryLimit(dto); }
  @Delete('category-limits/:category') deleteLimit(@Headers() h: any, @Param('category') category: string) { this.auth.determineNotAuth(h); return this.banking.deleteCategoryLimit(category); }
  @Patch('transactions/:id/category') category(@Headers() h: any, @Param('id') id: string, @Body() dto: UpdateTransactionCategoryDto) { this.auth.determineNotAuth(h); return this.categorization.updateTransactionCategory(Number(id), dto.category); }
}
