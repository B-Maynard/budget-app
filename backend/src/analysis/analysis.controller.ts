import { BadRequestException, Body, Controller, Get, Headers, Post, Query } from '@nestjs/common';
import { AuthService } from '../shared/auth.service';
import { AnalysisService } from './analysis.service';

@Controller('api/ai')
export class AnalysisController {
  constructor(private readonly auth: AuthService, private readonly analysis: AnalysisService) {}

  @Post('jobs')
  start(@Headers() headers: any, @Body() body: { kind?: string; startDate?: string; endDate?: string; provider?: string }) {
    this.auth.determineNotAuth(headers);
    if (body.kind === 'debt') return this.analysis.startDebtAnalysis();
    if (body.kind !== 'spending' || !body.startDate || !body.endDate) throw new BadRequestException('kind and date range are required');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(body.endDate) || body.startDate > body.endDate) throw new BadRequestException('dates must be valid YYYY-MM-DD values');
    if (body.provider && body.provider !== 'local' && body.provider !== 'cloud') throw new BadRequestException('provider must be local or cloud');
    return this.analysis.startSpendingAnalysis(body.startDate, body.endDate, body.provider || 'local');
  }

  @Get('status')
  status(@Headers() headers: any, @Query('kind') kind: 'spending' | 'debt') {
    this.auth.determineNotAuth(headers);
    if (kind !== 'spending' && kind !== 'debt') throw new BadRequestException('kind must be spending or debt');
    return this.analysis.getStatus(kind);
  }
}
