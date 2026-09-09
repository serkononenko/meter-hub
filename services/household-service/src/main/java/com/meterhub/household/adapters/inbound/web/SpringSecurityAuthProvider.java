package com.meterhub.household.adapters.inbound.web;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.UUID;

import static java.util.Objects.requireNonNull;

/**
 * Resolves the caller identity from the Spring Security resource-server
 * authentication.
 *
 * <p>Generated API interfaces declare no method parameter for the caller
 * identity, so controllers read it from the authentication established by the
 * JWT resource server before the controller method runs. Centralizing that
 * here keeps controllers free of security plumbing and gives future endpoints
 * a single place to obtain the current user id.
 */
@Component
public class SpringSecurityAuthProvider {
    public UUID currentUserId() {
        Jwt jwt = getJwt();

        return UUID.fromString(requireNonNull(jwt.getSubject()));
    }

    private Jwt getJwt() {
        return Optional.ofNullable(SecurityContextHolder.getContext().getAuthentication())
            .map(Authentication::getPrincipal)
            .map(Jwt.class::cast)
            .orElseThrow(() -> new IllegalStateException("No JWT authentication found"));
    }
}
