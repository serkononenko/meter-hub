import {NodeSDK} from '@opentelemetry/sdk-node';
import {getNodeAutoInstrumentations} from '@opentelemetry/auto-instrumentations-node';
import {OTLPTraceExporter} from '@opentelemetry/exporter-trace-otlp-proto';
import {PrismaInstrumentation} from '@prisma/instrumentation';

// Must be imported first in main.ts: HTTP auto-instrumentation patches the http module on start,
// so requests only get server spans (and propagate traceparent) when the SDK is already up.
// It also covers outbound fetch, giving the generated OpenAPI clients client spans for free.
const sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'provider-service',
    traceExporter: new OTLPTraceExporter(),
    instrumentations: [
        getNodeAutoInstrumentations({
            '@opentelemetry/instrumentation-http': {
                ignoreIncomingRequestHook: (request) => request.url === '/metrics',
            },
        }),
        new PrismaInstrumentation(),
    ],
});

sdk.start();

process.on('SIGTERM', () => {
    sdk.shutdown().catch(() => {});
});
