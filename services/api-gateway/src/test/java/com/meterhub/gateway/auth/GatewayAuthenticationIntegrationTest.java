package com.meterhub.gateway.auth;

import com.meterhub.gateway.testsupport.GatewayIntegrationTest;
import com.meterhub.gateway.testsupport.JwtTestKeys;
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
import org.springframework.test.web.servlet.client.EntityExchangeResult;
import org.springframework.test.web.servlet.client.RestTestClient;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for JWT validation at the gateway (task 3.3).
 *
 * <p>Protected paths are forwarded downstream, so the downstream service is
 * down in these tests: a request that passes the security layer surfaces as a
 * connection failure (5xx), which is exactly what "not a 401" asserts here —
 * the security layer accepted the token and routing took over.
 */
@GatewayIntegrationTest
class GatewayAuthenticationIntegrationTest {

    @LocalServerPort
    private int port;

    private RestTestClient client;

    @BeforeEach
    void setUp() {
        client = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
    }

    @Test
    void missingTokenReturnsUnauthorizedProblem() {
        EntityExchangeResult<byte[]> result = client.get().uri("/api/identity-service/api/v1/users/me")
            .exchange()
            .returnResult(byte[].class);

        assertThat(result.getStatus().value()).isEqualTo(401);
        assertThat(bodyOf(result))
            .contains("\"code\":\"UNAUTHORIZED\"")
            .contains("\"title\":\"Authentication required\"")
            .contains("\"detail\":\"A valid Bearer access token is required.\"");
    }

    @Test
    void invalidAndGarbageTokensReturnInvalidTokenProblem() {
        EntityExchangeResult<byte[]> garbage = me("not-a-jwt");
        EntityExchangeResult<byte[]> signedByWrongKey = me(wronglySignedToken());

        assertThat(garbage.getStatus().value()).isEqualTo(401);
        assertThat(signedByWrongKey.getStatus().value()).isEqualTo(401);
        assertThat(bodyOf(garbage))
            .contains("\"code\":\"INVALID_TOKEN\"")
            .contains("\"title\":\"Invalid access token\"")
            .contains("\"detail\":\"The access token is invalid or expired.\"");
        // Enumeration protection: identical problem bodies apart from the per-request correlation id
        assertThat(withoutCorrelationId(bodyOf(garbage)))
            .isEqualTo(withoutCorrelationId(bodyOf(signedByWrongKey)));
    }

    @Test
    void expiredAccessTokenReturnsInvalidTokenProblem() {
        Instant now = Instant.now();

        // Correctly signed but expired: the security layer must validate exp
        String expired = signedToken(
            "identity-service", List.of("meterhub-api"), now.minusSeconds(3600), now.minusSeconds(1800));

        EntityExchangeResult<byte[]> result = me(expired);

        assertThat(result.getStatus().value()).isEqualTo(401);
        assertThat(bodyOf(result))
            .contains("\"code\":\"INVALID_TOKEN\"")
            .contains("\"detail\":\"The access token is invalid or expired.\"");
        assertThat(withoutCorrelationId(bodyOf(result)))
            .isEqualTo(withoutCorrelationId(bodyOf(me(wronglySignedToken()))));
    }

    @Test
    void wrongIssuerReturnsInvalidTokenProblem() {
        String wrongIssuer = signedToken(
            "some-other-service", List.of("meterhub-api"), Instant.now(), Instant.now().plusSeconds(300));

        EntityExchangeResult<byte[]> result = me(wrongIssuer);

        assertThat(result.getStatus().value()).isEqualTo(401);
        assertThat(bodyOf(result))
            .contains("\"code\":\"INVALID_TOKEN\"")
            .contains("\"title\":\"Invalid access token\"");
        assertThat(withoutCorrelationId(bodyOf(result)))
            .isEqualTo(withoutCorrelationId(bodyOf(me(wronglySignedToken()))));
    }

