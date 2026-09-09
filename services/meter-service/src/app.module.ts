import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { createObserveModule } from '@nestjs/observe';
import { AuthModule } from './auth/auth.module.js';
import { DatabaseModule } from './database/database.module.js';
import { CorrelationIdMiddleware } from './correlation/correlation.middleware.js';
import { HealthModule } from './health/health.module.js';
import { MeterModule } from './meter/meter.module.js';
import { ProblemExceptionFilter } from './http/problem-exception.filter.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com
    ObserveModule.forRoot({
      appKey: 'YOUR_APP_KEY',
      appSecret: 'YOUR_APP_SECRET',
      serviceId: 'meter-service',
    }),
    DatabaseModule,
    AuthModule,
    HealthModule,
    MeterModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: ProblemExceptionFilter }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Correlation first, so 401 problem bodies can echo the id.
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
