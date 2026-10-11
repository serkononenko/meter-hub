import {UnauthorizedException} from "@nestjs/common";


export enum TokenRejection {
    /** No Authorization header at all. */
    MISSING_TOKEN = 'MISSING_TOKEN',
    /** A Bearer token that failed signature, claims, or expiry validation. */
    INVALID_TOKEN = 'INVALID_TOKEN',
}

export class MissingTokenException extends UnauthorizedException {
    constructor() {
        super(TokenRejection.MISSING_TOKEN);
    }
}

export class InvalidTokenException extends UnauthorizedException {
    constructor() {
        super(TokenRejection.INVALID_TOKEN);
    }
}