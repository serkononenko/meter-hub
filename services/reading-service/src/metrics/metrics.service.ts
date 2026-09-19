import {Injectable, OnModuleDestroy} from '@nestjs/common';
import {
    Registry,
    collectDefaultMetrics,
    Counter,
    Histogram,
} from 'prom-client';

/**
 * Basic application metrics (task 10.4):
 * - `http_requests_total`   — request count, tagged by method/path/status
 * - `http_request_duration_seconds` — request latency
 * - errors are counted via the `status` tag (`5xx`) on the counter above
 * plus the default process/Node.js metrics (event loop, GC, heap).
 *
 * Each service instance owns a private registry (not the global one), so
 * instantiating the service twice — e.g. in tests — never collides.
 * Labels are low-cardinality: the path label strips query strings and is
 * capped at a fixed number of distinct values.
 */
@Injectable()
export class MetricsService implements OnModuleDestroy {
    private static readonly MAX_LABELLED_PATHS = 100;

    private readonly registry = new Registry();

    readonly contentType = this.registry.contentType;

    private readonly httpRequestsTotal = new Counter({
        name: 'http_requests_total',
        help: 'Total number of HTTP requests.',
        labelNames: ['method', 'path', 'status'] as const,
        registers: [this.registry],
    });

    private readonly httpRequestDuration = new Histogram({
        name: 'http_request_duration_seconds',
        help: 'HTTP request latency in seconds.',
        labelNames: ['method', 'path', 'status'] as const,
        buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
        registers: [this.registry],
    });

    private readonly labelledPaths = new Set<string>();

    constructor() {
        collectDefaultMetrics({register: this.registry});
    }

    /** Records one completed HTTP request. Called by MetricsInterceptor. */
    observeRequest(method: string, path: string, status: number, durationMs: number): void {
        const safePath = this.safePath(path);
        this.httpRequestsTotal.inc({method, path: safePath, status: String(status)});
        this.httpRequestDuration
            .observe({method, path: safePath, status: String(status)}, durationMs / 1000);
    }

    async scrape(): Promise<string> {
        return this.registry.metrics();
    }

    async onModuleDestroy(): Promise<void> {
        this.registry.clear();
    }

    /**
     * Caps label cardinality: once too many distinct paths have been seen
     * (mostly UUID-bearing routes), further ones collapse into
     * "parameterised" instead of each producing their own time series.
     */
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
