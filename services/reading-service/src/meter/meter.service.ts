import {HttpStatus, Injectable} from "@nestjs/common";
import {FetchError, MetersApi, ResponseError} from '../generated/meter/index.js';
import {MeterServiceUnavailableException} from '../exceptions/service-unavailable.exception.js';
import {MeterNotFoundException} from '../exceptions/not-found.exception.js';

import type {Meter} from '../generated/meter/index.js';


@Injectable()
export class MeterService {
    constructor(private readonly meterApi: MetersApi) {
    }

    async getMeter(meterId: string): Promise<Meter> {
        try {
            return await this.meterApi.getMeter({meterId});
        } catch (error) {
            if (error instanceof FetchError) {
                throw new MeterServiceUnavailableException(error.cause)
            }

            if (isNotFound(error)) {
                throw new MeterNotFoundException(meterId);
            }

            throw error;
        }
    }
}

function isNotFound(error: unknown): boolean {
    return error instanceof ResponseError && error.response.status === HttpStatus.NOT_FOUND;
}
