import {Injectable} from '@nestjs/common';
import {plainToInstance} from 'class-transformer';
import {validate} from 'class-validator';
import {
    HouseholdNotFoundException,
    MeterNotFoundException,
    ReadingNotFoundException
} from "../exceptions/not-found.exception.js";
import {ReadingDecreasingException} from "../exceptions/reading-argument.exception.js";
import {RequestValidationException} from "../exceptions/request-validation.exception.js";
import {ReadingsApi} from "../generated/reading/api/index.js";
import {TransactionManager} from '../database/transaction.manager.js';
import {ReadingRepository} from './reading.repository.js';
import {OutboxRepository} from "./outbox.repository.js";
import {MeterService} from '../meter/meter.service.js';
import {HouseholdAccessService} from '../household/household-access.service.js';
import {CreateReadingCommand} from "./commands/create-reading.command.js";
import {clampPage} from "../utils/clamp-page.js";
import {getAuthenticatedUser} from "../utils/get-authenticated-user.js";

import type {CreateReadingRequest, Reading} from "../generated/reading/models/index.js";
import type {MeterReadingCreated} from '../generated/events/reading-created.v1.schema.js';
import type {AuthenticatedUser} from "../typedef.js";


@Injectable()
export class ReadingService extends ReadingsApi {
    constructor(
        private readonly transactions: TransactionManager,
        private readonly repository: ReadingRepository,
        private readonly outboxRepository: OutboxRepository,
        private readonly meterService: MeterService,
        private readonly householdAccess: HouseholdAccessService
    ) {
        super();
    }

    async createReading(payload: CreateReadingRequest, _idempotencyKey?: string, _xCorrelationId?: string, request?: Request) {
        const user = getAuthenticatedUser(request);

        return this.createReadingRecord(payload, user);
    }

    private async createReadingRecord(payload: CreateReadingRequest, user: AuthenticatedUser) {
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

        const reading: Reading = {
            id: crypto.randomUUID(),
            meterId: command.meterId,
            value: command.value,
            recordedAt: new Date(command.recordedAt).toISOString(),
            source: 'MANUAL',
            createdAt: new Date().toISOString(),
        };
        const event: MeterReadingCreated = {
            eventId: reading.id,
            eventType: 'meter.reading.created',
            eventVersion: 1,
            occurredAt: reading.createdAt,
            producer: 'reading-service',
            data: {
                readingId: reading.id,
                meterId: reading.meterId,
                value: reading.value,
                unit: meter.unit,
                recordedAt: reading.recordedAt,
                source: reading.source,
            },
        };
        return this.transactions.execute(async (tx) => {
            const result = await this.repository.save(reading, tx);
            await this.outboxRepository.save(event, tx);
            return result;
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
