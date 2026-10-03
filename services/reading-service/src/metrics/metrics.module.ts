import {Module, NestModule, MiddlewareConsumer} from '@nestjs/common';
import {MetricsController} from './metrics.controller.js';
import {MetricsMiddleware} from './metrics.middleware.js';
import {MetricsService} from './metrics.service.js';
import {OutboxMetricsListener} from './outbox-metrics.listener.js';

@Module({
    controllers: [MetricsController],
    providers: [MetricsService, OutboxMetricsListener],
    exports: [MetricsService],
})
export class MetricsModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(MetricsMiddleware).forRoutes('*');
    }
}
