import {Injectable} from "@nestjs/common";
import {HouseholdsApi} from './generated/index.js';
import {HouseholdAccessException} from '../exceptions/household-access.exception.js';


@Injectable()
export class HouseholdService {
    constructor(private readonly householdApi: HouseholdsApi) {
    }

    async getHousehold(householdId: string) {
        try {
            return await this.householdApi.getHousehold({householdId});
        } catch (error) {
            throw new HouseholdAccessException(`Household service did not answer for household ${householdId}`, error);
        }
    }
}