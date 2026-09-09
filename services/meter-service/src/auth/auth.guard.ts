import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { IS_PUBLIC, REQUEST_USER } from './auth.constants.js';
import type { AuthenticatedUser } from './jwt-verifier.js';
import { JwtVerifier, TokenRejection } from './jwt-verifier.js';

/** Express request carrying the verified caller identity. */
interface AuthenticatedRequest extends Request {
  [REQUEST_USER]?: AuthenticatedUser;
}

/** Problem codes for 401 responses (api-conventions §5). */
const REJECTION_PROBLEM: Record<TokenRejection, { code: string; title: string; detail: string }> = {
  [TokenRejection.MISSING_TOKEN]: {
    code: 'UNAUTHORIZED',
    title: 'Authentication required',
    detail: 'A valid Bearer access token is required.',
  },
  [TokenRejection.MALFORMED_TOKEN]: {
    code: 'INVALID_TOKEN',
    title: 'Invalid access token',
    detail: 'The access token is invalid or expired.',
  },
  [TokenRejection.INVALID_TOKEN]: {
    code: 'INVALID_TOKEN',
    title: 'Invalid access token',
    detail: 'The access token is invalid or expired.',
  },
};

const PROBLEM_BASE_URI = 'https://api.meterhub.local/problems/';

/**
 * Global bearer-token guard: every endpoint requires a valid access token
 * issued by the Identity Service, except endpoints marked @Public (only
 * /health). Rejects with RFC 9457 problem+json before any controller code
 * runs; mirrors the gateway's 401 bodies so clients see one error shape.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly verifier: JwtVerifier,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const http = context.switchToHttp();
    const request = http.getRequest<AuthenticatedRequest>();
    const response = http.getResponse<Response>();
    try {
      const user = await this.verifier.verify(request.header('authorization'));
      request[REQUEST_USER] = user;
      return true;
    } catch (rejection) {
      writeUnauthorizedProblem(response, rejection as TokenRejection, request.path);
      return false;
    }
  }
}

function writeUnauthorizedProblem(
  response: Response,
  rejection: TokenRejection,
  instance: string,
): void {
  const problem = REJECTION_PROBLEM[rejection] ?? REJECTION_PROBLEM[TokenRejection.INVALID_TOKEN];
  response.status(401);
  response.setHeader('Content-Type', 'application/problem+json');
  if (rejection === TokenRejection.MISSING_TOKEN) {
    response.setHeader('WWW-Authenticate', 'Bearer');
  }
  response.end(
    JSON.stringify({
      type: `${PROBLEM_BASE_URI}${problem.code.toLowerCase().replace('_', '-')}`,
      title: problem.title,
      status: 401,
      code: problem.code,
      detail: problem.detail,
      instance,
      correlationId: response.getHeader('X-Correlation-ID') ?? undefined,
    }),
  );
}
