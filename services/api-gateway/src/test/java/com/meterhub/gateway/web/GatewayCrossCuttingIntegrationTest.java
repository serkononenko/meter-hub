package com.meterhub.gateway.web;

import com.meterhub.gateway.testsupport.GatewayIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.servlet.client.EntityExchangeResult;
import org.springframework.test.web.servlet.client.RestTestClient;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for the gateway cross-cutting concerns (task 3.4):
 * correlation IDs, CORS and the access log. Downstream services are down in
 * these tests, so authenticated requests surface as 5xx after the security
 * layer — that is expected and not what these tests assert on.
 */
@GatewayIntegrationTest
class GatewayCrossCuttingIntegrationTest {

    @LocalServerPort
    private int port;

    private RestTestClient client;

    @BeforeEach
    void setUp() {
        client = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
    }

    @Test
    void correlationIdIsGeneratedAndEchoed() {
        EntityExchangeResult<byte[]> result = client.get().uri("/actuator/health")
            .exchange()
            .returnResult(byte[].class);

        String echoed = result.getResponseHeaders().getFirst(CorrelationIdFilter.HEADER);
        assertThat(echoed).isNotNull();
        assertThat(UUID.fromString(echoed)).isNotNull(); // parseable UUID
    }

    @Test
    void clientSuppliedCorrelationIdIsPropagated() {
        UUID supplied = UUID.randomUUID();

        EntityExchangeResult<byte[]> result = client.get().uri("/actuator/health")
            .header(CorrelationIdFilter.HEADER, supplied.toString())
            .exchange()
            .returnResult(byte[].class);

        assertThat(result.getResponseHeaders().getFirst(CorrelationIdFilter.HEADER))
            .isEqualTo(supplied.toString());
    }

    @Test
    void malformedClientCorrelationIdIsReplacedWithGenerated() {
        EntityExchangeResult<byte[]> result = client.get().uri("/actuator/health")
            .header(CorrelationIdFilter.HEADER, "not-a-uuid")
            .exchange()
            .returnResult(byte[].class);

        String echoed = result.getResponseHeaders().getFirst(CorrelationIdFilter.HEADER);
        assertThat(echoed).isNotEqualTo("not-a-uuid");
        assertThat(UUID.fromString(echoed)).isNotNull();
    }

    @Test
    void unauthorizedProblemCarriesTheRequestsCorrelationId() {
        UUID supplied = UUID.randomUUID();

        EntityExchangeResult<byte[]> result = client.get().uri("/api/v1/users/me")
            .header(CorrelationIdFilter.HEADER, supplied.toString())
            .exchange()
            .returnResult(byte[].class);

        assertThat(result.getStatus().value()).isEqualTo(401);
        assertThat(new String(result.getResponseBodyContent(), StandardCharsets.UTF_8))
            .contains("\"correlationId\":\"" + supplied + "\"");
    }

    @Test
    void corsPreflightForAllowedOriginIsAccepted() {
        EntityExchangeResult<byte[]> result = client.options().uri("/api/v1/auth/login")
            .header(HttpHeaders.ORIGIN, "http://localhost:3000")
            .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, HttpMethod.POST.name())
            .exchange()
            .returnResult(byte[].class);

        assertThat(result.getStatus().value()).isEqualTo(200);
        HttpHeaders headers = result.getResponseHeaders();
        assertThat(headers.getAccessControlAllowOrigin()).isEqualTo("http://localhost:3000");
        assertThat(headers.getAccessControlAllowMethods()).contains(HttpMethod.POST);
        assertThat(headers.getFirst(CorrelationIdFilter.HEADER)).isNotNull();
    }

    @Test
    void corsPreflightForDisallowedOriginIsRejected() {
        EntityExchangeResult<byte[]> result = client.options().uri("/api/v1/auth/login")
            .header(HttpHeaders.ORIGIN, "https://evil.example.com")
            .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, HttpMethod.POST.name())
            .exchange()
            .returnResult(byte[].class);

        assertThat(result.getResponseHeaders().getAccessControlAllowOrigin()).isNull();
    }

    @Test
    void actualResponseExposesCorrelationIdHeaderToBrowserClients() {
        EntityExchangeResult<byte[]> result = client.get().uri("/actuator/health")
            .header(HttpHeaders.ORIGIN, "http://localhost:3000")
            .exchange()
            .returnResult(byte[].class);

        assertThat(result.getStatus().value()).isEqualTo(200);
        // Exposed via Access-Control-Expose-Headers so the web client can read it
        assertThat(result.getResponseHeaders().getAccessControlExposeHeaders())
            .contains(CorrelationIdFilter.HEADER);
    }
}
