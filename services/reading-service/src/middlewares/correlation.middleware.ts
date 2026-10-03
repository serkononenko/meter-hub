import {Injectable, NestMiddleware} from '@nestjs/common';
import {ClsService} from 'nestjs-cls';
import {CORRELATION_ID_HEADER} from "../constants.js";

import type {NextFunction, Request, Response} from 'express';

/**
 * Reads X-Correlation-ID from the request (generating one when absent) and
 * echoes it back on the response (api-conventions §4). Both it and the
 * incoming traceparent land in the CLS request store, so any layer can
 * read them without parameter threading (the auth guard's 401 bodies and
 * the exception filters pick the value up via the logger/response header,
 * mirroring the gateway's filter).
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
    constructor(private readonly cls: ClsService) {}

    use(request: Request, response: Response, next: NextFunction): void {
        const incoming = request.header(CORRELATION_ID_HEADER);
        const traceparent = request.headers['traceparent'];
        const correlationId = isUuid(incoming) ? incoming : crypto.randomUUID();

        response.setHeader(CORRELATION_ID_HEADER, correlationId);

        this.cls.set('correlationId', correlationId);
        this.cls.set('traceparent', typeof traceparent === 'string' ? traceparent : null);

        next();
    }
}

function isUuid(value: string | undefined): value is string {
    return (
        !!value &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim())
    );
}
