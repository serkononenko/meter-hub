import {Injectable, OnModuleDestroy} from '@nestjs/common';
import {
    Registry,
    collectDefaultMetrics,
    Counter,
    Histogram,
} from 'prom-client';


@Injectable()
export class MetricsService implements OnModuleDestroy {
    private static readonly MAX_LABELLED_PATHS = 100;

    // A private registry per instance, so tests that build the service twice never collide.
    private readonly _registry = new Registry();

    get registry(): Registry {
        return this._registry;
    }

    readonly contentType = this._registry.contentType;

    private readonly httpRequestsTotal = new Counter({
        name: 'http_requests_total',
        help: 'Total number of HTTP requests.',
        labelNames: ['method', 'path', 'status'] as const,
        registers: [this._registry],
    });

    private readonly httpRequestDuration = new Histogram({
        name: 'http_request_duration_seconds',
        help: 'HTTP request latency in seconds.',
        labelNames: ['method', 'path', 'status'] as const,
        buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
        registers: [this._registry],
    });

    private readonly labelledPaths = new Set<string>();

    constructor() {
        collectDefaultMetrics({register: this._registry});
    }

    observeRequest(method: string, path: string, status: number, durationMs: number): void {
        const safePath = this.safePath(path);
        this.httpRequestsTotal.inc({method, path: safePath, status: String(status)});
        this.httpRequestDuration
            .observe({method, path: safePath, status: String(status)}, durationMs / 1000);
    }

    async scrape(): Promise<string> {
        return this._registry.metrics();
    }

    async onModuleDestroy(): Promise<void> {
        this._registry.clear();
    }

    // UUID-bearing routes would otherwise create one time series per resource.
    private safePath(path: string): string {
        const withoutQuery = path.split('?')[0];
        if (this.labelledPaths.size < MetricsService.MAX_LABELLED_PATHS) {
            this.labelledPaths.add(withoutQuery);
            return withoutQuery;
        }
        return this.labelledPaths.has(withoutQuery)
            ? withoutQuery
            : 'parameterised';
    }
}
