package com.meterhub.identity.domain.exception;

/**
 * Thrown when an access token is present and structurally valid but does not
 * resolve to a usable account (for example, the account was deleted after the
 * token was issued). It maps to the same 401 problem as every other token
 * rejection so callers cannot infer anything about the account.
 */
public class InvalidAccessTokenException extends RuntimeException {

    public InvalidAccessTokenException() {
        super("Access token rejected");
    }
}
