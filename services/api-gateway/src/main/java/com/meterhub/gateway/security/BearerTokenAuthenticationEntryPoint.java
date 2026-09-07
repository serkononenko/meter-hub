package com.meterhub.gateway.security;

import org.jspecify.annotations.NonNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.server.resource.web.BearerTokenResolver;
import org.springframework.security.oauth2.server.resource.web.DefaultBearerTokenResolver;
import org.springframework.security.web.AuthenticationEntryPoint;
import tools.jackson.databind.ObjectMapper;

import com.meterhub.gateway.web.CorrelationIdFilter;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Optional;
import java.util.UUID;

/**
 * Writes an RFC 9457 problem+json 401 response when the gateway rejects a
 * request before it reaches a downstream service.
 *
 * <p>Spring Security resolves bearer-token failures before any controller or
 * advice runs, so this entry point (not a controller advice) produces the
 * error body. A missing {@code Authorization} header answers
 * {@code UNAUTHORIZED}; a present but bad, expired, or mis-issued token
 * answers {@code INVALID_TOKEN}. Neither message ever reveals whether an
 * account exists.
 */
@Component
public class BearerTokenAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private static final Logger log = LoggerFactory.getLogger(BearerTokenAuthenticationEntryPoint.class);
    private static final String PROBLEM_BASE_URI = "https://api.meterhub.local/problems/";

    private final BearerTokenResolver bearerTokenResolver = new DefaultBearerTokenResolver();
    private final ObjectMapper objectMapper;

    public BearerTokenAuthenticationEntryPoint(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void commence(
        @NonNull HttpServletRequest request,
        @NonNull HttpServletResponse response,
        @NonNull AuthenticationException authenticationException
    ) throws IOException {

        String token = bearerTokenResolver.resolve(request);
        boolean tokenPresent = token != null && !token.isBlank();

        String code = tokenPresent ? "INVALID_TOKEN" : "UNAUTHORIZED";
        String title = tokenPresent ? "Invalid access token" : "Authentication required";
        String detail = tokenPresent
            ? "The access token is invalid or expired."
            : "A valid Bearer access token is required.";

        log.info("Request rejected with {}", code);

        // Missing header: tell the client how to authenticate
        if (!tokenPresent) {
            response.setHeader("WWW-Authenticate", "Bearer");
        }

        // The CorrelationIdFilter always sets the attribute first, so this
        // only falls back for direct invocations (e.g. unit tests)
        UUID correlationId = Optional
            .ofNullable((UUID) request.getAttribute(CorrelationIdFilter.REQUEST_ATTRIBUTE))
            .orElseGet(UUID::randomUUID);
        ProblemDto problem = new ProblemDto(
            PROBLEM_BASE_URI + code.toLowerCase().replace('_', '-'),
            title,
            HttpStatus.UNAUTHORIZED.value(),
            code,
            detail,
            correlationId
        );
        problem.setInstance(request.getRequestURI());

        response.setStatus(HttpStatus.UNAUTHORIZED.value());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        objectMapper.writeValue(response.getWriter(), problem);
    }
}
