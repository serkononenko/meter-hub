import {Module, NestModule, MiddlewareConsumer} from '@nestjs/common';
import {MetricsController} from './metrics.controller.js';
import {MetricsMiddleware} from './metrics.middleware.js';
import {MetricsService} from './metrics.service.js';

@Module({
    controllers: [MetricsController],
    providers: [MetricsService],
    exports: [MetricsService],
})
export class MetricsModule implements NestModule {
    // Middleware (not an APP_INTERCEPTOR): Nest runs guards before
    // interceptors, so auth-rejected requests would never be counted
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(MetricsMiddleware).forRoutes('*');
    }
}
