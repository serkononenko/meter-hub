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

        const http = context.switchToHttp();
        const request = http.getRequest<AuthenticatedRequest>();
        const token = extractTokenFromHeader(request);

        if (!token) {
            throw new MissingTokenException();
        }

        let subject: string | undefined;

        try {
            const payload = await this.jwtService.verifyAsync<JwtPayload>(token);

            subject = payload.sub
        } catch {
            throw new InvalidTokenException();
        }

        if (!subject) {
            throw new InvalidTokenException();
        }

        request[REQUEST_USER] = {userId: subject};

        return true;
    }
}
