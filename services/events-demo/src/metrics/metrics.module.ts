import {Module, NestModule, MiddlewareConsumer} from '@nestjs/common';
import {MetricsController} from './metrics.controller.js';
import {MetricsMiddleware} from './metrics.middleware.js';
import {MetricsService} from './metrics.service.js';

export {MetricsService};

@Module({
    controllers: [MetricsController],
    providers: [MetricsService],
    exports: [MetricsService],
})
export class MetricsModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(MetricsMiddleware).forRoutes('*');
    }
}
