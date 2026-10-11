import {Injectable, NestMiddleware} from '@nestjs/common';
import {StructuredLoggerService} from './structured-logger.service.js';

import type {NextFunction, Request, Response} from 'express';


@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
    constructor(private readonly logger: StructuredLoggerService) {}

    use(request: Request, response: Response, next: NextFunction): void {
        const start = Date.now();
        response.on('finish', () => {
            const fields = {
                method: request.method,
                path: request.originalUrl.split('?')[0],
                status: response.statusCode,
                durationMs: Date.now() - start,
            };
            if (response.statusCode >= 500) {
                this.logger.error('Request completed', fields);
            } else {
                this.logger.log('Request completed', fields);
            }
        });
        next();
    }
}
