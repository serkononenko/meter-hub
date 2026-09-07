package com.meterhub.gateway.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.jspecify.annotations.NonNull;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Optional;
import java.util.UUID;

/**
 * Assigns every request a correlation ID so it can be traced across the
 * gateway, the downstream services and the logs. A client-supplied
 * {@code X-Correlation-ID} header is honoured (so an end-to-end trace can be
 * built from the outside); otherwise a fresh UUID is generated. The resolved
 * ID is echoed back on the response and put on the MDC for logging.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class CorrelationIdFilter extends OncePerRequestFilter {

    public static final String HEADER = "X-Correlation-ID";
    public static final String REQUEST_ATTRIBUTE = "correlationId";
    private static final String MDC_KEY = "correlationId";

    @Override
    protected void doFilterInternal(
        @NonNull HttpServletRequest request,
        @NonNull HttpServletResponse response,
        @NonNull FilterChain filterChain
    ) throws ServletException, IOException {
        String raw = request.getHeader(HEADER);
        UUID correlationId = parseOrNull(raw).orElse(UUID.randomUUID());

        request.setAttribute(REQUEST_ATTRIBUTE, correlationId);
        response.setHeader(HEADER, correlationId.toString());
        MDC.put(MDC_KEY, correlationId.toString());
        try {
            filterChain.doFilter(request, response);
        } finally {
            MDC.remove(MDC_KEY);
        }
    }

    private static Optional<UUID> parseOrNull(String raw) {
        if (raw == null || raw.isBlank()) {
            return Optional.empty();
        }
        try {
            return Optional.of(UUID.fromString(raw.trim()));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }
}
