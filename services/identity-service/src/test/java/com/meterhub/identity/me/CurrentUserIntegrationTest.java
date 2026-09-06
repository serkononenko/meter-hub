package com.meterhub.identity.me;

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

import java.nio.charset.StandardCharsets;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for GET /api/v1/users/me (task 2.6).
 */
@IdentityIntegrationTest
class CurrentUserIntegrationTest {

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
    void returnsAuthenticatedUser() {
        register("jane.doe@example.com", "jane.doe", "correct-horse-battery");
        String loginBody = bodyOf(login("jane.doe@example.com", "correct-horse-battery"));
        String accessToken = JsonPath.read(loginBody, "$.accessToken");

        EntityExchangeResult<byte[]> result = me(accessToken);

        assertThat(result.getStatus().value()).isEqualTo(200);
        assertThat(result.getResponseHeaders().getFirst(CorrelationIdFilter.HEADER)).isNotBlank();
        assertThat(bodyOf(result))
            .contains("\"email\":\"jane.doe@example.com\"")
            .contains("\"username\":\"jane.doe\"")
            .contains("\"status\":\"ACTIVE\"")
            .contains("\"id\":\"" + JsonPath.read(loginBody, "$.user.id") + "\"")
            .doesNotContain("\"password\"");
    }

    @Test
    void missingTokenReturnsUnauthorizedProblem() {
        EntityExchangeResult<byte[]> result = client.get().uri("/api/v1/users/me")
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

    private static String wronglySignedToken() {
        // A structurally valid JWT signed with a key that is not ours
        return "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJlNGMzYTFmNy0zYTExLTQxYTQtOGI0MS04NzQ3ZDA3Njk4NDUifQ"
            + ".c2lnbmF0dXJlLXdpdGgtd3Jvbmcta2V5";
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

    private EntityExchangeResult<byte[]> me(String accessToken) {
        return client.get().uri("/api/v1/users/me")
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
