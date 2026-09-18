import {ArgumentsHost, Catch, ExceptionFilter, HttpStatus} from '@nestjs/common';
import {Request, Response} from 'express';
import {RequestValidationException} from "../exceptions/request-validation.exception.js";
import {CORRELATION_ID_HEADER} from "../constants.js";


const PROBLEM_BASE_URI = 'https://api.meterhub.local/problems/';

/**
 * Renders class-validator failures as an RFC 9457 problem+json carrying the
 * per-field `errors[]`; everything else falls through to the common filter.
 */
@Catch(RequestValidationException)
export class RequestValidationExceptionFilter implements ExceptionFilter {
    catch(exception: RequestValidationException, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();
        const status = HttpStatus.BAD_REQUEST;
        const code = 'VALIDATION_ERROR';

        response
            .status(status)
            .header('Content-Type', 'application/problem+json')
            .json({
                type: `${PROBLEM_BASE_URI}${code.toLowerCase().replace('_', '-')}`,
                title: 'Validation failed',
                status,
                code,
                detail: 'One or more request fields are invalid.',
                errors: exception.validationErrors.map((error) => ({
                    field: error.property,
                    message: Object.values(error.constraints ?? {}).join('; '),
                })),
                instance: request.url,
                correlationId: response.getHeader(CORRELATION_ID_HEADER) ?? undefined,
            });
    }
}
