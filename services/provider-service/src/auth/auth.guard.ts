import {CanActivate, ExecutionContext, Injectable} from '@nestjs/common';
import {Reflector} from '@nestjs/core';
import {JwtService} from '@nestjs/jwt';
import {IS_PUBLIC, REQUEST_USER} from './auth.constants.js';
import {extractTokenFromHeader} from "../utils/extract-token-from-header.js";
import {InvalidTokenException, MissingTokenException} from "../exceptions/unauthorized.exception.js";

import type {JwtPayload} from "jsonwebtoken";
import type {AuthenticatedRequest} from "./authenticated-request.interface.js";


@Injectable()
export class AuthGuard implements CanActivate {
    constructor(
        private readonly jwtService: JwtService,
        private readonly reflector: Reflector,
    ) {
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) {
            return true;
        }

        const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
        const token = extractTokenFromHeader(request);

        if (!token) {
            throw new MissingTokenException();
        }

        let payload: JwtPayload & { roles?: unknown };

        try {
            payload = await this.jwtService.verifyAsync(token);
        } catch {
            throw new InvalidTokenException();
        }

        if (!payload.sub) {
            throw new InvalidTokenException();
        }

        request[REQUEST_USER] = {userId: payload.sub, roles: rolesFrom(payload.roles)};

        return true;
    }
}

function rolesFrom(claim: unknown): string[] {
    return Array.isArray(claim) ? claim.filter((role): role is string => typeof role === 'string') : [];
}
