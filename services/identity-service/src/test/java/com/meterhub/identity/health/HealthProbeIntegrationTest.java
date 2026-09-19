package com.meterhub.identity.health;

import com.meterhub.identity.testsupport.IdentityIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.web.servlet.client.RestTestClient;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for the health probes (task 10.2, conventions §13):
 * liveness and readiness are separate concerns and must not need a token.
 */
@IdentityIntegrationTest
class HealthProbeIntegrationTest {

    @LocalServerPort
    private int port;

    private RestTestClient client;

    @BeforeEach
    void setUp() {
        client = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
    }

    @Test
    void livenessAnswersUpWithoutTokenOrDatabase() {
        byte[] body = client.get().uri("/actuator/health/liveness")
            .exchange()
            .expectStatus().isEqualTo(200)
            .expectBody()
            .returnResult()
            .getResponseBody();

        assertThat(new String(body)).contains("\"status\":\"UP\"");
    }

    @Test
    void readinessAnswersUpWhenTheDatabaseIsReachable() {
        byte[] body = client.get().uri("/actuator/health/readiness")
            .exchange()
            .expectStatus().isEqualTo(200)
            .expectBody()
            .returnResult()
            .getResponseBody();

        // The test context runs against the real local PostgreSQL
        assertThat(new String(body)).contains("\"status\":\"UP\"");
    }

    @Test
    void aggregateHealthIsReachableWithoutToken() {
        client.get().uri("/actuator/health")
            .exchange()
            .expectStatus().isEqualTo(200);
    }
}
