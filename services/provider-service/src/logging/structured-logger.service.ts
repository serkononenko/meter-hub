import {Injectable, LoggerService} from '@nestjs/common';
import {ClsService} from 'nestjs-cls';
import {context, trace} from '@opentelemetry/api';

const SERVICE = 'provider-service';

const LEVELS = {
    fatal: 'FATAL',
    error: 'ERROR',
    warn: 'WARN',
    log: 'INFO',
    debug: 'DEBUG',
    verbose: 'DEBUG',
} as const;

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

    constructor(
        private readonly cls: ClsService,
        logLevel: string = 'info',
    ) {
        this.threshold = SEVERITY[logLevel.toUpperCase()] ?? SEVERITY.INFO;
    }

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
            requestId: this.cls.get('correlationId') ?? null,
            message,
            // joins log lines to the Jaeger trace alongside the correlation ID
            ...(trace.getSpan(context.active())
                ? {traceId: trace.getSpan(context.active())?.spanContext().traceId}
                : {}),
            ...(fields ? {fields} : {}),
        };
        process.stdout.write(`${JSON.stringify(payload)}\n`);
    }
}
