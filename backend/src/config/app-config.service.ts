import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AppConfig } from './entities/app-config.entity';
import { Repository } from 'typeorm';

@Injectable()
export class AppConfigService {
  constructor(
    @InjectRepository(AppConfig)
    private configRepository: Repository<AppConfig>
  ) {}

  async getConfig(): Promise<AppConfig> {
    let config = await this.configRepository.findOneBy({ id: 1 });
    if (!config) {
      config = this.configRepository.create({ id: 1, income: 0 });
      await this.configRepository.save(config);
    }
    return config;
  }

  async updateConfig(update: Partial<AppConfig>): Promise<AppConfig> {
    let config = await this.getConfig();
    Object.assign(config, update);
    return this.configRepository.save(config);
  }
}
