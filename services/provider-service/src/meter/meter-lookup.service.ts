import {HttpStatus, Injectable} from "@nestjs/common";
import {FetchError, MetersApi, ResponseError} from '../generated/meter/index.js';
import {MeterServiceUnavailableException} from '../exceptions/service-unavailable.exception.js';
import {MeterNotFoundException} from '../exceptions/not-found.exception.js';

import type {Meter} from '../generated/meter/index.js';


@Injectable()
export class MeterLookupService {
    constructor(private readonly meterApi: MetersApi) {
    }

    async getVisibleMeter(meterId: string): Promise<Meter> {
        try {
            return await this.meterApi.getMeter({meterId});
        } catch (error) {
            if (error instanceof FetchError) {
                throw new MeterServiceUnavailableException(error.cause);
            }

            if (error instanceof ResponseError && error.response.status === HttpStatus.NOT_FOUND) {
                throw new MeterNotFoundException();
            }

            throw error;
        }
    }
}
