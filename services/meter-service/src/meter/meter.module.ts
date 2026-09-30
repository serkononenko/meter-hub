import {Module} from '@nestjs/common';
import {MeterRepository} from './meter.repository.js';
import {MeterService} from './meter.service.js';
import {ApiImplementations, ApiModule} from "../generated/meter/index.js";
import {HouseholdService} from "../household/household.service.js";
import {HouseholdApiProvider} from "../household/household-api.provider.js";
import {InternalHouseholdApiProvider} from "../household/internal-household-api.provider.js";
import {HouseholdAccessService} from "../household/household-access.service.js";
import {VerdictCache} from "../household/verdict-cache.js";


const apiImplementations: ApiImplementations = {
    metersApi: MeterService
}

@Module({
    imports: [
        ApiModule.forRoot({
            apiImplementations: apiImplementations,
            providers: [
                MeterRepository,
                HouseholdApiProvider,
                InternalHouseholdApiProvider,
                VerdictCache,
                HouseholdService,
                HouseholdAccessService
            ]
        })
    ],
})
export class MeterModule {
}
