import {Module} from '@nestjs/common';
import {HouseholdApiProvider} from './household-api.provider.js';
import {InternalHouseholdApiProvider} from './internal-household-api.provider.js';
import {HouseholdService} from './household.service.js';
import {HouseholdAccessService} from './household-access.service.js';
import {VerdictCache} from './verdict-cache.js';


@Module({
    providers: [
        HouseholdApiProvider,
        InternalHouseholdApiProvider,
        VerdictCache,
        HouseholdService,
        HouseholdAccessService
    ],
    exports: [HouseholdService, HouseholdAccessService, VerdictCache],
})
export class HouseholdModule {
}
