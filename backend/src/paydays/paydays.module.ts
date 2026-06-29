import { Module } from '@nestjs/common';
import { PaydaysService } from './paydays.service';
import { PaydaysController } from './paydays.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payday } from './entities/payday.entity';
import { AuthService } from '../shared/auth.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payday])
  ],
  controllers: [PaydaysController],
  providers: [PaydaysService, AuthService]
})
export class PaydaysModule { }
