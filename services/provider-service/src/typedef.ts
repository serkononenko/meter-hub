export type AuthenticatedUser = {
    userId: string;
    roles: string[];
}

declare module 'nestjs-cls' {
    interface ClsStore {
        correlationId: string;
        traceparent: string | null;
    }
}
