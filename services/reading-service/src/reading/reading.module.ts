import {Module} from '@nestjs/common';
import {IdempotencyModule} from '@nestjs/idempotency';
import {ReadingRepository} from './reading.repository.js';
import {PrismaIdempotencyStore} from './idempotency.store.js';
import {OutboxRepository} from './outbox.repository.js';
import {OutboxRelay} from './outbox.relay.js';
import {ReadingService} from './reading.service.js';
import {ApiImplementations, ApiModule} from "../generated/reading/index.js";
import {ReadingsApiController} from "../generated/reading/controllers/index.js";
import {decorateIdempotent} from './idempotent.decorator.js';
import {IdempotencyCleanupTask} from "../scheduler/idempotency-cleanup.task.js";
import {EventsModule} from "../events/events.module.js";
import {MeterModule} from "../meter/meter.module.js";
import {HouseholdModule} from '../household/household.module.js';
import {getAuthenticatedUser} from "../utils/get-authenticated-user.js";


decorateIdempotent(ReadingsApiController, 'createReading');

const apiImplementations: ApiImplementations = {
    readingsApi: ReadingService
}

@Module({
    imports: [
        IdempotencyModule.forRoot({
            scope: request => getAuthenticatedUser(request).userId,
            ttl: '24h',
        }),
        ApiModule.forRoot({
            apiImplementations: apiImplementations,
            providers: [
                ReadingRepository,
                PrismaIdempotencyStore,
                OutboxRepository,
                ...Reflect.getMetadata('providers', MeterModule),
                ...Reflect.getMetadata('providers', HouseholdModule),
            ]
        }),
        EventsModule,
    ],
    providers: [IdempotencyCleanupTask, OutboxRelay],
})
export class ReadingModule {
}
