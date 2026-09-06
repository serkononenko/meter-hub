package com.meterhub.identity.refresh;

import com.meterhub.identity.adapters.inbound.web.CorrelationIdFilter;
import com.meterhub.identity.jooq.tables.RefreshTokens;
import com.meterhub.identity.jooq.tables.Users;
import com.meterhub.identity.testsupport.IdentityIntegrationTest;
import com.jayway.jsonpath.JsonPath;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSVerifier;
import com.nimbusds.jose.crypto.RSASSAVerifier;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.jooq.DSLContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.client.EntityExchangeResult;
import org.springframework.test.web.servlet.client.RestTestClient;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for POST /api/v1/auth/refresh and POST /api/v1/auth/logout (task 2.5).
 */
@IdentityIntegrationTest
class RefreshIntegrationTest {

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
    void refreshReturnsNewTokenPair() throws Exception {
        register("jane.doe@example.com", "jane.doe", "correct-horse-battery");
        String loginBody = bodyOf(login("jane.doe@example.com", "correct-horse-battery"));
        String originalAccess = JsonPath.read(loginBody, "$.accessToken");
        String originalRefresh = JsonPath.read(loginBody, "$.refreshToken");

        EntityExchangeResult<byte[]> result = refresh(originalRefresh);

        assertThat(result.getStatus().value()).isEqualTo(200);
        assertThat(result.getResponseHeaders().getFirst(CorrelationIdFilter.HEADER)).isNotBlank();
        String body = bodyOf(result);
        String newAccess = JsonPath.read(body, "$.accessToken");
        String newRefresh = JsonPath.read(body, "$.refreshToken");
        // Rotation: the refresh token is never reused. (The access token may
        // legitimately repeat when issued within the same second — it is a
        // deterministic JWT — so only the refresh token proves rotation.)
        assertThat(newRefresh).isNotEqualTo(originalRefresh);
        assertThat(body)
            .contains("\"tokenType\":\"Bearer\"")
            .contains("\"email\":\"jane.doe@example.com\"")
            .doesNotContain("\"password\"");

        verifyJwt(newAccess);
    }

    @Test
    void rotatedTokenCannotBeReusedButReplacementWorks() {
        register("jane.doe@example.com", "jane.doe", "correct-horse-battery");
        String firstBody = bodyOf(login("jane.doe@example.com", "correct-horse-battery"));
        String firstRefresh = JsonPath.read(firstBody, "$.refreshToken");

        String secondBody = bodyOf(refresh(firstRefresh));
        String secondRefresh = JsonPath.read(secondBody, "$.refreshToken");

        // Presenting the already-consumed token again fails...
        EntityExchangeResult<byte[]> reuse = refresh(firstRefresh);
        assertThat(reuse.getStatus().value()).isEqualTo(401);
        assertThat(bodyOf(reuse)).contains("\"code\":\"INVALID_REFRESH_TOKEN\"");

        // ...while its replacement still works.
        EntityExchangeResult<byte[]> next = refresh(secondRefresh);
        assertThat(next.getStatus().value()).isEqualTo(200);
    }

    @Test
    void unknownExpiredAndRevokedTokensAllFailIdentically() throws Exception {
        register("jane.doe@example.com", "jane.doe", "correct-horse-battery");
        String loginBody = bodyOf(login("jane.doe@example.com", "correct-horse-battery"));
        String validRefresh = JsonPath.read(loginBody, "$.refreshToken");

        // An expired token, planted directly with the same hash scheme the service uses
        String expiredRawToken = "expired-raw-token-value";
        UUID userId = UUID.fromString(JsonPath.read(loginBody, "$.user.id"));
        dsl.insertInto(RefreshTokens.REFRESH_TOKENS)
            .set(RefreshTokens.REFRESH_TOKENS.ID, UUID.randomUUID())
            .set(RefreshTokens.REFRESH_TOKENS.USER_ID, userId)
            .set(RefreshTokens.REFRESH_TOKENS.TOKEN_HASH, sha256Hex(expiredRawToken))
            .set(RefreshTokens.REFRESH_TOKENS.EXPIRES_AT, OffsetDateTime.now().minusHours(1))
            .execute();

        // Revocation via a consumed refresh
        String rotatedBody = bodyOf(refresh(validRefresh));
        String rotatedToken = JsonPath.read(rotatedBody, "$.refreshToken");

        EntityExchangeResult<byte[]> unknown = refresh("totally-unknown-token");
        EntityExchangeResult<byte[]> expired = refresh(expiredRawToken);
        EntityExchangeResult<byte[]> revoked = refresh(validRefresh);

        assertThat(unknown.getStatus().value()).isEqualTo(401);
        assertThat(expired.getStatus().value()).isEqualTo(401);
        assertThat(revoked.getStatus().value()).isEqualTo(401);
        // Enumeration protection: identical problem bodies apart from the per-request correlation id
        String sanitizedUnknown = withoutCorrelationId(bodyOf(unknown));
        assertThat(sanitizedUnknown).isEqualTo(withoutCorrelationId(bodyOf(expired)));
        assertThat(sanitizedUnknown).isEqualTo(withoutCorrelationId(bodyOf(revoked)));
        assertThat(sanitizedUnknown).contains("\"code\":\"INVALID_REFRESH_TOKEN\"");
    }

