package com.meterhub.gateway.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory set of revoked access-token {@code jti}s, refreshed from the
 * identity service's revocation feed every few seconds. Closing a session
 * (logout with a Bearer token) therefore stops working within the poll
 * interval instead of the token living out its full TTL.
 *
 * <p>Entries prune themselves after the access-token TTL: a revoked token is
 * rejected on {@code exp} at the latest anyway, so the cache never needs to
 * remember a jti longer than that (identity's own cleanup drops the rows on
 * the same bound; this side prunes by insertion age, which is conservative
 * and needs no per-entry expiry in the feed).
 *
 * <p>Trade-offs, deliberate at MVP scale (mirrors the rate limiter's
 * in-process buckets): the cache lives in one gateway JVM, but restarts
 * re-poll from the feed, so revocations survive restarts; sharing across
 * instances (Redis) is deferred to Phase 7. Identity being briefly
 * unreachable is non-fatal: polling retries on the next tick and validation
 * keeps using the last known set (fail open), because revocation is latency
 * optimization — every revoked token also dies at its {@code exp} at the
 * latest.
 */
@Component
public class RevocationCache {

    private static final Logger log = LoggerFactory.getLogger(RevocationCache.class);

    private final RevocationFeedClient feedClient;
    private final RevocationCacheProperties properties;

    /** jti -> insertion time; entries are dropped once older than the token TTL. */
    private final ConcurrentHashMap<String, Instant> revoked = new ConcurrentHashMap<>();

    /** Cursor for the next feed poll; null = cold start (fetch from oldest retained). */
    private volatile Instant cursor;

    public RevocationCache(RevocationFeedClient feedClient, RevocationCacheProperties properties) {
        this.feedClient = feedClient;
        this.properties = properties;
    }

    public boolean isRevoked(String jti) {
        return jti != null && revoked.containsKey(jti);
    }

    @Scheduled(fixedDelayString = "${identity.revocation.poll-interval:5s}")
    public void poll() {
        try {
            Instant now = Instant.now();
            Duration retention = properties.tokenTtl();
            revoked.entrySet().removeIf(entry -> entry.getValue().plus(retention).isBefore(now));

            for (int page = 0; page < properties.maxPagesPerPoll(); page++) {
                RevocationBatch batch = feedClient.fetch(cursor);
                batch.jtis().forEach(jti -> revoked.put(jti, now));
                cursor = batch.nextCursor();
                if (!batch.hasMore()) {
                    return;
                }
            }
        } catch (Exception e) {
            // Fail open: a missed poll delays revocation propagation by one
            // interval; it must never take down request validation.
            log.warn("Revocation feed poll failed, keeping last known set: {}", e.getMessage());
        }
    }
}
