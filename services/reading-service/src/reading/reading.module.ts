import {Module} from '@nestjs/common';
import {ReadingRepository} from './reading.repository.js';
import {IdempotencyKeyRepository} from "./idempotency-key.repository.js";
import {ReadingService} from './reading.service.js';
import {ApiImplementations, ApiModule} from "../generated/reading/index.js";
import {MeterApiProvider} from "../meter/meter-api.provider.js";
import {MeterService} from "../meter/meter.service.js";
import {InternalHouseholdApiProvider} from "../household/internal-household-api.provider.js";
import {HouseholdAccessService} from "../household/household-access.service.js";
import {VerdictCache} from "../household/verdict-cache.js";
import {IdempotencyCleanupTask} from "../scheduler/idempotency-cleanup.task.js";


const apiImplementations: ApiImplementations = {
    readingsApi: ReadingService
}

@Module({
    imports: [
        ApiModule.forRoot({
            apiImplementations: apiImplementations,
            providers: [
                ReadingRepository,
                IdempotencyKeyRepository,
                MeterApiProvider,
                MeterService,
                InternalHouseholdApiProvider,
                VerdictCache,
                HouseholdAccessService,
            ]
        })
    ],
    providers: [IdempotencyCleanupTask],
})
export class ReadingModule {
}
