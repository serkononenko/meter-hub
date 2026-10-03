export type AuthenticatedUser = {
    userId: string;
}

declare module 'nestjs-cls' {
    interface ClsStore {
        /** X-Correlation-ID echoed to the client. */
        correlationId: string;
        /** W3C trace context of the incoming request, null when absent. */
        traceparent: string | null;
    }
}