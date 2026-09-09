import { Module } from '@nestjs/common';
import { PrismaMeterRepository } from './meter.repository.js';
import { MeterController } from './meter.controller.js';
import { MeterService } from './meter.service.js';
import { METER_REPOSITORY } from './meter.tokens.js';
import { HouseholdAccessModule } from '../household/household-access.module.js';

// PrismaService comes from the global DatabaseModule; household ownership
// checks (5.4) come from the HouseholdAccessModule.
@Module({
  imports: [HouseholdAccessModule],
  controllers: [MeterController],
  providers: [
    MeterService,
    { provide: METER_REPOSITORY, useClass: PrismaMeterRepository },
  ],
  exports: [METER_REPOSITORY],
})
export class MeterModule {}
