import {Injectable, NestMiddleware} from '@nestjs/common';
import {MetricsService} from './metrics.service.js';

import type {NextFunction, Request, Response} from 'express';


// Middleware rather than an interceptor: guards run before interceptors, so requests rejected
// with 401 would never be counted. 'finish' also fires for responses built by exception filters.
@Injectable()
export class MetricsMiddleware implements NestMiddleware {
    constructor(private readonly metrics: MetricsService) {}

    use(request: Request, response: Response, next: NextFunction): void {
        if (request.originalUrl === '/metrics' || request.path === '/metrics') {
            next();
            return;
        }
        const start = Date.now();
        response.on('finish', () => {
            this.metrics.observeRequest(
                request.method,
                request.originalUrl ?? request.url,
                response.statusCode,
                Date.now() - start,
            );
        });
        next();
    }
}
