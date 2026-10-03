import {Module} from '@nestjs/common';
import {ReadingRepository} from './reading.repository.js';
import {IdempotencyKeyRepository} from "./idempotency-key.repository.js";
import {OutboxRepository} from './outbox.repository.js';
import {OutboxRelay} from './outbox.relay.js';
import {ReadingService} from './reading.service.js';
import {ApiImplementations, ApiModule} from "../generated/reading/index.js";
import {IdempotencyCleanupTask} from "../scheduler/idempotency-cleanup.task.js";
import {EventsModule} from "../events/events.module.js";
import {MetricsModule} from "../metrics/metrics.module.js";
import {MeterModule} from "../meter/meter.module.js";
import {HouseholdModule} from '../household/household.module.js';


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
                OutboxRepository,
                ...Reflect.getMetadata('providers', MeterModule),
                ...Reflect.getMetadata('providers', HouseholdModule),
            ]
        }),
        EventsModule,
        MetricsModule,
    ],
    providers: [IdempotencyCleanupTask, OutboxRelay],
})
export class ReadingModule {
}
