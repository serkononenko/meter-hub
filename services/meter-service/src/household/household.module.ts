import {Module} from '@nestjs/common';
import {HouseholdApiProvider} from './household-api.provider.js';
import {HouseholdService} from './household.service.js';


@Module({
    providers: [
        HouseholdApiProvider,
        HouseholdService
    ],
    exports: [HouseholdService],
})
export class HouseholdModule {
}
