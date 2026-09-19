package com.meterhub.gateway.web;

import com.meterhub.gateway.testsupport.JwtKeysContextInitializer;
import com.meterhub.gateway.testsupport.JwtTestKeys;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.KeyUse;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpExchange;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;
import org.springframework.http.HttpHeaders;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.web.servlet.client.EntityExchangeResult;
import org.springframework.test.web.servlet.client.RestTestClient;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentLinkedQueue;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for gateway routing (task 9.3). One stub HTTP server
 * stands in for every downstream service; all four route URIs point at it,
 * and each hit records the received path and Authorization header. This
 * pins down the routing table: one route per service, the
 * /api/&lt;service-name&gt; prefix stripped so downstream services keep
 * serving their contract paths unchanged, the caller's access token
 * propagated, and unrecognized service prefixes rejected before routing.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ContextConfiguration(initializers = {
    JwtKeysContextInitializer.class,
    GatewayRoutingIntegrationTest.RoutingStubSetup.class
})
class GatewayRoutingIntegrationTest {

    private static final List<String> SERVICES = List.of(
        "identity-service", "household-service", "meter-service", "reading-service");

    /** Hits recorded by the stub; drained by each test. */
    static final ConcurrentLinkedQueue<Hit> HITS = new ConcurrentLinkedQueue<>();

    record Hit(String method, String path, String authorization) {
    }

    @org.springframework.boot.test.web.server.LocalServerPort
    private int port;

    private RestTestClient client;

    @org.junit.jupiter.api.BeforeEach
    void setUp() {
        client = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
        HITS.clear();
    }

    @Test
    void eachServiceRouteStripsThePrefixAndForwardsToItsDownstream() {
        for (String service : SERVICES) {
            EntityExchangeResult<byte[]> result = client.get()
                .uri("/api/" + service + "/api/v1/ping")
                .headers(headers -> headers.setBearerAuth(signedToken()))
                .exchange()
                .expectStatus().isEqualTo(200)
                .returnResult(byte[].class);

            assertThat(HITS).withFailMessage("No hit recorded for %s", service).hasSize(1);
            Hit hit = HITS.poll();
            // StripPrefix=2 removes /api and /<service-name> so the stub sees
            // the contract path unchanged, whichever service was addressed.
            assertThat(hit.path()).isEqualTo("/api/v1/ping");
            assertThat(hit.authorization()).startsWith("Bearer ");
        }
    }

    @Test
    void authorizationHeaderIsPropagatedVerbatimToTheDownstreamService() {
        String token = signedToken();

        client.get().uri("/api/meter-service/api/v1/ping")
            .headers(headers -> headers.setBearerAuth(token))
            .exchange()
            .expectStatus().isEqualTo(200);

        Hit hit = HITS.poll();
        assertThat(hit.authorization()).isEqualTo("Bearer " + token);
    }

    @Test
    void unknownServicePrefixIsNotRoutedDownstream() {
        // The security layer authenticates before routing, so an
        // unauthenticated request to an unrouted prefix is 401, not 404 —
        // the important part is that nothing reaches a downstream service
        EntityExchangeResult<byte[]> unauthenticated = client.get()
            .uri("/api/no-such-service/api/v1/ping")
            .exchange()
            .returnResult(byte[].class);
        assertThat(unauthenticated.getStatus().value()).isEqualTo(401);

        EntityExchangeResult<byte[]> authenticated = client.get()
            .uri("/api/no-such-service/api/v1/ping")
            .headers(headers -> headers.setBearerAuth(signedToken()))
            .exchange()
            .returnResult(byte[].class);
        assertThat(authenticated.getStatus().value()).isEqualTo(404);

        assertThat(HITS).isEmpty();
    }

    private String signedToken() {
        JwtClaimsSet claims = JwtClaimsSet.builder()
            .issuer("identity-service")
            .audience(List.of("meterhub-api"))
            .subject(UUID.randomUUID().toString())
            .issuedAt(Instant.now())
            .expiresAt(Instant.now().plusSeconds(300))
            .build();
        return new NimbusJwtEncoder(new ImmutableJWKSet<>(new JWKSet(testRsaKey())))
            .encode(JwtEncoderParameters.from(JwsHeader.with(SignatureAlgorithm.RS256).build(), claims))
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

    /**
     * Starts the downstream stub before the Spring context refreshes and
     * overrides every route URI to point at it.
     */
    static class RoutingStubSetup implements ApplicationContextInitializer<ConfigurableApplicationContext> {

        private static HttpServer stub;

        @Override
        public void initialize(ConfigurableApplicationContext context) {
            try {
                if (stub == null) {
                    stub = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
                    stub.createContext("/", exchange -> {
                        try {
                            String path = exchange.getRequestURI().getPath();
                            String authorization = exchange.getRequestHeaders().getFirst(HttpHeaders.AUTHORIZATION);
                            // 200 only for contract paths that survived prefix
                            // stripping; anything else is a routing miss (404).
                            if (path.equals("/api/v1/ping")) {
                                HITS.add(new Hit(exchange.getRequestMethod(), path, authorization));
                                byte[] body = "ok".getBytes(StandardCharsets.US_ASCII);
                                exchange.sendResponseHeaders(200, body.length);
                                exchange.getResponseBody().write(body);
                            } else {
                                exchange.sendResponseHeaders(404, -1);
                            }
                        } finally {
                            exchange.close();
                        }
                    });
                    stub.start();
                }
                String base = "http://127.0.0.1:" + stub.getAddress().getPort();
                ConfigurableEnvironment environment = context.getEnvironment();
                // Override the URL placeholders the route table already
                // references, so the YAML route definitions stay authoritative
                environment.getPropertySources().addFirst(new MapPropertySource("gateway-routing-stub", Map.of(
                    "IDENTITY_SERVICE_URL", base,
                    "HOUSEHOLD_SERVICE_URL", base,
                    "METER_SERVICE_URL", base,
                    "READING_SERVICE_URL", base
                )));
            } catch (Exception e) {
                throw new IllegalStateException("Failed to start routing stub", e);
            }
        }

        @AfterAll
        static void stopStub() {
            if (stub != null) {
                stub.stop(0);
            }
        }
    }
}
