import {Module} from '@nestjs/common';
import {InternalHouseholdApiProvider} from './internal-household-api.provider.js';
import {VerdictCache} from './verdict-cache.js';
import {HouseholdAccessService} from './household-access.service.js';


@Module({
    providers: [InternalHouseholdApiProvider, VerdictCache, HouseholdAccessService],
    exports: [HouseholdAccessService],
})
export class HouseholdModule {
}