    @Test
    void logoutRevokesRefreshToken() {
        register("jane.doe@example.com", "jane.doe", "correct-horse-battery");
        String loginBody = bodyOf(login("jane.doe@example.com", "correct-horse-battery"));
        String refreshToken = JsonPath.read(loginBody, "$.refreshToken");

        EntityExchangeResult<byte[]> logout = logout(refreshToken);

        assertThat(logout.getStatus().value()).isEqualTo(204);
        assertThat(logout.getResponseBodyContent()).isEmpty();

        EntityExchangeResult<byte[]> afterLogout = refresh(refreshToken);
        assertThat(afterLogout.getStatus().value()).isEqualTo(401);
        assertThat(bodyOf(afterLogout)).contains("\"code\":\"INVALID_REFRESH_TOKEN\"");
    }

    @Test
    void logoutIsIdempotent() {
        register("jane.doe@example.com", "jane.doe", "correct-horse-battery");
        String loginBody = bodyOf(login("jane.doe@example.com", "correct-horse-battery"));
        String refreshToken = JsonPath.read(loginBody, "$.refreshToken");

        assertThat(logout(refreshToken).getStatus().value()).isEqualTo(204);
        // Repeating logout succeeds the same way
        assertThat(logout(refreshToken).getStatus().value()).isEqualTo(204);
        // So does logout with a token that never existed
        assertThat(logout("never-issued-token").getStatus().value()).isEqualTo(204);
    }

    @Test
    void validationErrorsReturn400() {
        EntityExchangeResult<byte[]> missing = client.post().uri("/api/v1/auth/refresh")
            .contentType(MediaType.APPLICATION_JSON)
            .body(Map.of())
            .exchange()
            .returnResult(byte[].class);

        EntityExchangeResult<byte[]> blank = refresh("");

        assertThat(missing.getStatus().value()).isEqualTo(400);
        assertThat(blank.getStatus().value()).isEqualTo(400);
        assertThat(bodyOf(missing))
            .contains("\"code\":\"VALIDATION_ERROR\"")
            .contains("\"errors\"");
    }

    private void verifyJwt(String token) throws Exception {
        SignedJWT signed = SignedJWT.parse(token);
        assertThat(signed.getHeader().getAlgorithm()).isEqualTo(JWSAlgorithm.RS256);

        JWSVerifier verifier = new RSASSAVerifier(
            com.meterhub.identity.testsupport.JwtTestKeys.publicKey());
        assertThat(signed.verify(verifier)).isTrue();

        JWTClaimsSet claims = signed.getJWTClaimsSet();
        assertThat(claims.getSubject()).isNotBlank();
        assertThat(claims.getExpirationTime()).isAfter(OffsetDateTime.now().toInstant());
    }

    private EntityExchangeResult<byte[]> register(String email, String username, String password) {
        return client.post().uri("/api/v1/auth/register")
            .contentType(MediaType.APPLICATION_JSON)
            .body(Map.of("email", email, "username", username, "password", password))
            .exchange()
            .returnResult(byte[].class);
    }

    private EntityExchangeResult<byte[]> login(String email, String password) {
        return client.post().uri("/api/v1/auth/login")
            .contentType(MediaType.APPLICATION_JSON)
            .body(Map.of("email", email, "password", password))
            .exchange()
            .returnResult(byte[].class);
    }

    private EntityExchangeResult<byte[]> refresh(String refreshToken) {
        return client.post().uri("/api/v1/auth/refresh")
            .contentType(MediaType.APPLICATION_JSON)
            .body(Map.of("refreshToken", refreshToken))
            .exchange()
            .returnResult(byte[].class);
    }

    private EntityExchangeResult<byte[]> logout(String refreshToken) {
        return client.post().uri("/api/v1/auth/logout")
            .contentType(MediaType.APPLICATION_JSON)
            .body(Map.of("refreshToken", refreshToken))
            .exchange()
            .returnResult(byte[].class);
    }

    private static String withoutCorrelationId(String body) {
        return body.replaceAll("\"correlationId\":\"[^\"]*\",?", "");
    }

    private static String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is always available", e);
        }
    }

    private static String bodyOf(EntityExchangeResult<byte[]> result) {
        return new String(result.getResponseBodyContent(), StandardCharsets.UTF_8);
    }
}
