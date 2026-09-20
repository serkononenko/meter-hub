import {Injectable, LoggerService} from '@nestjs/common';
import {context, trace} from '@opentelemetry/api';
import {CURRENT_CORRELATION_ID} from '../middlewares/correlation.middleware.js';

/**
 * Structured JSON logging per docs/conventions.md §14:
 *
 *   {"level":"INFO","service":"meter-service","requestId":"...","message":"..."}
 *
 * One JSON object per line on stdout. Enriched with the conventions'
 * fields: the service name and the request/correlation ID from the
 * correlation middleware's async-local storage, so every line emitted
 * while handling a request carries the ID the client can trace. Also used
 * as the application logger (app.useLogger), so framework lifecycle lines
 * follow the same shape.
 *
 * Never log passwords, access tokens, refresh tokens, or other secrets —
 * log outcome and codes, not credential values (conventions §14).
 */
const SERVICE = 'meter-service';

const LEVELS = {
    fatal: 'FATAL',
    error: 'ERROR',
    warn: 'WARN',
    log: 'INFO',
    debug: 'DEBUG',
    verbose: 'DEBUG',
} as const;

/** Severity order for LOG_LEVEL filtering (info by default). */
const SEVERITY: Record<string, number> = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    FATAL: 4,
};

type NestLevel = keyof typeof LEVELS;

@Injectable()
export class StructuredLoggerService implements LoggerService {
    private readonly threshold: number;

    constructor(logLevel: string = 'info') {
        this.threshold = SEVERITY[logLevel.toUpperCase()] ?? SEVERITY.INFO;
    }

    /** INFO line with optional structured fields. */
    log(message: string, fields?: Record<string, unknown>): void {
        this.emit('log', message, fields);
    }

    error(message: string, fields?: Record<string, unknown>): void {
        this.emit('error', message, fields);
    }

    warn(message: string, fields?: Record<string, unknown>): void {
        this.emit('warn', message, fields);
    }

    debug(message: string, fields?: Record<string, unknown>): void {
        this.emit('debug', message, fields);
    }

    fatal(message: string, fields?: Record<string, unknown>): void {
        this.emit('fatal', message, fields);
    }

    verbose(message: string, fields?: Record<string, unknown>): void {
        this.emit('debug', message, fields);
    }

    private emit(level: NestLevel, message: string, fields?: Record<string, unknown>): void {
        if (SEVERITY[LEVELS[level]] < this.threshold) {
            return;
        }
        const payload: Record<string, unknown> = {
            timestamp: new Date().toISOString(),
            level: LEVELS[level],
            service: SERVICE,
            requestId: CURRENT_CORRELATION_ID.getStore() ?? null,
            message,
            // OpenTelemetry trace ID when a span is active (spec
            // 2_distributed_tracing_spec.md §FR-6): joins log lines to the
            // Jaeger trace alongside the correlation ID.
            ...(trace.getSpan(context.active())
                ? {traceId: trace.getSpan(context.active())?.spanContext().traceId}
                : {}),
            ...(fields ? {fields} : {}),
        };
        process.stdout.write(`${JSON.stringify(payload)}\n`);
    }
}
