import {MiddlewareConsumer, Module, NestModule} from '@nestjs/common';
import {APP_FILTER} from '@nestjs/core';
import {ScheduleModule} from '@nestjs/schedule';
import {ConfigModule} from "@nestjs/config";
import {createObserveModule} from '@nestjs/observe';
import {AuthModule} from './auth/auth.module.js';
import {DatabaseModule} from './database/database.module.js';
import {CorrelationIdMiddleware} from './middlewares/correlation.middleware.js';
import {HealthModule} from './health/health.module.js';
import {ReadingModule} from './reading/reading.module.js';
import {CommonExceptionFilter} from './filters/common-exception.filter.js';
import {UnauthorizedExceptionFilter} from "./filters/unauthorized-exception.filter.js";
import {RequestValidationExceptionFilter} from "./filters/request-validation-exception.filter.js";
import configuration from './config/configuration.js';
import {LoggingModule} from './logging/logging.module.js';
import {MetricsModule} from './metrics/metrics.module.js';
import {RequestLoggingMiddleware} from './logging/request-logging.middleware.js';


export const {ObserveModule, ObserveInstrument} = createObserveModule();

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration],
        }),
        ScheduleModule.forRoot(),
        LoggingModule,
        MetricsModule,
        DatabaseModule,
        AuthModule,
        HealthModule,
        ReadingModule,
    ],
    providers: [
        {
            provide: APP_FILTER,
            useClass: CommonExceptionFilter
        },
        {
            provide: APP_FILTER,
            useClass: UnauthorizedExceptionFilter,
        },
        {
            provide: APP_FILTER,
            useClass: RequestValidationExceptionFilter,
        },
    ]
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(CorrelationIdMiddleware).forRoutes('*');
        consumer.apply(RequestLoggingMiddleware).forRoutes('*');
    }
}
