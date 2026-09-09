import { Module } from '@nestjs/common';
import { PrismaMeterRepository } from './meter.repository.js';

export const METER_REPOSITORY = Symbol('MeterRepository');

// PrismaService comes from the global DatabaseModule.
@Module({
  providers: [{ provide: METER_REPOSITORY, useClass: PrismaMeterRepository }],
  exports: [METER_REPOSITORY],
})
export class MeterModule {}
