import {HttpStatus, Injectable} from "@nestjs/common";
import {FetchError, HouseholdsApi, ResponseError} from './generated/index.js';
import {HouseholdServiceUnavailableException} from '../exceptions/service-unavailable.exception.js';
import {HouseholdNotFoundException} from '../exceptions/not-found.exception.js';


@Injectable()
export class HouseholdService {
    constructor(private readonly householdApi: HouseholdsApi) {
    }

    async getHousehold(householdId: string) {
        try {
            return await this.householdApi.getHousehold({householdId});
        } catch (error) {
            if (error instanceof FetchError) {
                throw new HouseholdServiceUnavailableException(error.cause)
            }

            if (isNotFound(error)) {
                throw new HouseholdNotFoundException(householdId);
            }

            throw error;
        }
    }
}

function isNotFound(error: unknown): boolean {
    return error instanceof ResponseError && error.response.status === HttpStatus.NOT_FOUND;
}
