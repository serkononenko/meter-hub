package com.meterhub.identity.domain.exception;

/**
 * Thrown when a refresh token cannot be used — unknown, expired, or revoked.
 * Carrying a single reason-free type is deliberate: all failures map to the
 * same 401 response so callers cannot infer token state.
 */
public class InvalidRefreshTokenException extends RuntimeException {

    public InvalidRefreshTokenException() {
        super("Refresh failed");
    }
}
