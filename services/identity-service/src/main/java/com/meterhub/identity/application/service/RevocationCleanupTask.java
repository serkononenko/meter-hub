package com.meterhub.identity.application.service;

import com.meterhub.identity.ports.outbound.RevokedAccessTokenRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;

/**
 * Drops revocation rows whose token expiry has passed: no validator accepts
 * those tokens on {@code exp} anymore, so the gateway cache doesn't need to
 * know about them. Without this, the table (and the gateway's cold-start
 * poll) grows with every logout forever.
 */
@Component
public class RevocationCleanupTask {

    private static final Logger log = LoggerFactory.getLogger(RevocationCleanupTask.class);

    private final RevokedAccessTokenRepository revokedAccessTokens;

    public RevocationCleanupTask(RevokedAccessTokenRepository revokedAccessTokens) {
        this.revokedAccessTokens = revokedAccessTokens;
    }

    @Scheduled(cron = "0 17 * * * *")
    public void cleanup() {
        int deleted = revokedAccessTokens.deleteExpired(OffsetDateTime.now());
        if (deleted > 0) {
            log.info("Removed {} expired access-token revocations", deleted);
        }
    }
}
