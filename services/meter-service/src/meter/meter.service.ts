import { HttpException, Inject, Injectable, NotFoundException, HttpStatus } from '@nestjs/common';
import type { MeterUpdate } from './meter.repository.js';
import type { Meter } from './meter.model.js';
import { METER_REPOSITORY } from './meter.tokens.js';
import type { MeterRepository } from './meter.repository.js';
import {
  HouseholdAccessException,
  type HouseholdAccessPort,
} from '../household/household-access.port.js';
import { HOUSEHOLD_ACCESS_PORT } from '../household/household-access.tokens.js';

function householdNotFound(): HttpException {
  return new HttpException(
    {
      statusCode: HttpStatus.NOT_FOUND,
      code: 'HOUSEHOLD_NOT_FOUND',
      title: 'Household not found',
      detail: 'No household with this identifier is visible to the authenticated user.',
    },
    HttpStatus.NOT_FOUND,
  );
}

function meterNotFound(): NotFoundException {
  return new NotFoundException('Meter not found');
}

/**
 * Meter use cases with ownership enforcement (5.4): every household the
 * caller names — or a meter resolves to — must be visible to that caller
 * through the household service. Unknown and foreign households (and meters,
 * indirectly) return the same 404, so ids cannot be probed.
 */
@Injectable()
export class MeterService {
  constructor(
    @Inject(METER_REPOSITORY) private readonly meters: MeterRepository,
    @Inject(HOUSEHOLD_ACCESS_PORT) private readonly householdAccess: HouseholdAccessPort,
  ) {}

  async create(meter: Meter, accessToken: string): Promise<Meter> {
    await this.requireHouseholdVisibleToCaller(meter.householdId, accessToken, householdNotFound());
    return this.meters.save(meter);
  }

  async listByHousehold(householdId: string, accessToken: string): Promise<Meter[]> {
    await this.requireHouseholdVisibleToCaller(householdId, accessToken, householdNotFound());
    return this.meters.findByHouseholdId(householdId);
  }

  async getById(id: string, accessToken: string): Promise<Meter> {
    const meter = await this.meters.findById(id);
    if (!meter) {
      throw meterNotFound();
    }
    await this.requireHouseholdVisibleToCaller(meter.householdId, accessToken, meterNotFound());
    return meter;
  }

  async update(id: string, changes: MeterUpdate, accessToken: string): Promise<Meter> {
    const owned = await this.meters.findById(id);
    if (!owned) {
      throw meterNotFound();
    }
    await this.requireHouseholdVisibleToCaller(owned.householdId, accessToken, meterNotFound());
    const updated = await this.meters.update(id, changes);
    if (!updated) {
      throw meterNotFound();
    }
    return updated;
  }

  /**
   * Verifies the caller can see the household; on any other outcome the
   * caller's problem is raised. Household-service failures fail closed as
   * 502, never as a successful access grant.
   */
  private async requireHouseholdVisibleToCaller(
    householdId: string,
    accessToken: string,
    callerProblem: HttpException,
  ): Promise<void> {
    let visible: boolean;
    try {
      visible = await this.householdAccess.canAccess(householdId, accessToken);
    } catch (error) {
      if (error instanceof HouseholdAccessException) {
        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_GATEWAY,
            code: 'HOUSEHOLD_SERVICE_UNAVAILABLE',
            title: 'Household service unavailable',
            detail: 'Ownership could not be verified; try again later.',
          },
          HttpStatus.BAD_GATEWAY,
        );
      }
      throw error;
    }
    if (!visible) {
      throw callerProblem;
    }
  }
}
