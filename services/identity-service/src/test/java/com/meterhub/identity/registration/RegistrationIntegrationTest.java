package com.meterhub.identity.registration;

import com.meterhub.identity.adapters.inbound.web.CorrelationIdFilter;
import com.meterhub.identity.jooq.tables.records.UsersRecord;
import com.meterhub.identity.testsupport.IdentityIntegrationTest;
import org.jooq.DSLContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.client.EntityExchangeResult;
import org.springframework.test.web.servlet.client.RestTestClient;

import java.nio.charset.StandardCharsets;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for POST /api/v1/auth/register (task 2.3).
 * Runs against the local PostgreSQL instance started by Docker Compose.
 */
@IdentityIntegrationTest
class RegistrationIntegrationTest {

    @LocalServerPort
    private int port;

    @Autowired
    private DSLContext dsl;

    @Autowired
    private PasswordEncoder passwordEncoder;

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
    void registersUserAndReturns201WithUserBody() {
        EntityExchangeResult<byte[]> result = register("jane.doe@example.com", "jane.doe", "correct-horse-battery");

        assertThat(result.getStatus().value()).isEqualTo(201);
        assertThat(result.getResponseHeaders().getFirst(CorrelationIdFilter.HEADER)).isNotBlank();
        assertThat(bodyOf(result))
            .contains("\"email\":\"jane.doe@example.com\"")
            .contains("\"username\":\"jane.doe\"")
            .contains("\"status\":\"ACTIVE\"")
            .contains("\"createdAt\"")
            .doesNotContain("password")
            .doesNotContain("passwordHash");

        // Persisted with a hashed password, not the plain text
        UsersRecord record = dsl.selectFrom(com.meterhub.identity.jooq.tables.Users.USERS)
            .where(com.meterhub.identity.jooq.tables.Users.USERS.USERNAME.eq("jane.doe"))
            .fetchOne();
        assertThat(record).isNotNull();
        // Argon2id digest in PHC string format, never the plain text
        assertThat(record.getPasswordHash())
            .isNotEqualTo("correct-horse-battery")
            .contains("$argon2id$");
        assertThat(passwordEncoder.matches("correct-horse-battery", record.getPasswordHash())).isTrue();
        assertThat(passwordEncoder.matches("wrong-password", record.getPasswordHash())).isFalse();
    }

    @Test
    void duplicateEmailIsCaseInsensitiveConflict() {
        register("jane.doe@example.com", "first.user");
        EntityExchangeResult<byte[]> result = register("JANE.DOE@EXAMPLE.COM", "second.user");

        assertThat(result.getStatus().value()).isEqualTo(409);
        assertThat(bodyOf(result))
            .contains("\"code\":\"EMAIL_ALREADY_EXISTS\"")
            .contains("\"correlationId\"");
    }

    @Test
    void duplicateUsernameIsConflict() {
        register("first@example.com", "taken.name");
        EntityExchangeResult<byte[]> result = register("second@example.com", "taken.name");

        assertThat(result.getStatus().value()).isEqualTo(409);
        assertThat(bodyOf(result)).contains("\"code\":\"USERNAME_ALREADY_EXISTS\"");
    }

    @Test
    void validationErrorsReturn400WithFieldDetails() {
        EntityExchangeResult<byte[]> result = register("not-an-email", "x", "short");

        assertThat(result.getStatus().value()).isEqualTo(400);
        assertThat(bodyOf(result))
            .contains("\"code\":\"VALIDATION_ERROR\"")
            .contains("\"errors\"")
            .contains("\"field\":\"email\"")
            .contains("\"field\":\"username\"")
            .contains("\"field\":\"password\"");
    }

    @Test
    void missingCorrelationIdIsGenerated() {
        EntityExchangeResult<byte[]> result = register("noid@example.com", "no.id", "correct-horse-battery");

        assertThat(result.getResponseHeaders().getFirst(CorrelationIdFilter.HEADER)).isNotBlank();
    }

    @Test
    void providedCorrelationIdIsEchoed() {
        EntityExchangeResult<byte[]> result = client.post().uri("/api/v1/auth/register")
            .contentType(MediaType.APPLICATION_JSON)
            .header(CorrelationIdFilter.HEADER, "123e4567-e89b-42d3-a456-426614174000")
            .body(Map.of(
                "email", "echo@example.com",
                "username", "echo.id",
                "password", "correct-horse-battery"
            ))
            .exchange()
            .returnResult(byte[].class);

        assertThat(result.getStatus().value()).isEqualTo(201);
        assertThat(bodyOf(result)).contains("\"email\":\"echo@example.com\"");
        assertThat(result.getResponseHeaders().getFirst(CorrelationIdFilter.HEADER))
            .isEqualTo("123e4567-e89b-42d3-a456-426614174000");
    }

    private EntityExchangeResult<byte[]> register(String email, String username) {
        return register(email, username, "correct-horse-battery");
    }

    private EntityExchangeResult<byte[]> register(String email, String username, String password) {
        return client.post().uri("/api/v1/auth/register")
            .contentType(MediaType.APPLICATION_JSON)
            .body(Map.of("email", email, "username", username, "password", password))
            .exchange()
            .returnResult(byte[].class);
    }

    private static String bodyOf(EntityExchangeResult<byte[]> result) {
        return new String(result.getResponseBodyContent(), StandardCharsets.UTF_8);
    }
}
