import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import {CORRELATION_ID_HEADER} from '../constants.js';

import type {Request, Response} from 'express';


const PROBLEM_BASE_URI = 'https://api.meterhub.local/problems/';

interface ProblemBody {
    type: string;
    title: string;
    status: number;
    code: string;
    detail: string;
    instance: string;
    correlationId?: string;
    errors?: { field: string; message: string }[];
}

/**
 * RFC 9457 problem+json for every error leaving the service
 * (api-conventions §5). Bodies never include stack traces or driver errors —
 * the exception is logged server-side only.
 */
@Catch()
export class CommonExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost): void {
        const http = host.switchToHttp();
        const request = http.getRequest<Request>();
        const response = http.getResponse<Response>();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let code = 'INTERNAL_ERROR';
        let title = 'Internal server error';
        let detail = 'An unexpected error occurred.';
        let errors: ProblemBody['errors'] | undefined;

        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const body = exception.getResponse();
            const problem =
                typeof body === 'object' && body !== null
                    ? (body as Record<string, unknown>)
                    : ({detail: body} as Record<string, unknown>);
            if (typeof problem.code === 'string') {
                // Services raise their own typed problems (READING_NOT_FOUND,
                // METER_SERVICE_UNAVAILABLE, ...); the filter only fills gaps.
                code = problem.code;
                title = typeof problem.title === 'string' ? problem.title : title;
                detail = typeof problem.detail === 'string' ? problem.detail : detail;
            } else {
                code = codeFromStatus(status);
                title = typeof problem.title === 'string' ? problem.title : title;
                detail = typeof problem.detail === 'string' ? problem.detail : detail;
            }
            if (Array.isArray(problem.errors)) {
                errors = problem.errors as ProblemBody['errors'];
            }
        }

        if (status >= 500) {
            logUnexpected(exception);
        }

        const problem: ProblemBody = {
            type: `${PROBLEM_BASE_URI}${code.toLowerCase().replaceAll('_', '-')}`,
            title,
            status,
            code,
            detail,
            instance: request.originalUrl,
            correlationId: response.getHeader(CORRELATION_ID_HEADER)?.toString(),
            ...(errors ? {errors} : {}),
        };

        response.status(status);
        response.setHeader('Content-Type', 'application/problem+json');
        response.end(JSON.stringify(problem));
    }
}

function codeFromStatus(status: number): string {
    switch (status) {
        case HttpStatus.BAD_REQUEST:
            return 'VALIDATION_ERROR';
        case HttpStatus.UNAUTHORIZED:
            return 'UNAUTHORIZED';
        case HttpStatus.FORBIDDEN:
            return 'FORBIDDEN';
        case HttpStatus.NOT_FOUND:
            return 'NOT_FOUND';
        case HttpStatus.CONFLICT:
            return 'CONFLICT';
        default:
            return 'INTERNAL_ERROR';
    }
}

function logUnexpected(exception: unknown): void {
    // Console here stands in for the structured logger (conventions §14); the
    // exception itself never reaches the response body.
    console.error('[reading-service] Unhandled exception', exception);
}
