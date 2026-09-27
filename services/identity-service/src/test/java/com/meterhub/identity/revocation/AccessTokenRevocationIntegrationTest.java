package com.meterhub.identity.revocation;

import com.meterhub.identity.adapters.inbound.web.CorrelationIdFilter;
import com.meterhub.identity.jooq.tables.Users;
import com.meterhub.identity.testsupport.IdentityIntegrationTest;
import com.jayway.jsonpath.JsonPath;
import org.jooq.DSLContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.client.EntityExchangeResult;
import org.springframework.test.web.servlet.client.RestTestClient;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for access-token revocation (backlog A4): logout with a
 * Bearer token records the token's jti, and GET
 * /api/v1/internal/revoked-access-tokens serves those jtis to the gateway's
 * cache with working pagination.
 */
@IdentityIntegrationTest
class AccessTokenRevocationIntegrationTest {

    @LocalServerPort
    private int port;

    @Autowired
    private DSLContext dsl;

    private RestTestClient client;

    @BeforeEach
    void setUp() {
        client = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
    }

    @AfterEach
    void cleanup() {
        dsl.deleteFrom(Users.USERS).execute();
    }

    @Test
    void logoutWithoutAccessTokenStillRevokesRefreshTokenOnly() {
        register("jane.doe@example.com", "jane.doe");
        String loginBody = bodyOf(login("jane.doe@example.com"));
        String refreshToken = JsonPath.read(loginBody, "$.refreshToken");

        // No Authorization header: legacy client shape
        EntityExchangeResult<byte[]> logout = client.post().uri("/api/v1/auth/logout")
            .contentType(MediaType.APPLICATION_JSON)
            .body(Map.of("refreshToken", refreshToken))
            .exchange()
            .returnResult(byte[].class);

        assertThat(logout.getStatus().value()).isEqualTo(204);
        assertThat(fetchFeed().isEmpty()).isTrue();
    }

    @Test
    void logoutWithAccessTokenRecordsItsJtiInTheFeed() {
        register("john.doe@example.com", "john.doe");
        String loginBody = bodyOf(login("john.doe@example.com"));
        String accessToken = JsonPath.read(loginBody, "$.accessToken");
        String refreshToken = JsonPath.read(loginBody, "$.refreshToken");

        EntityExchangeResult<byte[]> logout = client.post().uri("/api/v1/auth/logout")
            .header("Authorization", "Bearer " + accessToken)
            .contentType(MediaType.APPLICATION_JSON)
            .body(Map.of("refreshToken", refreshToken))
            .exchange()
            .returnResult(byte[].class);

        assertThat(logout.getStatus().value()).isEqualTo(204);

        List<String> jtis = fetchFeed();
        assertThat(jtis).hasSize(1);
        assertThat(jtis.getFirst()).isEqualTo(readClaim(accessToken, "jti"));
    }

    @Test
    void feedIsIdempotentAcrossPollsAndPaginationRespectsSince() {
        register("jane.doe@example.com", "jane.doe");
        String loginBody = bodyOf(login("jane.doe@example.com"));
        String accessToken = JsonPath.read(loginBody, "$.accessToken");
        String refreshToken = JsonPath.read(loginBody, "$.refreshToken");

        client.post().uri("/api/v1/auth/logout")
            .header("Authorization", "Bearer " + accessToken)
            .contentType(MediaType.APPLICATION_JSON)
            .body(Map.of("refreshToken", refreshToken))
            .exchange()
            .returnResult(byte[].class);

        List<String> firstPoll = fetchFeed();
        List<String> secondPoll = fetchFeed();
        // Cursor semantics: without 'since' the feed replays from the start,
        // so repeated cold-start polls see the same revocations
        assertThat(secondPoll).isEqualTo(firstPoll);
        assertThat(firstPoll.getFirst()).isEqualTo(readClaim(accessToken, "jti"));

        String next = JsonPath.read(bodyOf(feedResponse(null)), "$.next");
        // Paginating from the returned cursor yields nothing new
        List<String> afterCursor = fetchFeed(next);
        assertThat(afterCursor).isEmpty();
    }

    private List<String> fetchFeed() {
        return fetchFeed(null);
    }

    private List<String> fetchFeed(String since) {
        return JsonPath.read(bodyOf(feedResponse(since)), "$.jtis[*]");
    }

    private EntityExchangeResult<byte[]> feedResponse(String since) {
        var request = client.get().uri(uriBuilder -> {
            uriBuilder.path("/api/v1/internal/revoked-access-tokens");
            if (since != null) {
                uriBuilder.queryParam("since", since);
            }
            return uriBuilder.build();
        });
        return request.exchange().returnResult(byte[].class);
    }

    private static String readClaim(String token, String claim) {
        try {
            return com.nimbusds.jwt.SignedJWT.parse(token)
                .getJWTClaimsSet()
                .getStringClaim(claim);
        } catch (java.text.ParseException e) {
            throw new IllegalStateException("Unparseable access token", e);
        }
    }

    private EntityExchangeResult<byte[]> register(String email, String username) {
        return client.post().uri("/api/v1/auth/register")
            .contentType(MediaType.APPLICATION_JSON)
            .body(Map.of("email", email, "username", username, "password", "correct-horse-battery"))
            .exchange()
            .returnResult(byte[].class);
    }

    private EntityExchangeResult<byte[]> login(String email) {
        return client.post().uri("/api/v1/auth/login")
            .contentType(MediaType.APPLICATION_JSON)
            .body(Map.of("email", email, "password", "correct-horse-battery"))
            .exchange()
            .returnResult(byte[].class);
    }

    private static String bodyOf(EntityExchangeResult<byte[]> result) {
        assertThat(result.getStatus().value()).isEqualTo(200);
        String header = result.getResponseHeaders().getFirst(CorrelationIdFilter.HEADER);
        assertThat(header).isNotBlank();
        return new String(result.getResponseBodyContent());
    }
}
