import { Module } from '@nestjs/common';
import { PrismaMeterRepository } from './meter.repository.js';
import { MeterController } from './meter.controller.js';
import { MeterService } from './meter.service.js';
import { METER_REPOSITORY } from './meter.tokens.js';

// PrismaService comes from the global DatabaseModule.
@Module({
  controllers: [MeterController],
  providers: [
    MeterService,
    { provide: METER_REPOSITORY, useClass: PrismaMeterRepository },
  ],
  exports: [METER_REPOSITORY],
})
export class MeterModule {}
