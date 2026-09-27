package com.meterhub.gateway.auth;

import com.meterhub.gateway.client.identity.ApiClient;
import com.meterhub.gateway.client.identity.api.InternalApi;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

/**
 * Fetches one page of access-token revocations from the identity service's
 * internal feed. The gateway is the only consumer; the call runs on the
 * poll schedule, never on the request path. Thin adapter over the
 * generated OpenAPI client — the contract YAML is the source of truth for
 * path, parameters and payload shape.
 */
@Component
public class RevocationFeedClient {

    private final InternalApi internalApi;

    public RevocationFeedClient(RevocationCacheProperties properties) {
        ApiClient apiClient = new ApiClient();
        apiClient.setBasePath(properties.feedBaseUrl());

        this.internalApi = new InternalApi(apiClient);
    }

    public RevocationBatch fetch(Instant cursor) {
        com.meterhub.gateway.client.identity.model.RevocationBatch batch = internalApi.listRevokedAccessTokens(
            cursor == null ? null : OffsetDateTime.ofInstant(cursor, ZoneOffset.UTC),
            null
        );
        if (batch == null) {
            return new RevocationBatch(List.of(), null);
        }
        return new RevocationBatch(
            batch.getJtis().stream().map(UUID::toString).toList(),
            batch.getNext() == null ? null : batch.getNext().toInstant()
        );
    }
}