    @Test
    void wrongAudienceReturnsInvalidTokenProblem() {
        String wrongAudience = signedToken(
            "identity-service", List.of("some-other-audience"), Instant.now(), Instant.now().plusSeconds(300));

        EntityExchangeResult<byte[]> result = me(wrongAudience);

        assertThat(result.getStatus().value()).isEqualTo(401);
        assertThat(bodyOf(result)).contains("\"code\":\"INVALID_TOKEN\"");
        assertThat(withoutCorrelationId(bodyOf(result)))
            .isEqualTo(withoutCorrelationId(bodyOf(me(wronglySignedToken()))));
    }

    @Test
    void validTokenPassesSecurityLayerAndIsForwarded() {
        String token = signedToken(
            "identity-service", List.of("meterhub-api"), Instant.now(), Instant.now().plusSeconds(300));

        EntityExchangeResult<byte[]> result = me(token);

        // Identity service is not running in tests, so the proxied call fails
        // with 5xx; a 401 would mean the security layer rejected a valid token
        assertThat(result.getStatus().value()).isNotEqualTo(401);
    }

    @Test
    void healthEndpointIsPublic() {
        EntityExchangeResult<byte[]> result = client.get().uri("/actuator/health")
            .exchange()
            .returnResult(byte[].class);

        assertThat(result.getStatus().value()).isEqualTo(200);
    }

    @Test
    void authEndpointsArePublic() {
        // Downstream is down: a 5xx (connection refused) means the security
        // layer let the request through; a 401 would mean it demanded a token
        EntityExchangeResult<byte[]> register = client.post().uri("/api/identity-service/api/v1/auth/register")
            .body(Map.of(
                "email", "jane.doe@example.com",
                "username", "jane.doe",
                "password", "correct-horse-battery"
            ))
            .exchange()
            .returnResult(byte[].class);
        EntityExchangeResult<byte[]> login = client.post().uri("/api/identity-service/api/v1/auth/login")
            .body(Map.of(
                "email", "jane.doe@example.com",
                "password", "correct-horse-battery"
            ))
            .exchange()
            .returnResult(byte[].class);
        EntityExchangeResult<byte[]> refresh = client.post().uri("/api/identity-service/api/v1/auth/refresh")
            .body(Map.of("refreshToken", "anything"))
            .exchange()
            .returnResult(byte[].class);
        EntityExchangeResult<byte[]> logout = client.post().uri("/api/identity-service/api/v1/auth/logout")
            .exchange()
            .returnResult(byte[].class);

        assertThat(register.getStatus().value()).isNotEqualTo(401);
        assertThat(login.getStatus().value()).isNotEqualTo(401);
        assertThat(refresh.getStatus().value()).isNotEqualTo(401);
        assertThat(logout.getStatus().value()).isNotEqualTo(401);
    }

    private String signedToken(String issuer, List<String> audience, Instant issuedAt, Instant expiresAt) {
        JwtClaimsSet claims = JwtClaimsSet.builder()
            .issuer(issuer)
            .subject(UUID.randomUUID().toString())
            .audience(audience)
            .issuedAt(issuedAt)
            .expiresAt(expiresAt)
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

    private static String wronglySignedToken() {
        // A structurally valid JWT signed with a key that is not ours
        return "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJlNGMzYTFmNy0zYTExLTQxYTQtOGI0MS04NzQ3ZDA3Njk4NDUifQ"
            + ".c2lnbmF0dXJlLXdpdGgtd3Jvbmcta2V5";
    }

    private EntityExchangeResult<byte[]> me(String accessToken) {
        return client.get().uri("/api/identity-service/api/v1/users/me")
            .headers(headers -> headers.setBearerAuth(accessToken))
            .exchange()
            .returnResult(byte[].class);
    }

    private static String withoutCorrelationId(String body) {
        return body.replaceAll("\"correlationId\":\"[^\"]*\",?", "");
    }

    private static String bodyOf(EntityExchangeResult<byte[]> result) {
        return new String(result.getResponseBodyContent(), StandardCharsets.UTF_8);
    }
}
