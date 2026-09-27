package com.meterhub.gateway.auth;

import com.meterhub.gateway.testsupport.GatewayIntegrationTest;
import com.meterhub.gateway.testsupport.JwtKeysContextInitializer;
import com.meterhub.gateway.testsupport.JwtTestKeys;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.KeyUse;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.web.servlet.client.EntityExchangeResult;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for the gateway's access-token revocation cache
 * (backlog A4): a jti the identity feed reports as revoked must fail JWT
 * validation, before and after a cache poll picks it up. The identity
 * service is not running in these tests, so the poller fails open and the
 * tests drive the cache directly — the feed wiring itself is covered by
 * identity's own integration tests.
 */
@GatewayIntegrationTest
// The local @ContextConfiguration replaces the meta-annotation's one, so the
// JWT key initializer has to be repeated here alongside the feed stub wiring.
@ContextConfiguration(initializers = {
    JwtKeysContextInitializer.class,
    GatewayRevocationIntegrationTest.FeedConfigInitializer.class
})
class GatewayRevocationIntegrationTest {

    @LocalServerPort
    private int port;

    @Autowired
    private RevocationCache revocationCache;

    private RestTestClient client;

    @BeforeEach
    void setUp() {
        client = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
    }

    @Test
    void revokedJtiIsRejectedWithInvalidTokenProblem() {
        UUID jti = UUID.randomUUID();
        String token = signedToken(jti);

        revocationCache.poll(); // prune expired entries, harmless
        acceptIntoCache(jti);

        EntityExchangeResult<byte[]> result = me(token);

        assertThat(result.getStatus().value()).isEqualTo(401);
        // Same unspecific problem as any other invalid token: the response
        // must not reveal that the token was revoked vs simply invalid
        assertThat(bodyOf(result))
            .contains("\"code\":\"INVALID_TOKEN\"")
            .contains("The access token is invalid or expired.");
    }

    @Test
    void tokenWithoutJtiStillValidates() {
        // Tokens issued before A4 carry no jti; they must live out their TTL
        String token = signedToken(null);

        EntityExchangeResult<byte[]> result = me(token);

        assertThat(result.getStatus().value())
            .as("response body: %s", bodyOf(result))
            .isNotEqualTo(401);
    }

    @Test
    void unrevokedJtiStillValidates() {
        String token = signedToken(UUID.randomUUID());

        EntityExchangeResult<byte[]> result = me(token);

        assertThat(result.getStatus().value())
            .as("response body: %s", bodyOf(result))
            .isNotEqualTo(401);
    }

    private void acceptIntoCache(UUID jti) {
        // poll() fetches through the feed client, which the initializer
        // pointed at the in-JVM stub — so a poll with the stub primed lands
        // the jti in the cache exactly the way production propagation works.
        StubIdentityFeed.respondWith(jti.toString());
        revocationCache.poll();
    }

    private String signedToken(UUID jti) {
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder()
            .issuer("identity-service")
            .subject(UUID.randomUUID().toString())
            .audience(List.of("meterhub-api"))
            .issuedAt(Instant.now())
            .expiresAt(Instant.now().plusSeconds(300));
        if (jti != null) {
            claims.id(jti.toString());
        }
        return new NimbusJwtEncoder(new ImmutableJWKSet<>(new JWKSet(testRsaKey())))
            .encode(JwtEncoderParameters.from(JwsHeader.with(SignatureAlgorithm.RS256).build(), claims.build()))
            .getTokenValue();
    }

    private RSAKey testRsaKey() {
        RSAKey rsaKey = new RSAKey.Builder(JwtTestKeys.publicKey())
            .privateKey(JwtTestKeys.privateKey())
            .keyUse(KeyUse.SIGNATURE)
            .build();
        try {
            return new RSAKey.Builder(rsaKey).keyID(rsaKey.computeThumbprint().toString()).build();
        } catch (com.nimbusds.jose.JOSEException e) {
            throw new IllegalStateException("Failed to compute key thumbprint", e);
        }
    }

    private EntityExchangeResult<byte[]> me(String accessToken) {
        return client.get().uri("/api/identity-service/api/v1/users/me")
            .headers(headers -> headers.setBearerAuth(accessToken))
            .exchange()
            .returnResult(byte[].class);
    }

    private static String bodyOf(EntityExchangeResult<byte[]> result) {
        return new String(result.getResponseBodyContent() == null ? new byte[0] : result.getResponseBodyContent());
    }

    /**
     * Points the feed client at a stub server this test class spins up, so
     * poll() can be exercised end to end without the identity service.
     */
    static class FeedConfigInitializer implements ApplicationContextInitializer<ConfigurableApplicationContext> {
        @Override
        public void initialize(ConfigurableApplicationContext context) {
            // The stub server is owned by the static holder below; started
            // once per JVM, registered port injected as a property source —
            // the same mechanism JwtKeysContextInitializer uses.
            context.getEnvironment().getPropertySources().addFirst(
                new org.springframework.core.env.MapPropertySource(
                    "gateway-revocation-test-feed",
                    Map.of("identity.revocation.feed-base-url",
                        "http://localhost:" + StubIdentityFeed.start())
                ));
        }
    }

    /**
     * Minimal in-JVM HTTP stub answering the revocation feed path with the
     * last jti {@link #respondWith} was given.
     */
    static class StubIdentityFeed {

        private static volatile com.sun.net.httpserver.HttpServer server;
        private static volatile String responseBody = "{\"jtis\":[],\"next\":null}";
        private static volatile int actualPort;

        static synchronized int start() {
            if (server != null) {
                return actualPort;
            }
            try {
                server = com.sun.net.httpserver.HttpServer.create(new java.net.InetSocketAddress(0), 0);
                server.createContext("/api/v1/internal/revoked-access-tokens", exchange -> {
                    byte[] body = responseBody.getBytes();
                    exchange.getResponseHeaders().set("Content-Type", "application/json");
                    exchange.sendResponseHeaders(200, body.length);
                    try (var out = exchange.getResponseBody()) {
                        out.write(body);
                    }
                });
                server.start();
                actualPort = server.getAddress().getPort();
                return actualPort;
            } catch (Exception e) {
                throw new IllegalStateException("Failed to start stub feed", e);
            }
        }

        static void respondWith(String jti) {
            responseBody = "{\"jtis\":[\"" + jti + "\"],\"next\":null}";
        }
    }
}
