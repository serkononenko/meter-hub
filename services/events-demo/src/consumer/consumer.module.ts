import {Module} from '@nestjs/common';
import {MetricsModule, MetricsService} from '../metrics/metrics.module.js';
import {ConsumerMetrics} from './consumer-metrics.js';
import {ReadingCreatedConsumer} from './reading-created.consumer.js';

@Module({
    imports: [MetricsModule],
    providers: [
        ReadingCreatedConsumer,
        {
            provide: ConsumerMetrics,
            useFactory: (metrics: MetricsService) => new ConsumerMetrics(metrics.registry),
            inject: [MetricsService],
        },
    ],
})
export class ConsumerModule {
}
