package com.meterhub.household.adapters.inbound.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Optional;
import java.util.UUID;

/**
 * Reads X-Correlation-ID from the request (generating one when absent),
 * echoes it back on the response, stores it for the duration of the
 * request so error handlers can include it in problem bodies, and puts it
 * on the MDC so every log line carries it (mirrors the gateway's filter,
 * conventions §9).
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class CorrelationIdFilter extends OncePerRequestFilter {

    public static final String HEADER = "X-Correlation-ID";
    static final String REQUEST_ATTRIBUTE = "correlationId";
    private static final String MDC_KEY = "correlationId";

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain filterChain
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
