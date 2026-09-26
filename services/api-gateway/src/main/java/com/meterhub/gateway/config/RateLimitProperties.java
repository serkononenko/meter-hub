package com.meterhub.gateway.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * Rate limiting settings (docs/service-boundaries.md §1 rate limiting).
 *
 * <p>Token bucket per key: {@code burstCapacity} tokens are available for
 * short bursts, refilled at {@code refillTokens} per {@code refillPeriod}.
 * Public auth endpoints (credential-stuffing targets) get their own tighter
 * bucket; everything else under {@code /api/} shares the general bucket.
 *
 * <p>Buckets live in-process (single gateway instance in the MVP); moving to
 * a shared store (Redis) is only needed once the gateway scales out.
 */
@ConfigurationProperties(prefix = "gateway.rate-limit")
public record RateLimitProperties(
    boolean enabled,
    // General bucket for authenticated API traffic
    int capacity,
    int refillTokens,
    Duration refillPeriod,
    // Tighter bucket for public auth endpoints (login, register, refresh,
    // logout) keyed by client IP
    int authCapacity,
    int authRefillTokens,
    Duration authRefillPeriod
) {
    public RateLimitProperties {
        if (capacity <= 0 || refillTokens <= 0 || authCapacity <= 0 || authRefillTokens <= 0) {
            throw new IllegalStateException("gateway.rate-limit capacities and refill tokens must be positive");
        }
        if (refillPeriod == null || refillPeriod.isZero() || refillPeriod.isNegative()
            || authRefillPeriod == null || authRefillPeriod.isZero() || authRefillPeriod.isNegative()) {
            throw new IllegalStateException("gateway.rate-limit refill periods must be positive durations");
        }
    }
}
