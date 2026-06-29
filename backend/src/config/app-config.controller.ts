import { Controller, Get, Patch, Body, Headers } from '@nestjs/common';
import { AppConfigService } from './app-config.service';
import { AuthService } from '../shared/auth.service';

@Controller('config')
export class AppConfigController {
  constructor(
    private readonly configService: AppConfigService,
    private authService: AuthService
  ) {}

  @Get()
  getConfig(@Headers() headers: any) {
    this.authService.determineNotAuth(headers);
    return this.configService.getConfig();
  }

  @Patch()
  updateConfig(@Headers() headers: any, @Body() body: any) {
    this.authService.determineNotAuth(headers);
    return this.configService.updateConfig(body);
  }
}
