package com.meterhub.gateway.web;

import com.meterhub.gateway.testsupport.GatewayIntegrationTest;
import com.meterhub.gateway.testsupport.JwtTestKeys;
import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.KeyUse;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.client.EntityExchangeResult;
import org.springframework.test.web.servlet.client.RestTestClient;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests gateway rate limiting (docs/service-boundaries.md §1).
 *
 * <p>Limits are overridden to tiny values so tests exhaust a bucket in a few
 * requests. The limiter runs after Spring Security, so anonymous requests to
 * protected paths are 401'd before the limiter sees them — the general
 * bucket is exercised with signed tokens (keyed on the token subject), the
 * auth bucket with anonymous requests to the permitAll'd auth endpoints
 * (keyed on client IP via X-Forwarded-For, which the web proxy sets in
 * production). Downstream services are down in these tests: a request that
 * gets past the limiter surfaces 5xx, never 429.
 */
@GatewayIntegrationTest
@TestPropertySource(properties = {
    "gateway.rate-limit.capacity=3",
    "gateway.rate-limit.refill-tokens=1",
    "gateway.rate-limit.refill-period=1h",
    "gateway.rate-limit.auth-capacity=2",
    "gateway.rate-limit.auth-refill-tokens=1",
    "gateway.rate-limit.auth-refill-period=1h",
})
class GatewayRateLimitIntegrationTest {

    @LocalServerPort
    private int port;

    private RestTestClient client;

    @BeforeEach
    void setUp() {
        client = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
    }

    @Test
    void authenticatedRequestsUnderLimitPassThrough() {
        String token = signedToken("sub-under-limit");

        for (int i = 0; i < 3; i++) {
            EntityExchangeResult<byte[]> result = households(token, "10.9.0.1");
            // Downstream service is down: anything but 429 means the request
            // got past the rate limiter
            assertThat(result.getStatus().value()).isNotEqualTo(429);
        }
    }

    @Test
    void exceedingLimitReturnsProblemJsonWithRetryAfter() {
        String token = signedToken("sub-over-limit");

        for (int i = 0; i < 3; i++) {
            households(token, "10.9.0.2");
        }

        EntityExchangeResult<byte[]> blocked = households(token, "10.9.0.2");

        assertThat(blocked.getStatus().value()).isEqualTo(429);
        assertThat(blocked.getResponseHeaders().getFirst("Retry-After")).isNotNull();
        assertThat(bodyOf(blocked))
            .contains("\"code\":\"RATE_LIMITED\"")
            .contains("\"status\":429")
            .contains("\"title\":\"Too many requests\"");
        // Correlation ID filter still runs for rejected requests
        assertThat(bodyOf(blocked)).contains("\"correlationId\":");
        assertThat(blocked.getResponseHeaders().getFirst(CorrelationIdFilter.HEADER)).isNotNull();
    }

    @Test
    void bucketsAreKeyedOnTokenSubjectNotClientIp() {
        // Same subject from two different client IPs shares one bucket:
        // 3 requests across the two IPs exhaust it, the 4th is blocked
        String token = signedToken("sub-shared-bucket");
        households(token, "10.9.1.1");
        households(token, "10.9.1.1");
        households(token, "10.9.1.2");
        assertThat(households(token, "10.9.1.2").getStatus().value()).isEqualTo(429);

        // A different subject (new token) from an already-exhausted IP is
        // untouched — proving the IP is not part of the general-bucket key
        String otherToken = signedToken("sub-other-bucket");
        assertThat(households(otherToken, "10.9.1.1").getStatus().value()).isNotEqualTo(429);
    }

    @Test
    void authEndpointsUseTheirOwnTighterBucket() {
        // Auth bucket allows 2 per IP; the general bucket allows 3, so a
        // third login from the same IP must trip the tighter limit
        for (int i = 0; i < 2; i++) {
            EntityExchangeResult<byte[]> result = login("10.9.2.1");
            // Identity service is down: anything but 429 means the limit passed
            assertThat(result.getStatus().value()).isNotEqualTo(429);
        }

        EntityExchangeResult<byte[]> blocked = login("10.9.2.1");

        assertThat(blocked.getStatus().value()).isEqualTo(429);
        assertThat(bodyOf(blocked)).contains("\"code\":\"RATE_LIMITED\"");
    }

    @Test
    void authBucketsAreIndependentPerClientIp() {
        for (int i = 0; i < 3; i++) {
            login("10.9.3.1");
        }
        assertThat(login("10.9.3.1").getStatus().value()).isEqualTo(429);

        // A different client IP has its own auth bucket
        assertThat(login("10.9.3.2").getStatus().value()).isNotEqualTo(429);
    }

    @Test
    void actuatorIsNeverRateLimited() {
        // Probes and Prometheus scrapes must not be starved by clients
        for (int i = 0; i < 10; i++) {
            EntityExchangeResult<byte[]> result = client.get().uri("/actuator/health")
                .header("X-Forwarded-For", "10.9.9.9")
                .exchange()
                .returnResult(byte[].class);
            assertThat(result.getStatus().value()).isEqualTo(200);
        }
    }

    private EntityExchangeResult<byte[]> households(String token, String clientIp) {
        return client.get().uri("/api/household-service/api/v1/households")
            .header("X-Forwarded-For", clientIp)
            .headers(headers -> headers.setBearerAuth(token))
            .exchange()
            .returnResult(byte[].class);
    }

    private EntityExchangeResult<byte[]> login(String clientIp) {
        return client.post().uri("/api/identity-service/api/v1/auth/login")
            .header("X-Forwarded-For", clientIp)
            .body(Map.of("email", "jane.doe@example.com", "password", "correct-horse-battery"))
            .exchange()
            .returnResult(byte[].class);
    }

    /** Signs a token the same way GatewayAuthenticationIntegrationTest does. */
    private static String signedToken(String subject) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
            .issuer("identity-service")
            .audience(List.of("meterhub-api"))
            .subject(subject)
            .issuedAt(now)
            .expiresAt(now.plusSeconds(300))
            .build();
        return new NimbusJwtEncoder(new ImmutableJWKSet<>(new JWKSet(testRsaKey())))
            .encode(JwtEncoderParameters.from(JwsHeader.with(SignatureAlgorithm.RS256).build(), claims))
            .getTokenValue();
    }

    private static RSAKey testRsaKey() {
        RSAKey rsaKey = new RSAKey.Builder(JwtTestKeys.publicKey())
            .privateKey(JwtTestKeys.privateKey())
            .keyUse(KeyUse.SIGNATURE)
            .build();
        try {
            return new RSAKey.Builder(rsaKey).keyID(rsaKey.computeThumbprint().toString()).build();
        } catch (JOSEException e) {
            throw new IllegalStateException("Failed to compute key thumbprint", e);
        }
    }

    private static String bodyOf(EntityExchangeResult<byte[]> result) {
        return new String(result.getResponseBodyContent(), StandardCharsets.UTF_8);
    }
}
