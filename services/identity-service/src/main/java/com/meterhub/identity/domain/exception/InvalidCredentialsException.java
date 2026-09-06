package com.meterhub.identity.domain.exception;

/**
 * Thrown when login fails for any reason — unknown email, wrong password,
 * or an account that is not allowed to log in. Carrying a single reason-free
 * type is deliberate: all failures map to the same 401 response so callers
 * cannot enumerate accounts.
 */
public class InvalidCredentialsException extends RuntimeException {

    public InvalidCredentialsException() {
        super("Login failed");
    }
}
