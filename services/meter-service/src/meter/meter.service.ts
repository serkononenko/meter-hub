import {Injectable} from '@nestjs/common';
import {plainToInstance} from 'class-transformer';
import {validate} from 'class-validator';
import {Prisma} from '../generated/prisma/client.js';
import {MeterNotFoundException, HouseholdNotFoundException} from "../exceptions/not-found.exception.js";
import {MeterSerialNumberConflictException} from "../exceptions/conflict.exception.js";
import {RequestValidationException} from "../exceptions/request-validation.exception.js";
import {MetersApi} from "../generated/meter/api/index.js";
import {MeterRepository} from './meter.repository.js';
import {HouseholdAccessService, NotFoundMaskedError} from '../household/household-access.service.js';
import {REQUEST_USER} from '../auth/auth.constants.js';
import {CreateMeterCommand} from "./commands/create-meter.command.js";
import {UpdateMeterCommand} from "./commands/update-meter.command.js";

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

        await this.validate(command);

        try {
            await this.canWrite(command.householdId, request);
        } catch (error) {
            if (error instanceof NotFoundMaskedError) {
                throw new HouseholdNotFoundException(command.householdId);
            }
            throw error;
        }

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

    async getMeter(meterId: string, _correlationId?: string, request?: Request) {
        this.requireNotEmpty(meterId);

        const meter = await this.repository.findById(meterId);

        if (!meter) {
            throw new MeterNotFoundException(meterId);
        }

        try {
            await this.canRead(meter.householdId, request);
        } catch (error) {
            if (error instanceof NotFoundMaskedError) {
                throw new MeterNotFoundException(meterId);
            }
            throw error;
        }

        return meter;
    }



    async listMeters(householdId: string, _correlationId?: string, request?: Request) {
        this.requireNotEmpty(householdId);

        try {
            await this.canRead(householdId, request);
        } catch (error) {
            if (error instanceof NotFoundMaskedError) {
                throw new HouseholdNotFoundException(householdId);
            }
            throw error;
        }

        return this.repository.findByHouseholdId(householdId);
    }

    async updateMeter(meterId: string, payload: UpdateMeterRequest, _correlationId?: string, request?: Request) {
        this.requireNotEmpty(meterId);

        const command = plainToInstance(UpdateMeterCommand, payload);

        await this.validate(command);

        const prevMeter = await this.getMeter(meterId, _correlationId, request);

        try {
            await this.canWrite(prevMeter.householdId, request);
        } catch (error) {
            // getMeter already masked the meter itself; a VIEWER here gets
            // FORBIDDEN_ROLE, and only an unexpected membership race would
            // surface NotFoundMaskedError again.
            if (error instanceof NotFoundMaskedError) {
                throw new MeterNotFoundException(meterId);
            }
            throw error;
        }

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

    /**
     * Reads need any membership role (A3); VIEWERs read, non-members keep
     * the enumeration-safe 404 mask from the old existence check.
     */
    private canRead(householdId: string, request?: Request): Promise<void> {
        return this.householdAccess.assertCanRead(householdId, userIdOf(request));
    }

    /**
     * Creating/modifying meters requires MEMBER or OWNER; VIEWER gets
     * 403 FORBIDDEN_ROLE. NotFoundMaskedError propagates so each call site
     * masks with its own vocabulary (HOUSEHOLD_NOT_FOUND vs METER_NOT_FOUND).
     */
    private canWrite(householdId: string, request?: Request): Promise<void> {
        return this.householdAccess.assertCanWrite(householdId, userIdOf(request));
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

/** The auth guard stores the verified subject on the request (A0 pattern). */
function userIdOf(request?: Request): string {
    const authenticated = request as unknown as { [REQUEST_USER]?: {userId: string} } | undefined;

    return authenticated?.[REQUEST_USER]?.userId ?? '';
}
