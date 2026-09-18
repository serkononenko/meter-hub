import {HttpException, Inject, Injectable, NotFoundException, HttpStatus} from '@nestjs/common';
import {METER_REPOSITORY} from './meter.tokens.js';
import {HouseholdAccessException} from '../exceptions/household-access.exception.js';
import {HouseholdService} from '../household/household.service.js';

import type {MeterRepository} from './meter.repository.js';
import type {MeterUpdate} from './meter.repository.js';
import type {Meter} from './meter.model.js';


const householdNotFound = () => {
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

const meterNotFound = () => {
    return new NotFoundException('Meter not found');
}

@Injectable()
export class MeterService {
    constructor(
        @Inject(METER_REPOSITORY) private readonly meters: MeterRepository,
        private readonly householdService: HouseholdService,
    ) {
    }

    async create(meter: Meter): Promise<Meter> {
        await this.requireHouseholdVisibleToCaller(meter.householdId, householdNotFound());
        return this.meters.save(meter);
    }

    async listByHousehold(householdId: string): Promise<Meter[]> {
        await this.requireHouseholdVisibleToCaller(householdId, householdNotFound());
        return this.meters.findByHouseholdId(householdId);
    }

    async getById(id: string): Promise<Meter> {
        const meter = await this.meters.findById(id);
        if (!meter) {
            throw meterNotFound();
        }
        await this.requireHouseholdVisibleToCaller(meter.householdId, meterNotFound());
        return meter;
    }

    async update(id: string, changes: MeterUpdate): Promise<Meter> {
        const owned = await this.meters.findById(id);
        if (!owned) {
            throw meterNotFound();
        }
        await this.requireHouseholdVisibleToCaller(owned.householdId, meterNotFound());
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
    private async requireHouseholdVisibleToCaller(householdId: string, callerProblem: HttpException) {
        let visible: boolean;
        try {
            visible = !!await this.householdService.getHousehold(householdId);
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
