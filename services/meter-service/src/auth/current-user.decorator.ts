import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from './jwt-verifier.js';
import { REQUEST_USER } from './auth.constants.js';

/**
 * Injects the verified caller identity (JWT subject) into a handler
 * parameter — the NestJS counterpart of household-service's
 * SpringSecurityAuthProvider, resolved by the auth guard before the handler
 * runs.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request[REQUEST_USER];
  },
);
