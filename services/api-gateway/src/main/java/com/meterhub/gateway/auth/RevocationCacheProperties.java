package com.meterhub.gateway.auth;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * Revocation cache settings.
 *
 * @param pollInterval how often the revocation feed is polled; also the
 * upper bound on how long logout takes to propagate
 * @param maxPagesPerPoll cap on feed pages consumed per tick, so burst
 * logouts cannot make one poll run unbounded
 * @param tokenTtl access-token TTL, mirrored from identity's issuer:
 * cache entries (and identity's rows) only need to
 * outlive tokens, which die on exp anyway
 * @param feedBaseUrl identity service's base URL — the feed is fetched
 * directly (service-to-service), not through this gateway's own routing
 */
@ConfigurationProperties(prefix = "identity.revocation")
public record RevocationCacheProperties(
    Duration pollInterval,
    int maxPagesPerPoll,
    Duration tokenTtl,
    String feedBaseUrl
) {
    public RevocationCacheProperties {
        if (pollInterval == null || pollInterval.isNegative() || pollInterval.isZero()) {
            pollInterval = Duration.ofSeconds(5);
        }
        if (maxPagesPerPoll <= 0) {
            maxPagesPerPoll = 10;
        }
        if (tokenTtl == null || tokenTtl.isNegative() || tokenTtl.isZero()) {
            tokenTtl = Duration.ofMinutes(15);
        }
    }
}
