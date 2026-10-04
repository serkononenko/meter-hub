import {Injectable, NestMiddleware} from '@nestjs/common';
import {MetricsService} from './metrics.service.js';

import type {NextFunction, Request, Response} from 'express';

/**
 * Records one http_requests_total / http_request_duration_seconds sample
 * per request, mirroring the request log (RequestLoggingMiddleware): same
 * method/path/status/duration tuple, so log line and metric agree.
 *
 * A middleware, not an interceptor: Nest runs guards before interceptors,
 * so requests rejected with 401 by the auth guard would never be counted.
 * Middleware runs for every exchange, and response 'finish' fires even for
 * error responses produced by exception filters — so error counts include
 * handled 4xx/5xx. The scrape route is skipped to keep the counters free of
 * self-scraping feedback.
 */
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
