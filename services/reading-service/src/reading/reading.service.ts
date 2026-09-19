import {Injectable} from '@nestjs/common';
import {plainToInstance} from 'class-transformer';
import {validate} from 'class-validator';
import {ReadingNotFoundException} from "../exceptions/not-found.exception.js";
import {ReadingDecreasingException} from "../exceptions/reading-argument.exception.js";
import {RequestValidationException} from "../exceptions/request-validation.exception.js";
import {ReadingsApi} from "./generated/api/index.js";
import {ReadingRepository} from './reading.repository.js';
import {MeterAccessService} from '../meter/meter-access.service.js';
import {CreateReadingCommand} from "./commands/create-reading.command.js";
import {clampPage} from "../utils/clamp-page.js";

import type {CreateReadingRequest} from "./generated/models/index.js";


@Injectable()
export class ReadingService extends ReadingsApi {
    constructor(
        private readonly repository: ReadingRepository,
        private readonly meterAccess: MeterAccessService,
    ) {
        super();
    }

    async createReading(payload: CreateReadingRequest) {
        const command = plainToInstance(CreateReadingCommand, payload);

        await this.validate(command);
        await this.meterAccess.assertAccessible(command.meterId);

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

    async getLatestReading(meterId: string) {
        await this.meterAccess.assertAccessible(meterId);

        const reading = await this.repository.findLatestByMeterId(meterId);

        if (!reading) {
            throw new ReadingNotFoundException(meterId);
        }

        return reading;
    }

    async listReadings(meterId: string, limit?: number | string, offset?: number | string) {
        await this.meterAccess.assertAccessible(meterId);

        const page = clampPage(limit, offset);

        return this.repository.findByMeterId(meterId, page.limit, page.offset);
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
