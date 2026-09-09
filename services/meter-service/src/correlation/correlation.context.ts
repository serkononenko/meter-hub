import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Request-scoped correlation id, populated by the auth flow and read when
 * calling downstream services so both hops carry the same X-Correlation-ID
 * (api-conventions §4: propagate the value unchanged).
 */
export const CURRENT_CORRELATION_ID = new AsyncLocalStorage<string>();
