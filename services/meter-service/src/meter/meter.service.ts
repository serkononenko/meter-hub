import {Injectable} from '@nestjs/common';
import {MeterNotFoundException} from "../exceptions/meter-not-found.exception.js";
import {MetersApi} from "./generated/api/index.js";
import {MeterRepository} from './meter.repository.js';
import {HouseholdService} from '../household/household.service.js';

import type {CreateMeterRequest} from "./generated/models/index.js";
import type {UpdateMeterRequest} from "./generated/models/index.js";


@Injectable()
export class MeterService extends MetersApi {
    constructor(
        readonly repository: MeterRepository,
        private readonly householdService: HouseholdService,
    ) {
        super();
    }

    async createMeter(createMeterRequest: CreateMeterRequest) {
        const {householdId, type, name, serialNumber, unit} = createMeterRequest;

        await this.canAccess(householdId);

        return this.repository.save({
            id: crypto.randomUUID(),
            householdId,
            type,
            name,
            serialNumber,
            unit,
            status: 'ACTIVE',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        })
    }

    async getMeter(meterId: string) {
        const meter = await this.repository.findById(meterId);

        if (!meter) {
            throw new MeterNotFoundException(meterId);
        }

        await this.canAccess(meter.householdId);

        return meter;
    }

    async listMeters(householdId: string) {
        await this.canAccess(householdId);

        return this.repository.findByHouseholdId(householdId);
    }

    async updateMeter(meterId: string, updateMeterRequest: UpdateMeterRequest) {
        const prevMeter = await this.getMeter(meterId);

        await this.canAccess(prevMeter.householdId);

        const meter = await this.repository.update(prevMeter.id, updateMeterRequest);

        if (!meter) {
            throw new MeterNotFoundException(meterId);
        }

        return meter;
    }

    private async canAccess(householdId: string) {
        return !!await this.householdService.getHousehold(householdId);
    }
}
