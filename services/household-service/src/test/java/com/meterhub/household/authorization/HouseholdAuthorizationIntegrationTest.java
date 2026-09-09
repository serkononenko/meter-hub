package com.meterhub.household.authorization;

import com.jayway.jsonpath.JsonPath;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.KeyUse;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import com.meterhub.household.jooq.tables.HouseholdMembers;
import com.meterhub.household.jooq.tables.Households;
import com.meterhub.household.testsupport.HouseholdIntegrationTest;
import com.meterhub.household.testsupport.JwtTestKeys;
import org.jooq.DSLContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.MediaType;
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
 * Integration tests for household authorization (task 4.4): identity is taken
 * from the JWT subject, queries are restricted to the authenticated user, and
 * unauthenticated or invalid-token callers are rejected.
 */
@HouseholdIntegrationTest
class HouseholdAuthorizationIntegrationTest {

    private static final String ALICE_EMAIL_SUBJECT = "11111111-1111-4111-8111-111111111111";
    private static final String BOB_SUBJECT = "22222222-2222-4222-8222-222222222222";

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
        dsl.deleteFrom(HouseholdMembers.HOUSEHOLD_MEMBERS).execute();
        dsl.deleteFrom(Households.HOUSEHOLDS).execute();
    }

    @Test
    void createdHouseholdIsOwnedByTheTokenSubject() {
        String accessToken = tokenFor(ALICE_EMAIL_SUBJECT);

        EntityExchangeResult<byte[]> created = postHouseholds(accessToken, "Family home");

        assertThat(created.getStatus().value()).isEqualTo(201);
        assertThat(bodyOf(created))
            .contains("\"name\":\"Family home\"")
            .contains("\"id\":\"");
        // The owner is the token subject, not anything client-supplied
        UUID householdId = UUID.fromString(JsonPath.read(bodyOf(created), "$.id"));
        assertThat(countHouseholdsOwnedBy(ALICE_EMAIL_SUBJECT)).isEqualTo(1);
        assertThat(countHouseholdsOwnedBy(BOB_SUBJECT)).isEqualTo(0);
    }

    @Test
    void listReturnsOnlyTheCallersOwnHouseholds() {
        String aliceToken = tokenFor(ALICE_EMAIL_SUBJECT);
        String bobToken = tokenFor(BOB_SUBJECT);
        postHouseholds(aliceToken, "Alice home");
        postHouseholds(bobToken, "Bob home");

        EntityExchangeResult<byte[]> aliceList = getHouseholds(aliceToken);
        EntityExchangeResult<byte[]> bobList = getHouseholds(bobToken);

        assertThat(aliceList.getStatus().value()).isEqualTo(200);
        List<String> aliceNames = JsonPath.read(bodyOf(aliceList), "$[*].name");
        assertThat(aliceNames).containsExactly("Alice home");
        List<String> bobNames = JsonPath.read(bodyOf(bobList), "$[*].name");
        assertThat(bobNames).containsExactly("Bob home");
    }

    @Test
    void getReturnsAnotherUsersHouseholdAsNotFound() {
        String aliceToken = tokenFor(ALICE_EMAIL_SUBJECT);
        String bobToken = tokenFor(BOB_SUBJECT);
        UUID aliceHouseholdId = createdHouseholdId(aliceToken, "Alice secret home");

        EntityExchangeResult<byte[]> bobView = getHousehold(bobToken, aliceHouseholdId);

        // Enumeration protection: same 404 as a household that does not exist at all
        assertThat(bobView.getStatus().value()).isEqualTo(404);
        assertThat(bodyOf(bobView))
            .contains("\"code\":\"HOUSEHOLD_NOT_FOUND\"")
            .contains("\"title\":\"Household not found\"")
            .contains("\"detail\":\"No household with this identifier is visible to the authenticated user.\"");
        assertThat(withoutRequestFingerprints(bodyOf(bobView)))
            .isEqualTo(withoutRequestFingerprints(bodyOf(getHousehold(bobToken, UUID.randomUUID()))));
    }

    @Test
    void ownerCanReadTheirOwnHousehold() {
        String aliceToken = tokenFor(ALICE_EMAIL_SUBJECT);
        UUID householdId = createdHouseholdId(aliceToken, "Alice home");

        EntityExchangeResult<byte[]> result = getHousehold(aliceToken, householdId);

        assertThat(result.getStatus().value()).isEqualTo(200);
        assertThat(bodyOf(result))
            .contains("\"id\":\"" + householdId + "\"")
            .contains("\"name\":\"Alice home\"");
    }

    @Test
    void missingTokenReturnsUnauthorizedProblem() {
        EntityExchangeResult<byte[]> created = client.post().uri("/api/v1/households")
            .contentType(MediaType.APPLICATION_JSON)
            .body(Map.of("name", "No token home"))
            .exchange()
            .returnResult(byte[].class);
        EntityExchangeResult<byte[]> listed = client.get().uri("/api/v1/households")
            .exchange()
            .returnResult(byte[].class);
        EntityExchangeResult<byte[]> fetched = client.get().uri("/api/v1/households/{id}", UUID.randomUUID())
            .exchange()
            .returnResult(byte[].class);

        assertThat(created.getStatus().value()).isEqualTo(401);
        assertThat(listed.getStatus().value()).isEqualTo(401);
        assertThat(fetched.getStatus().value()).isEqualTo(401);
        assertThat(bodyOf(created))
            .contains("\"code\":\"UNAUTHORIZED\"")
            .contains("\"title\":\"Authentication required\"")
            .contains("\"detail\":\"A valid Bearer access token is required.\"");
        assertThat(created.getResponseHeaders().getFirst("WWW-Authenticate")).isEqualTo("Bearer");
        assertThat(countHouseholdsOwnedBy(ALICE_EMAIL_SUBJECT)).isZero();
    }

    @Test
    void invalidAndGarbageTokensReturnInvalidTokenProblem() {
        EntityExchangeResult<byte[]> garbage = postHouseholds(anyToken("not-a-jwt"), "Garbage token home");
        EntityExchangeResult<byte[]> signedByWrongKey = postHouseholds(anyToken(wronglySignedToken()), "Wrong key home");

        assertThat(garbage.getStatus().value()).isEqualTo(401);
        assertThat(signedByWrongKey.getStatus().value()).isEqualTo(401);
        assertThat(bodyOf(garbage))
            .contains("\"code\":\"INVALID_TOKEN\"")
            .contains("\"title\":\"Invalid access token\"")
            .contains("\"detail\":\"The access token is invalid or expired.\"");
        // Enumeration protection: identical problem bodies apart from the per-request correlation id
        assertThat(withoutCorrelationId(bodyOf(garbage)))
            .isEqualTo(withoutCorrelationId(bodyOf(signedByWrongKey)));
        assertThat(countHouseholdsOwnedBy(ALICE_EMAIL_SUBJECT)).isZero();
    }

    @Test
    void expiredAccessTokenReturnsInvalidTokenProblem() {
        Instant now = Instant.now();
        String expired = signedToken(
            ALICE_EMAIL_SUBJECT,
            "identity-service",
            List.of("meterhub-api"),
            now.minusSeconds(3600),
            now.minusSeconds(1800)
        );

        EntityExchangeResult<byte[]> result = postHouseholds(expired, "Expired token home");

        assertThat(result.getStatus().value()).isEqualTo(401);
        assertThat(bodyOf(result)).contains("\"code\":\"INVALID_TOKEN\"");
        assertThat(withoutCorrelationId(bodyOf(result)))
            .isEqualTo(withoutCorrelationId(bodyOf(postHouseholds(anyToken(wronglySignedToken()), "Wrong key home"))));
        assertThat(countHouseholdsOwnedBy(ALICE_EMAIL_SUBJECT)).isZero();
    }

    @Test
    void wrongIssuerOrAudienceReturnsInvalidTokenProblem() {
        Instant now = Instant.now();
        String wrongIssuer = signedToken(
            ALICE_EMAIL_SUBJECT, "some-other-service", List.of("meterhub-api"), now, now.plusSeconds(300));
        String wrongAudience = signedToken(
            ALICE_EMAIL_SUBJECT, "identity-service", List.of("some-other-audience"), now, now.plusSeconds(300));

        EntityExchangeResult<byte[]> issuerResult = postHouseholds(wrongIssuer, "Wrong issuer home");
        EntityExchangeResult<byte[]> audienceResult = postHouseholds(wrongAudience, "Wrong audience home");

        assertThat(issuerResult.getStatus().value()).isEqualTo(401);
        assertThat(audienceResult.getStatus().value()).isEqualTo(401);
        assertThat(bodyOf(issuerResult)).contains("\"code\":\"INVALID_TOKEN\"");
        assertThat(bodyOf(audienceResult)).contains("\"code\":\"INVALID_TOKEN\"");
        assertThat(withoutCorrelationId(bodyOf(issuerResult)))
            .isEqualTo(withoutCorrelationId(bodyOf(postHouseholds(anyToken(wronglySignedToken()), "Wrong key home"))));
        assertThat(countHouseholdsOwnedBy(ALICE_EMAIL_SUBJECT)).isZero();
    }

    // --- helpers ---

    private String tokenFor(String subject) {
        Instant now = Instant.now();
        return signedToken(subject, "identity-service", List.of("meterhub-api"), now, now.plusSeconds(300));
    }

    /**
     * Signs a JWT with the very key the service accepts and arbitrary claims,
     * so tests can violate one claim at a time (issuer, audience, expiry).
     */
    private String signedToken(String subject, String issuer, List<String> audience, Instant issuedAt, Instant expiresAt) {
        JwtClaimsSet claims = JwtClaimsSet.builder()
            .issuer(issuer)
            .subject(subject)
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

    /** Any syntactically different bearer value, to vary the invalid-token probe. */
    private static String anyToken(String value) {
        return value;
    }

    private EntityExchangeResult<byte[]> postHouseholds(String accessToken, String name) {
        return client.post().uri("/api/v1/households")
            .headers(headers -> headers.setBearerAuth(accessToken))
            .contentType(MediaType.APPLICATION_JSON)
            .body(Map.of("name", name))
            .exchange()
            .returnResult(byte[].class);
    }

    private EntityExchangeResult<byte[]> getHouseholds(String accessToken) {
        return client.get().uri("/api/v1/households")
            .headers(headers -> headers.setBearerAuth(accessToken))
            .exchange()
            .returnResult(byte[].class);
    }

    private EntityExchangeResult<byte[]> getHousehold(String accessToken, UUID householdId) {
        return client.get().uri("/api/v1/households/{id}", householdId)
            .headers(headers -> headers.setBearerAuth(accessToken))
            .exchange()
            .returnResult(byte[].class);
    }

    private UUID createdHouseholdId(String accessToken, String name) {
        EntityExchangeResult<byte[]> created = postHouseholds(accessToken, name);
        assertThat(created.getStatus().value()).isEqualTo(201);
        return UUID.fromString(JsonPath.read(bodyOf(created), "$.id"));
    }

    private int countHouseholdsOwnedBy(String ownerUserId) {
        return dsl.fetchCount(
            dsl.selectFrom(Households.HOUSEHOLDS)
                .where(Households.HOUSEHOLDS.OWNER_USER_ID.eq(UUID.fromString(ownerUserId)))
        );
    }

    private static String withoutCorrelationId(String body) {
        return body.replaceAll("\"correlationId\":\"[^\"]*\",?", "");
    }

    /** Two problems are indistinguishable apart from per-request correlation id and instance URI. */
    private static String withoutRequestFingerprints(String body) {
        return withoutCorrelationId(body).replaceAll("\"instance\":\"[^\"]*\"", "\"instance\":\"\"");
    }

    private static String bodyOf(EntityExchangeResult<byte[]> result) {
        return new String(result.getResponseBodyContent(), StandardCharsets.UTF_8);
    }
}
