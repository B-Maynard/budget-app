import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '../shared/auth.service';
import { BankConnectionsService } from './bank-connections.service';
import { ExchangePlaidTokenDto } from './dto/plaid.dto';
import { PlaidService } from './plaid.service';

@Controller('bank-connections')
export class BankConnectionsController {
  constructor(
    private readonly auth: AuthService,
    private readonly banking: BankConnectionsService,
    private readonly plaid: PlaidService,
  ) {}
  @Get() state(@Headers() headers: Record<string, string>) {
    this.auth.determineNotAuth(headers);
    return this.banking.state();
  }
  @Post('link-token') link(@Headers() headers: Record<string, string>) {
    this.auth.determineNotAuth(headers);
    return this.banking.createLinkToken();
  }
  @Post('exchange') exchange(
    @Headers() headers: Record<string, string>,
    @Body() dto: ExchangePlaidTokenDto,
  ) {
    this.auth.determineNotAuth(headers);
    return this.banking.exchange(dto);
  }
  @Post(':id/link-token') reconnect(
    @Headers() headers: Record<string, string>,
    @Param('id', ParseIntPipe) id: number,
  ) {
    this.auth.determineNotAuth(headers);
    return this.banking.createLinkToken(id);
  }
  @Post(':id/sync') sync(
    @Headers() headers: Record<string, string>,
    @Param('id', ParseIntPipe) id: number,
  ) {
    this.auth.determineNotAuth(headers);
    return this.banking.requestSync(id);
  }
  @Post(':id/refresh') refresh(
    @Headers() headers: Record<string, string>,
    @Param('id', ParseIntPipe) id: number,
  ) {
    this.auth.determineNotAuth(headers);
    return this.banking.requestSync(id, true);
  }
  @Delete(':id') disconnect(
    @Headers() headers: Record<string, string>,
    @Param('id', ParseIntPipe) id: number,
  ) {
    this.auth.determineNotAuth(headers);
    return this.banking.disconnect(id);
  }
  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Headers('plaid-verification') signature: string,
    @Req() request: RawBodyRequest<Request>,
  ) {
    await this.plaid.verifyWebhook(signature, request.rawBody);
    return this.banking.webhook(request.body);
  }
}
