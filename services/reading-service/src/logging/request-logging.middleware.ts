import {Injectable, NestMiddleware} from '@nestjs/common';
import {StructuredLoggerService} from './structured-logger.service.js';

import type {NextFunction, Request, Response} from 'express';

/**
 * One line per request: method, path, status and duration, with the
 * correlation ID attached by the logger from request-scoped storage.
 * Deliberately minimal — no query strings, headers or bodies, which can
 * carry credentials (conventions §14). Mirrors the gateway's
 * AccessLogFilter so every hop of a request logs the same shape.
 */
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
