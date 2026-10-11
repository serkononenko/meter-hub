import './tracing.js';

import {NestFactory} from '@nestjs/core';
import {ConfigService} from "@nestjs/config";
import helmet from 'helmet';
import {AppModule} from './app.module.js';
import {StructuredLoggerService} from './logging/structured-logger.service.js';


async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        logger: false,
    });

    app.useLogger(app.get(StructuredLoggerService));
    app.use(helmet());

    const configService = app.get(ConfigService);
    const port = configService.get('port');

    await app.listen(port);
}

await bootstrap();
