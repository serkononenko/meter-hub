import {Injectable} from '@nestjs/common';
import {plainToInstance} from 'class-transformer';
import {validate} from 'class-validator';
import {RequestValidationException} from "../exceptions/request-validation.exception.js";
import {ReadingsApi} from "./generated/api/index.js";
import {ReadingRepository} from './reading.repository.js';
import {CreateReadingCommand} from "./commands/create-reading.command.js";

import type {CreateReadingRequest} from "./generated/models/index.js";


@Injectable()
export class ReadingService extends ReadingsApi {
    constructor(private readonly repository: ReadingRepository) {
        super();
    }

    async createReading(payload: CreateReadingRequest) {
        const command = plainToInstance(CreateReadingCommand, payload);

        await this.validate(command);

        // Meter existence/ownership (and the authenticated caller) arrive
        // with 6.5 cross-service authorization; until then the meterId is
        // stored as a plain reference.
        return this.repository.save({
            id: crypto.randomUUID(),
            meterId: command.meterId,
            value: command.value,
            recordedAt: new Date(command.recordedAt).toISOString(),
            source: 'MANUAL',
            createdAt: new Date().toISOString(),
        });
    }

    private async validate(command: object) {
        const errors = await validate(command);

        if (errors.length > 0) {
            throw new RequestValidationException(errors);
        }
    }
}
