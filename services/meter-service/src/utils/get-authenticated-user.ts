import {MissingTokenException} from "../exceptions/unauthorized.exception.js";
import {REQUEST_USER} from "../auth/auth.constants.js";

import type {AuthenticatedUser} from "../typedef.js";


export const getAuthenticatedUser = (request?: Request): AuthenticatedUser => {
    if (request && REQUEST_USER in request) {
        return request[REQUEST_USER] as AuthenticatedUser;
    }

    throw new MissingTokenException();
};