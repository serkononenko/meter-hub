import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {SpanKind, SpanStatusCode, trace, TraceFlags} from '@opentelemetry/api';
import {StructuredLoggerService} from '../logging/structured-logger.service.js';
import type {MeterReadingCreated} from '../generated/events/reading-created.v1.schema.js';
import {ConsumerLoop} from './consumer-loop.js';
import {ConsumerMetrics} from './consumer-metrics.js';
import {PrismaService} from '../database/prisma.service.js';

/**
 * The demo processing of `meter.reading.created` (spec 5 §8): record the
 * event in the dedup table (done by the loop before this runs) and log the
 * reading. Deliberately nothing more — the point is proving the backbone,
 * not inventing fake domain coupling.
 *
 * Tracing per spec §7: the handler opens a span with the event's stored
 * `traceparent` as parent, so Jaeger assembles one waterfall across the
 * HTTP leg, the outbox relay, and this consumer.
 */
@Injectable()
export class ReadingCreatedConsumer extends ConsumerLoop {
    constructor(
        config: ConfigService,
        prisma: PrismaService,
        metrics: ConsumerMetrics,
        structuredLogger: StructuredLoggerService,
        private readonly appLogger: StructuredLoggerService,
    ) {
        super(config, prisma, metrics, structuredLogger);
    }

    protected override async invokeHandler(
        eventId: string,
        eventType: string,
        traceparent: string | null,
        value: unknown,
    ): Promise<void> {
        const reading = value as MeterReadingCreated;

        await trace
            .getTracer('events-demo')
            .startActiveSpan(
                `${eventType} process`,
                {
                    kind: SpanKind.CONSUMER,
                    ...(traceparent ? {links: spanLinkFromTraceparent(traceparent)} : {}),
                },
                async (span) => {
                    span.setAttribute('messaging.event.id', eventId);
                    try {
                        this.appLogger.log('Reading event processed', {
                            eventId,
                            readingId: reading.data.readingId,
                            meterId: reading.data.meterId,
                            value: reading.data.value,
                            unit: reading.data.unit,
                            recordedAt: reading.data.recordedAt,
                            source: reading.data.source,
                            occurredAt: reading.occurredAt,
                        });
                    } catch (error) {
                        span.recordException(error as Error);
                        span.setStatus({code: SpanStatusCode.ERROR});
                        throw error;
                    } finally {
                        span.end();
                    }
                },
            );
    }
}

/**
 * Turns a stored W3C `traceparent` header into a span link. A link, not a
 * parent: the relay may have produced this event long after the original
 * request's trace ended, and linking keeps the consumer span its own root
 * while Jaeger still shows both traces side by side.
 */
function spanLinkFromTraceparent(traceparent: string) {
    // traceparent = 00-<32hex traceId>-<16hex spanId>-<2hex flags>
    const match = /^([\da-f]{2})-([\da-f]{32})-([\da-f]{16})-([\da-f]{2})$/i.exec(traceparent.trim());
    if (!match) {
        return undefined;
    }
    return [{
        context: {
            traceId: match[2],
            spanId: match[3],
            traceFlags: Number.parseInt(match[4], 16) & TraceFlags.SAMPLED,
            isRemote: true,
        },
    }];
}
