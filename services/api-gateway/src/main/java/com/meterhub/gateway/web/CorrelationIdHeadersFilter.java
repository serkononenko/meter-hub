package com.meterhub.gateway.web;

import org.jspecify.annotations.NonNull;
import org.springframework.cloud.gateway.server.mvc.filter.HttpHeadersFilter;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.function.ServerRequest;

import java.util.UUID;

/**
 * Forwards the request's correlation ID to the downstream service as the
 * {@code X-Correlation-ID} header, so the same request is traceable across
 * gateway and services (docs/conventions.md §9). Spring Cloud Gateway MVC
 * picks this bean up automatically for proxied requests.
 */
@Component
public class CorrelationIdHeadersFilter implements HttpHeadersFilter.RequestHttpHeadersFilter {

    @Override
    public @NonNull HttpHeaders apply(@NonNull HttpHeaders headers, @NonNull ServerRequest request) {
        Object attribute = request.servletRequest().getAttribute(CorrelationIdFilter.REQUEST_ATTRIBUTE);
        if (attribute instanceof UUID correlationId) {
            headers.set(CorrelationIdFilter.HEADER, correlationId.toString());
        }
        return headers;
    }
}
