import './tracing.js';

import {NestFactory} from '@nestjs/core';
import {ConfigService} from "@nestjs/config";
import helmet from 'helmet';
import {AppModule, ObserveInstrument} from './app.module.js';
import {StructuredLoggerService} from './logging/structured-logger.service.js';


async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        instrument: ObserveInstrument,
        // Framework lifecycle lines are silenced until the structured
        // logger (configured by LoggingModule) takes over below
        logger: false,
    });

    app.useLogger(app.get(StructuredLoggerService));
    app.use(helmet());

    const configService = app.get(ConfigService);
    const port = configService.get('port');

    await app.listen(port);
}

await bootstrap();
