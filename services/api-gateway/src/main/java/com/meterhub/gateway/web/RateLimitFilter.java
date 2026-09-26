package com.meterhub.gateway.web;

import com.meterhub.gateway.config.RateLimitProperties;
import com.meterhub.gateway.security.ProblemDto;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.ConsumptionProbe;
import io.github.bucket4j.local.LocalBucketBuilder;
import org.jspecify.annotations.NonNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.security.autoconfigure.web.servlet.SecurityFilterProperties;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.ObjectMapper;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

/**
 * Per-client token-bucket rate limiting at the gateway edge
 * (docs/service-boundaries.md §1 rate limiting).
 *
 * <p>Authenticated requests key on the access token's {@code sub} claim;
 * public requests key on the client IP. The public auth endpoints (login,
 * register, refresh, logout — credential-stuffing targets) get a separate,
 * tighter bucket keyed by IP even when a token is present.
 *
 * <p>Buckets live in-process: correct for the single-instance MVP gateway,
 * replaced by a shared store only when the gateway scales out.
 *
 * <p>Runs after the Spring Security filter chain so the JWT is already
 * validated and available from the security context; a rejected request
 * answers RFC 9457 problem+json with {@code Retry-After}
 * (docs/api-conventions.md §5), and the correlation ID filter has already
 * run, so the body carries the request's correlation ID.
 */
// Ten positions after the Spring Security filter chain (-100): the JWT is
// validated and the security context populated by the time this filter runs
@Component
@Order(SecurityFilterProperties.DEFAULT_FILTER_ORDER + 10)
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RateLimitFilter.class);
    private static final String PROBLEM_BASE_URI = "https://api.meterhub.local/problems/";
    /** Prefix of the gateway route paths that front the identity auth endpoints. */
    private static final Pattern AUTH_PATH = Pattern.compile("^/api/identity-service/api/v1/auth/.*");
    /** First entry of X-Forwarded-For, or a fallback for direct clients. */
    private static final Pattern FORWARDED_ENTRY = Pattern.compile("[^,\\s]+");

    private final RateLimitProperties properties;
    private final ObjectMapper objectMapper;
    private final Map<String, Bucket> generalBuckets = new ConcurrentHashMap<>();
    private final Map<String, Bucket> authBuckets = new ConcurrentHashMap<>();

    public RateLimitFilter(RateLimitProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        // Only API traffic is limited; actuator stays open for probes and
        // Prometheus scrapes, which must never be starved by clients.
        return !properties.enabled() || !request.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(
        @NonNull HttpServletRequest request,
        @NonNull HttpServletResponse response,
        @NonNull FilterChain filterChain
    ) throws ServletException, IOException {

        boolean authEndpoint = AUTH_PATH.matcher(request.getRequestURI()).matches();
        String key = authEndpoint ? "ip:" + clientIp(request) : keyFor(request);

        Bucket bucket = (authEndpoint ? authBuckets : generalBuckets)
            .computeIfAbsent(key, _ -> newBucket(authEndpoint));

        ConsumptionProbe probe = bucket.tryConsumeAndReturnRemaining(1);
        if (!probe.isConsumed()) {
            reject(request, response, probe.getNanosToWaitForRefill());
            return;
        }

        response.setHeader("X-RateLimit-Remaining", Long.toString(probe.getRemainingTokens()));
        filterChain.doFilter(request, response);
    }

    /**
     * Authenticated requests key on the token subject; unauthenticated ones
     * on the client IP. ShouldNotFilter already guarantees an /api/ path, so
     * the security chain has run by the time this filter executes.
     */
    private static String keyFor(HttpServletRequest request) {
        return Optional.ofNullable(SecurityContextHolder.getContext().getAuthentication())
            .filter(Authentication::isAuthenticated)
            .map(Authentication::getPrincipal)
            .filter(Jwt.class::isInstance)
            .map(Jwt.class::cast)
            .map(jwt -> "sub:" + jwt.getSubject())
            .orElseGet(() -> "ip:" + clientIp(request));
    }

    /**
     * Resolves the client IP. The Next.js proxy (and any future ingress)
     * forwards the browser address in X-Forwarded-For; without it every
     * proxied client would share one bucket. Only the first entry is read —
     * this deployment has exactly one trusted proxy hop (web -> gateway on
     * the internal Docker network).
     */
    private static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            var matcher = FORWARDED_ENTRY.matcher(forwarded);
            if (matcher.find()) {
                return matcher.group();
            }
        }
        return request.getRemoteAddr();
    }

    private Bucket newBucket(boolean authEndpoint) {
        LocalBucketBuilder builder = Bucket.builder();
        if (authEndpoint) {
            builder.addLimit(bandwidth(
                properties.authCapacity(), properties.authRefillTokens(), properties.authRefillPeriod()));
        } else {
            builder.addLimit(bandwidth(properties.capacity(), properties.refillTokens(), properties.refillPeriod()));
        }
        return builder.build();
    }

    private static Bandwidth bandwidth(int capacity, int refillTokens, Duration refillPeriod) {
        return Bandwidth.builder()
            .capacity(capacity)
            .refillGreedy(refillTokens, refillPeriod)
            .build();
    }

    private void reject(
        HttpServletRequest request,
        HttpServletResponse response,
        long nanosToWaitForRefill
    ) throws IOException {
        long retryAfterSeconds = Math.max(1, TimeUnit.NANOSECONDS.toSeconds(nanosToWaitForRefill));

        String code = "RATE_LIMITED";
        UUID correlationId = Optional
            .ofNullable((UUID) request.getAttribute(CorrelationIdFilter.REQUEST_ATTRIBUTE))
            .orElseGet(UUID::randomUUID);

        log.info("Request rate limited bucket={} path={}",
            authKindOf(request), request.getRequestURI());

        ProblemDto problem = new ProblemDto(
            PROBLEM_BASE_URI + code.toLowerCase().replace('_', '-'),
            "Too many requests",
            HttpStatus.TOO_MANY_REQUESTS.value(),
            code,
            "Rate limit exceeded. Slow down and retry later.",
            correlationId
        );
        problem.setInstance(request.getRequestURI());

        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setHeader("Retry-After", Long.toString(retryAfterSeconds));
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        objectMapper.writeValue(response.getWriter(), problem);
    }

    private static String authKindOf(HttpServletRequest request) {
        return AUTH_PATH.matcher(request.getRequestURI()).matches() ? "auth" : "general";
    }
}
