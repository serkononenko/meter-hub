package com.meterhub.gateway.auth;

import java.time.Instant;
import java.util.List;

/**
 * One page of the identity service's revocation feed.
 *
 * @param jtis       revoked access-token IDs, oldest revocation first
 * @param nextCursor poll cursor for the following page; null when the batch
 *                   is empty (consumer keeps its previous cursor)
 */
public record RevocationBatch(List<String> jtis, Instant nextCursor) {

    public boolean hasMore() {
        return !jtis.isEmpty();
    }
}
