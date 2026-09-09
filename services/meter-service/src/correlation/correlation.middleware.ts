import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { CURRENT_CORRELATION_ID } from './correlation.context.js';

export const CORRELATION_ID_HEADER = 'X-Correlation-ID';

/**
 * Reads X-Correlation-ID from the request (generating one when absent) and
 * echoes it back on the response (api-conventions §4). The id is also stored
 * in request-scoped storage so downstream calls (household ownership checks)
 * propagate it, and the auth guard's 401 bodies pick the value up from the
 * response header, mirroring the gateway's filter.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const incoming = request.header(CORRELATION_ID_HEADER);
    const correlationId = isUuid(incoming) ? incoming : crypto.randomUUID();
    response.setHeader(CORRELATION_ID_HEADER, correlationId);
    CURRENT_CORRELATION_ID.run(correlationId, () => next());
  }
}

function isUuid(value: string | undefined): value is string {
  return (
    !!value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim())
  );
}
