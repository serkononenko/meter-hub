package com.meterhub.identity.login;

import com.meterhub.identity.adapters.inbound.web.CorrelationIdFilter;
import com.meterhub.identity.config.JwtProperties;
import com.meterhub.identity.testsupport.IdentityIntegrationTest;
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
import java.text.ParseException;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for POST /api/v1/auth/login (task 2.4).
 */
@IdentityIntegrationTest
class LoginIntegrationTest {

    @LocalServerPort
    private int port;

    @Autowired
    private JwtProperties jwtProperties;

    @Autowired
    private DSLContext dsl;

    private RestTestClient client;

    @BeforeEach
    void setUp() {
        client = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
    }

    @AfterEach
    void cleanup() {
        dsl.deleteFrom(com.meterhub.identity.jooq.tables.Users.USERS).execute();
    }

    @Test
    void loginReturnsTokenWithUserMetadata() throws ParseException, com.nimbusds.jose.JOSEException {
        register("jane.doe@example.com", "jane.doe", "correct-horse-battery");

        EntityExchangeResult<byte[]> result = login("jane.doe@example.com", "correct-horse-battery");

        assertThat(result.getStatus().value()).isEqualTo(200);
        assertThat(result.getResponseHeaders().getFirst(CorrelationIdFilter.HEADER)).isNotBlank();
        String body = bodyOf(result);
        assertThat(body)
            .contains("\"accessToken\"")
            .contains("\"tokenType\":\"Bearer\"")
            .contains("\"expiresIn\":" + jwtProperties.accessTokenTtl().toSeconds())
            .contains("\"email\":\"jane.doe@example.com\"")
            .contains("\"status\":\"ACTIVE\"")
            .doesNotContain("\"password\"")
            .doesNotContain("passwordHash");

        verifyJwt(body);
    }

    @Test
    void unknownEmailIsGeneric401() {
        register("existing@example.com", "existing.user", "correct-horse-battery");

        EntityExchangeResult<byte[]> result = login("nobody@example.com", "correct-horse-battery");

        assertThat(result.getStatus().value()).isEqualTo(401);
        assertThat(bodyOf(result)).contains("\"code\":\"INVALID_CREDENTIALS\"");
    }

    @Test
    void wrongPasswordIsGeneric401() {
        register("jane.doe@example.com", "jane.doe", "correct-horse-battery");

        EntityExchangeResult<byte[]> result = login("jane.doe@example.com", "wrong-password");

        assertThat(result.getStatus().value()).isEqualTo(401);
        assertThat(bodyOf(result))
            .contains("\"code\":\"INVALID_CREDENTIALS\"")
            .contains("\"correlationId\"");
    }

    @Test
    void disabledAccountCannotLogIn() {
        register("jane.doe@example.com", "jane.doe", "correct-horse-battery");
        dsl.update(com.meterhub.identity.jooq.tables.Users.USERS)
            .set(com.meterhub.identity.jooq.tables.Users.USERS.STATUS, "DISABLED")
            .where(com.meterhub.identity.jooq.tables.Users.USERS.EMAIL.equalIgnoreCase("jane.doe@example.com"))
            .execute();

        EntityExchangeResult<byte[]> result = login("jane.doe@example.com", "correct-horse-battery");

        assertThat(result.getStatus().value()).isEqualTo(401);
        assertThat(bodyOf(result))
            .contains("\"code\":\"INVALID_CREDENTIALS\"")
            // Enumeration protection: same code as wrong password / unknown email
            .doesNotContain("DISABLED");
    }

    @Test
    void lockedAccountCannotLogIn() {
        register("jane.doe@example.com", "jane.doe", "correct-horse-battery");
        dsl.update(com.meterhub.identity.jooq.tables.Users.USERS)
            .set(com.meterhub.identity.jooq.tables.Users.USERS.STATUS, "LOCKED")
            .where(com.meterhub.identity.jooq.tables.Users.USERS.EMAIL.equalIgnoreCase("jane.doe@example.com"))
            .execute();

        EntityExchangeResult<byte[]> result = login("jane.doe@example.com", "correct-horse-battery");

        assertThat(result.getStatus().value()).isEqualTo(401);
        assertThat(bodyOf(result)).contains("\"code\":\"INVALID_CREDENTIALS\"");
    }

    @Test
    void loginIsCaseInsensitiveForEmail() {
        register("jane.doe@example.com", "jane.doe", "correct-horse-battery");

        EntityExchangeResult<byte[]> result = login("JANE.DOE@EXAMPLE.COM", "correct-horse-battery");

        assertThat(result.getStatus().value()).isEqualTo(200);
        assertThat(bodyOf(result)).contains("\"email\":\"jane.doe@example.com\"");
    }

    @Test
    void validationErrorsReturn400() {
        EntityExchangeResult<byte[]> result = login("not-an-email", "x");

        assertThat(result.getStatus().value()).isEqualTo(400);
        assertThat(bodyOf(result))
            .contains("\"code\":\"VALIDATION_ERROR\"")
            .contains("\"errors\"");
    }

    @Test
    void providedCorrelationIdIsEchoed() {
        register("echo@example.com", "echo.id", "correct-horse-battery");
        String correlationId = UUID.randomUUID().toString();

        EntityExchangeResult<byte[]> result = client.post().uri("/api/v1/auth/login")
            .contentType(MediaType.APPLICATION_JSON)
            .header(CorrelationIdFilter.HEADER, correlationId)
            .body(Map.of("email", "echo@example.com", "password", "correct-horse-battery"))
            .exchange()
            .returnResult(byte[].class);

        assertThat(result.getStatus().value()).isEqualTo(200);
        assertThat(result.getResponseHeaders().getFirst(CorrelationIdFilter.HEADER)).isEqualTo(correlationId);
    }

    private void verifyJwt(String body) throws ParseException, com.nimbusds.jose.JOSEException {
        String token = com.jayway.jsonpath.JsonPath.read(body, "$.accessToken");
        SignedJWT signed = SignedJWT.parse(token);
        assertThat(signed.getHeader().getAlgorithm()).isEqualTo(JWSAlgorithm.RS256);

        JWSVerifier verifier = new RSASSAVerifier(
            com.meterhub.identity.testsupport.JwtTestKeys.publicKey());
        assertThat(signed.verify(verifier)).isTrue();

        JWTClaimsSet claims = signed.getJWTClaimsSet();
        assertThat(claims.getIssuer()).isEqualTo(jwtProperties.issuer());
        assertThat(claims.getAudience()).containsExactly(jwtProperties.audience());
        assertThat(claims.getSubject()).isNotBlank();
        assertThat(claims.getExpirationTime()).isAfter(Instant.now());
        assertThat(claims.getIssueTime()).isNotNull();
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

    private static String bodyOf(EntityExchangeResult<byte[]> result) {
        return new String(result.getResponseBodyContent(), StandardCharsets.UTF_8);
    }
}
