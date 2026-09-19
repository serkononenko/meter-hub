import {HttpStatus, Injectable} from "@nestjs/common";
import {FetchError, MetersApi, ResponseError} from './generated/index.js';
import {MeterServiceUnavailableException} from '../exceptions/service-unavailable.exception.js';
import {MeterNotFoundException} from '../exceptions/not-found.exception.js';


/**
 * Verifies reading targets through Meter Service's HTTP API (6.5): the meter
 * must exist and be owned by the authenticated user. Reading Service never
 * touches Meter Service's database — the access token is forwarded so Meter
 * Service applies the same ownership masking as its own endpoints.
 */
@Injectable()
export class MeterAccessService {
    constructor(private readonly meterApi: MetersApi) {
    }

    /**
     * Resolves when the meter is visible to the caller; throws 404 for
     * unknown and foreign meters alike, 503 when Meter Service is down
     * (fail closed).
     */
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
