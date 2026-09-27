import {HttpStatus, Injectable} from "@nestjs/common";
import {FetchError, MetersApi, ResponseError} from '../generated/meter/index.js';
import {MeterServiceUnavailableException} from '../exceptions/service-unavailable.exception.js';
import {MeterNotFoundException} from '../exceptions/not-found.exception.js';


@Injectable()
export class MeterAccessService {
    constructor(private readonly meterApi: MetersApi) {
    }

    async assertAccessible(meterId: string): Promise<void> {
        try {
            await this.meterApi.getMeter({meterId});
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
