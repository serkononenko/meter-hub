import {Injectable} from '@nestjs/common';
import {plainToInstance} from 'class-transformer';
import {validate} from 'class-validator';
import {Prisma} from '../database/generated/prisma/client.js';
import {MeterNotFoundException, HouseholdNotFoundException} from "../exceptions/not-found.exception.js";
import {MeterSerialNumberConflictException} from "../exceptions/conflict.exception.js";
import {RequestValidationException} from "../exceptions/request-validation.exception.js";
import {MetersApi} from "./generated/api/index.js";
import {MeterRepository} from './meter.repository.js';
import {HouseholdService} from '../household/household.service.js';
import {CreateMeterCommand} from "./commands/create-meter.command.js";
import {UpdateMeterCommand} from "./commands/update-meter.command.js";

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
        const command = plainToInstance(CreateMeterCommand, payload);

        await this.validate(command);
        await this.canAccess(command.householdId);

        return this.guardSerialConflict(() => this.repository.save({
            id: crypto.randomUUID(),
            householdId: command.householdId,
            type: command.type,
            name: command.name,
            serialNumber: command.serialNumber,
            unit: command.unit,
            status: 'ACTIVE',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }), command.serialNumber);
    }

    async getMeter(meterId: string) {
        this.requireNotEmpty(meterId);

        const meter = await this.repository.findById(meterId);

        if (!meter) {
            throw new MeterNotFoundException(meterId);
        }

        try {
            await this.canAccess(meter.householdId);
        } catch (error) {
            if (error instanceof HouseholdNotFoundException) {
                throw new MeterNotFoundException(meterId);
            }
            throw error;
        }

        return meter;
    }

    async listMeters(householdId: string) {
        this.requireNotEmpty(householdId);
        await this.canAccess(householdId);

        return this.repository.findByHouseholdId(householdId);
    }

    async updateMeter(meterId: string, payload: UpdateMeterRequest) {
        this.requireNotEmpty(meterId);

        const command = plainToInstance(UpdateMeterCommand, payload);

        await this.validate(command);

        const prevMeter = await this.getMeter(meterId);

        const meter = await this.guardSerialConflict(
            () => this.repository.update(prevMeter.id, command),
            command.serialNumber ?? '',
        );

        if (!meter) {
            throw new MeterNotFoundException(meterId);
        }

        return meter;
    }

    private async guardSerialConflict<T>(operation: () => Promise<T>, serialNumber: string): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw new MeterSerialNumberConflictException(serialNumber);
            }
            throw error;
        }
    }

    private async canAccess(householdId: string) {
        return !!await this.householdService.getHousehold(householdId);
    }

    private async validate(command: Object) {
        const errors = await validate(command);

        if (errors.length > 0) {
            throw new RequestValidationException(errors);
        }
    }

    private requireNotEmpty<T>(obj: T | null | undefined) {
        if (!obj) {
            throw new RequestValidationException([]);
        }

        return obj;
    }
}
