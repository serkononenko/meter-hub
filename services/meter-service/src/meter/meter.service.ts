import {Injectable} from '@nestjs/common';
import {plainToInstance} from 'class-transformer';
import {validate} from 'class-validator';
import {Prisma} from '../generated/prisma/client.js';
import {MeterNotFoundException, HouseholdNotFoundException} from "../exceptions/not-found.exception.js";
import {MeterSerialNumberConflictException} from "../exceptions/conflict.exception.js";
import {RequestValidationException} from "../exceptions/bad-request.exception.js";
import {MetersApi} from "../generated/meter/api/index.js";
import {MeterRepository} from './meter.repository.js';
import {HouseholdAccessService} from '../household/household-access.service.js';
import {CreateMeterCommand} from "./commands/create-meter.command.js";
import {UpdateMeterCommand} from "./commands/update-meter.command.js";
import {getAuthenticatedUser} from "../utils/get-authenticated-user.js";

import type {CreateMeterRequest} from "../generated/meter/models/index.js";
import type {UpdateMeterRequest} from "../generated/meter/models/index.js";


@Injectable()
export class MeterService extends MetersApi {
    constructor(
        readonly repository: MeterRepository,
        private readonly householdAccess: HouseholdAccessService,
    ) {
        super();
    }

    async createMeter(payload: CreateMeterRequest, _correlationId?: string, request?: Request) {
        const command = plainToInstance(CreateMeterCommand, payload);
        const actorId = getAuthenticatedUser(request).userId;

        await this.validate(command);
        await this.canWrite(command.householdId, actorId);

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
        }, actorId), command.serialNumber);
    }

    async getMeter(meterId: string, _correlationId?: string, request?: Request) {
        this.requireNotEmpty(meterId);

        const meter = await this.repository.findById(meterId);

        if (!meter) {
            throw new MeterNotFoundException(meterId);
        }

        try {
            await this.canRead(meter.householdId, getAuthenticatedUser(request).userId);
        } catch (error) {
            if (error instanceof HouseholdNotFoundException) {
                throw new MeterNotFoundException(meterId);
            }
            throw error;
        }

        return meter;
    }



    async listMeters(householdId: string, _correlationId?: string, request?: Request) {
        this.requireNotEmpty(householdId);

        await this.canRead(householdId, getAuthenticatedUser(request).userId);

        return this.repository.findByHouseholdId(householdId);
    }

    async updateMeter(meterId: string, payload: UpdateMeterRequest, _correlationId?: string, request?: Request) {
        this.requireNotEmpty(meterId);

        const command = plainToInstance(UpdateMeterCommand, payload);
        const actorId = getAuthenticatedUser(request).userId;

        await this.validate(command);

        const prevMeter = await this.getMeter(meterId, _correlationId, request);

        try {
            await this.canWrite(prevMeter.householdId, actorId);
        } catch (error) {
            if (error instanceof HouseholdNotFoundException) {
                throw new MeterNotFoundException(meterId);
            }
            throw error;
        }

        const meter = await this.guardSerialConflict(
            () => this.repository.update(prevMeter.id, {...command, updatedBy: getAuthenticatedUser(request).userId}),
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

    private canRead(householdId: string, actorId: string): Promise<void> {
        return this.householdAccess.assertCanRead(householdId, actorId);
    }

    private canWrite(householdId: string, actorId: string): Promise<void> {
        return this.householdAccess.assertCanWrite(householdId, actorId);
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
