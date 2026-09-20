import {NodeSDK} from '@opentelemetry/sdk-node';
import {getNodeAutoInstrumentations} from '@opentelemetry/auto-instrumentations-node';
import {OTLPTraceExporter} from '@opentelemetry/exporter-trace-otlp-proto';
import {PrismaInstrumentation} from '@prisma/instrumentation';

/**
 * Distributed tracing bootstrap (spec 2_distributed_tracing_spec.md §5.2).
 *
 * Must be imported before anything else in main.ts: the HTTP
 * auto-instrumentation patches the http module on start, so requests only
 * get server spans (and propagate traceparent) when the SDK is up first.
 *
 * The HTTP instrumentation also covers outbound fetch (the generated
 * OpenAPI clients), so service-to-service calls get client spans with
 * traceparent injection without touching generated code.
 *
 * Export is batched and fire-and-forget (spec §FR-5): when the collector is
 * down the app runs fine, spans are simply dropped after retries. The
 * endpoint comes from OTEL_EXPORTER_OTLP_TRACES_ENDPOINT (docker-compose
 * points it at the Jaeger all-in-one).
 */
const sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'meter-service',
    traceExporter: new OTLPTraceExporter(),
    instrumentations: [
        getNodeAutoInstrumentations({
            // The scraper endpoint is excluded from metrics (metrics
            // middleware); exclude its spans for the same reason.
            '@opentelemetry/instrumentation-http': {
                ignoreIncomingRequestHook: (request) => request.url === '/metrics',
            },
        }),
        // Preview instrumentation (spec §FR-3 / §8): query spans from
        // Prisma; drop if it proves unstable in practice.
        new PrismaInstrumentation(),
    ],
});

sdk.start();

process.on('SIGTERM', () => {
    sdk.shutdown().catch(() => {
        // Best effort only — shutdown must never block or fail the process.
    });
});
