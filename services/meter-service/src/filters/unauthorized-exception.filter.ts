import {ExceptionFilter, Catch, ArgumentsHost, UnauthorizedException} from '@nestjs/common';
import {Request, Response} from 'express';
import {TokenRejection} from "../exceptions/unauthorized.exception.js";


const PROBLEM_BASE_URI = 'https://api.meterhub.local/problems/';

const REJECTION_PROBLEM = {
    [TokenRejection.MISSING_TOKEN]: {
        code: 'UNAUTHORIZED',
        title: 'Authentication required',
        detail: 'A valid Bearer access token is required.',
    },
    [TokenRejection.INVALID_TOKEN]: {
        code: 'INVALID_TOKEN',
        title: 'Invalid access token',
        detail: 'The access token is invalid or expired.',
    },
};

@Catch(UnauthorizedException)
export class UnauthorizedExceptionFilter implements ExceptionFilter {
    catch(exception: UnauthorizedException, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();
        const status = exception.getStatus();
        const rejection = exception.message as TokenRejection;
        const problem = REJECTION_PROBLEM[rejection] ?? REJECTION_PROBLEM[TokenRejection.INVALID_TOKEN];

        if (rejection === TokenRejection.MISSING_TOKEN) {
            response.setHeader('WWW-Authenticate', 'Bearer');
        }

        response
            .status(status)
            .json({
                type: `${PROBLEM_BASE_URI}${problem.code.toLowerCase().replace('_', '-')}`,
                title: problem.title,
                code: problem.code,
                detail: problem.detail,
                instance: request.url,
                correlationId: response.getHeader('X-Correlation-ID') ?? undefined,
            });
    }
}
