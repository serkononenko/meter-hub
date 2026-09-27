package com.meterhub.gateway.auth;

import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.List;

/**
 * Fetches one page of access-token revocations from the identity service's
 * internal feed. The gateway is the only consumer; the call runs on the
 * poll schedule, never on the request path.
 */
@Component
public class RevocationFeedClient {

    private static final String FEED_PATH = "/api/v1/internal/revoked-access-tokens";

    private final RestClient restClient;

    public RevocationFeedClient(RestClient.Builder restClientBuilder, RevocationCacheProperties properties) {
        // Direct to identity, not through this gateway's own routing: the
        // internal path is denied on the proxied surface, and the poll is a
        // service-to-service call, not a client request.
        this.restClient = restClientBuilder.baseUrl(properties.feedBaseUrl()).build();
    }

    public RevocationBatch fetch(Instant cursor) {
        FeedResponse response = restClient.get()
            .uri(uriBuilder -> {
                uriBuilder.path(FEED_PATH);
                if (cursor != null) {
                    uriBuilder.queryParam("since", cursor.toString());
                }
                return uriBuilder.build();
            })
            .accept(MediaType.APPLICATION_JSON)
            .retrieve()
            .body(FeedResponse.class);

        if (response == null) {
            return new RevocationBatch(List.of(), null);
        }
        return new RevocationBatch(
            response.jtis() == null ? List.of() : response.jtis(),
            parseCursor(response.next())
        );
    }

    private static Instant parseCursor(String next) {
        if (next == null) {
            return null;
        }
        try {
            return OffsetDateTime.parse(next).toInstant();
        } catch (DateTimeParseException e) {
            throw new IllegalStateException("Revocation feed returned an unparseable cursor", e);
        }
    }

    record FeedResponse(List<String> jtis, String next) {
    }
}
