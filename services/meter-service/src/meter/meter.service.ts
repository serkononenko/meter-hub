import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { MeterUpdate } from './meter.repository.js';
import type { Meter } from './meter.model.js';
import { METER_REPOSITORY } from './meter.tokens.js';
import type { MeterRepository } from './meter.repository.js';

/**
 * Meter use cases. Callers are authenticated at the API boundary; 5.4 layers
 * household-ownership checks onto these operations.
 */
@Injectable()
export class MeterService {
  constructor(@Inject(METER_REPOSITORY) private readonly meters: MeterRepository) {}

  async create(meter: Meter): Promise<Meter> {
    return this.meters.save(meter);
  }

  async listByHousehold(householdId: string): Promise<Meter[]> {
    return this.meters.findByHouseholdId(householdId);
  }

  async getById(id: string): Promise<Meter> {
    const meter = await this.meters.findById(id);
    if (!meter) {
      throw new NotFoundException('Meter not found');
    }
    return meter;
  }

  async update(id: string, changes: MeterUpdate): Promise<Meter> {
    const updated = await this.meters.update(id, changes);
    if (!updated) {
      throw new NotFoundException('Meter not found');
    }
    return updated;
  }
}
