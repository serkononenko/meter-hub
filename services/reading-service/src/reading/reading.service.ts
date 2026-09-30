import {Injectable} from '@nestjs/common';
import {plainToInstance} from 'class-transformer';
import {validate} from 'class-validator';
import {HouseholdNotFoundException, MeterNotFoundException, ReadingNotFoundException} from "../exceptions/not-found.exception.js";
import {IdempotencyKeyReuseException, ReadingDecreasingException} from "../exceptions/reading-argument.exception.js";
import {RequestValidationException} from "../exceptions/request-validation.exception.js";
import {ReadingsApi} from "../generated/reading/api/index.js";
import {ReadingRepository} from './reading.repository.js';
import {IdempotencyKeyRepository} from './idempotency-key.repository.js';
import {MeterService} from '../meter/meter.service.js';
import {HouseholdAccessService} from '../household/household-access.service.js';
import {CreateReadingCommand} from "./commands/create-reading.command.js";
import {clampPage} from "../utils/clamp-page.js";
import {getObjectHash} from "../utils/get-object-hash.js";
import {getAuthenticatedUser} from "../utils/get-authenticated-user.js";

import type {CreateReadingRequest, Reading} from "../generated/reading/models/index.js";
import type {AuthenticatedUser} from "../typedef.js";


const IDEMPOTENCY_RETENTION_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class ReadingService extends ReadingsApi {
    constructor(
        private readonly repository: ReadingRepository,
        private readonly idempotencyKeys: IdempotencyKeyRepository,
        private readonly meterService: MeterService,
        private readonly householdAccess: HouseholdAccessService,
    ) {
        super();
    }

    async createReading(payload: CreateReadingRequest, idempotencyKey?: string, _xCorrelationId?: string, request?: Request) {
        const user = getAuthenticatedUser(request);

        return idempotencyKey
            ? this.createReadingIdempotent(payload, idempotencyKey, user.userId, user)
            : this._createReading(payload, user);
    }

    private async createReadingIdempotent(
        payload: CreateReadingRequest,
        idempotencyKey: string,
        userId: string,
        user: AuthenticatedUser,
    ): Promise<Reading> {
        const requestHash = getObjectHash(payload);

        const existing = await this.idempotencyKeys.find(idempotencyKey);

        if (existing) {
            if (existing.userId !== userId || existing.requestHash !== requestHash) {
                throw new IdempotencyKeyReuseException();
            }
            return existing.responseBody as Reading;
        }

        const reading = await this._createReading(payload, user);

        await this.idempotencyKeys.save({
            key: idempotencyKey,
            userId,
            requestHash,
            responseStatus: 201,
            responseBody: reading,
        }, new Date(Date.now() + IDEMPOTENCY_RETENTION_MS));

        return reading;
    }

    private async _createReading(payload: CreateReadingRequest, user: AuthenticatedUser) {
        const command = plainToInstance(CreateReadingCommand, payload);

        await this.validate(command);

        const meter = await this.meterService.getMeter(command.meterId);

        try {
            await this.householdAccess.assertCanWrite(meter.householdId, user.userId);
        } catch (error) {
            if (error instanceof HouseholdNotFoundException) {
                throw new MeterNotFoundException(command.meterId);
            }
            throw error;
        }

        await this.assertNotDecreasing(command.meterId, command.value, new Date(command.recordedAt));

        return this.repository.save({
            id: crypto.randomUUID(),
            meterId: command.meterId,
            value: command.value,
            recordedAt: new Date(command.recordedAt).toISOString(),
            source: 'MANUAL',
            createdAt: new Date().toISOString(),
        });
    }

    async getLatestReading(meterId: string, _correlationId?: string, _request?: Request) {
        await this.meterService.getMeter(meterId);

        const reading = await this.repository.findLatestByMeterId(meterId);

        if (!reading) {
            throw new ReadingNotFoundException(meterId);
        }

        return reading;
    }

    async listReadings(meterId: string, limit?: number | string, offset?: number | string, _correlationId?: string, _request?: Request) {
        await this.meterService.getMeter(meterId);

        const page = clampPage(limit, offset);

        const [items, total] = await Promise.all([
            this.repository.findByMeterId(meterId, page.limit, page.offset),
            this.repository.countByMeterId(meterId),
        ]);

        return {
            items,
            total,
            limit: page.limit,
            offset: page.offset,
        };
    }

    private async validate(command: object) {
        const errors = await validate(command);

        if (errors.length > 0) {
            throw new RequestValidationException(errors);
        }
    }

    private async assertNotDecreasing(meterId: string, value: number, recordedAt: Date): Promise<void> {
        const previous = await this.repository.findPrevious(meterId, recordedAt);

        if (previous && value < previous.value) {
            throw new ReadingDecreasingException(value, previous.value, previous.recordedAt);
        }
    }
}
