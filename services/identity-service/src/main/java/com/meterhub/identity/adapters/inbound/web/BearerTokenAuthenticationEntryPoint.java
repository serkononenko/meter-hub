package com.meterhub.identity.adapters.inbound.web;

import com.meterhub.identity.adapters.inbound.web.dto.ProblemDto;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.jspecify.annotations.NonNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.server.resource.web.BearerTokenResolver;
import org.springframework.security.oauth2.server.resource.web.DefaultBearerTokenResolver;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.UUID;

/**
 * Writes the RFC 9457 problem+json 401 bodies for the JWT resource server.
 *
 * <p>Spring Security resolves bearer-token failures before any controller or
 * {@code @RestControllerAdvice} runs, so a plain {@code @ExceptionHandler}
 * never sees them. This entry point takes over instead and mirrors the
 * {@link ApiExceptionHandler} body shape: same problem base URI, instance, and
 * correlation id handling, and no stack traces or internal details in the body.
 *
 * <p>A missing token (no Authorization header) maps to UNAUTHORIZED; a token
 * that is present but invalid or expired maps to INVALID_TOKEN. The distinction
 * only describes the token — it never says anything about whether an account
 * exists.
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

        UUID correlationId = (UUID) request.getAttribute(CorrelationIdFilter.REQUEST_ATTRIBUTE);
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
