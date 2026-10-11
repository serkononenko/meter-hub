import {Global, Module} from '@nestjs/common';
import {EventsModule} from '../events/events.module.js';
import {OutboxRelay} from './outbox.relay.js';
import {OutboxRepository} from './outbox.repository.js';


@Global()
@Module({
    imports: [EventsModule],
    providers: [OutboxRepository, OutboxRelay],
    exports: [OutboxRepository],
})
export class OutboxModule {
}
