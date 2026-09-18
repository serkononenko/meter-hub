import {BadRequestException, Injectable} from '@nestjs/common';
import {plainToInstance} from 'class-transformer';
import {validate} from 'class-validator';
import {MeterNotFoundException} from "../exceptions/meter-not-found.exception.js";
import {MetersApi} from "./generated/api/index.js";
import {MeterRepository} from './meter.repository.js';
import {HouseholdService} from '../household/household.service.js';
import {CreateMeterParams} from "./models/create-meter-params.js";
import {UpdateMeterParams} from "./models/update-meter-params.js";

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

    async createMeter(payload: CreateMeterRequest) {
        const params = plainToInstance(CreateMeterParams, payload);

        await this.validate(params);
        await this.canAccess(params.householdId);

        return this.repository.save({
            id: crypto.randomUUID(),
            householdId: params.householdId,
            type: params.type,
            name: params.name,
            serialNumber: params.serialNumber,
            unit: params.unit,
            status: 'ACTIVE',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        })
    }

    async getMeter(meterId: string) {
        this.requireNotEmpty(meterId);

        const meter = await this.repository.findById(meterId);

        if (!meter) {
            throw new MeterNotFoundException(meterId);
        }

        await this.canAccess(meter.householdId);

        return meter;
    }

    async listMeters(householdId: string) {
        this.requireNotEmpty(householdId);
        await this.canAccess(householdId);

        return this.repository.findByHouseholdId(householdId);
    }

    async updateMeter(meterId: string, payload: UpdateMeterRequest) {
        this.requireNotEmpty(meterId);

        const params = plainToInstance(UpdateMeterParams, payload);

        await this.validate(params);

        const prevMeter = await this.getMeter(meterId);

        await this.canAccess(prevMeter.householdId);

        const meter = await this.repository.update(prevMeter.id, params);

        if (!meter) {
            throw new MeterNotFoundException(meterId);
        }

        return meter;
    }

    private async canAccess(householdId: string) {
        return !!await this.householdService.getHousehold(householdId);
    }

    private async validate(params: Object) {
        const errors = await validate(params);

        if (errors.length > 0) {
            throw new BadRequestException();
        }
    }

    private requireNotEmpty<T>(obj: T | null | undefined) {
        if (!obj) {
            throw new BadRequestException();
        }

        return obj;
    }
}
