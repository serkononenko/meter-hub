package com.meterhub.identity.admin;

import com.meterhub.identity.application.service.AdminReconciliationService;
import com.meterhub.identity.config.AdminProperties;
import com.meterhub.identity.domain.model.SystemRole;
import com.meterhub.identity.jooq.tables.Users;
import com.meterhub.identity.testsupport.IdentityIntegrationTest;
import org.jooq.DSLContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.context.properties.bind.BindException;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.context.properties.source.MapConfigurationPropertySource;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@IdentityIntegrationTest
class AdminReconciliationIntegrationTest {

    @Autowired
    private DSLContext dsl;

    @Autowired
    private com.meterhub.identity.ports.outbound.UserRepository userRepository;

    @AfterEach
    void cleanup() {
        dsl.deleteFrom(Users.USERS).execute();
    }

    @Test
    void promotesListedUsersAndLeavesOthersAlone() {
        UUID boss = insertUser("boss@example.com", "boss", SystemRole.USER);
        UUID other = insertUser("other@example.com", "other", SystemRole.USER);

        var result = serviceFor(boss).reconcile();

        assertThat(result.promoted()).containsExactly(boss);
        assertThat(roleOf(boss)).isEqualTo("ADMIN");
        assertThat(roleOf(other)).isEqualTo("USER");
    }

    @Test
    void demotesAdminsNoLongerListed() {
        UUID stale = insertUser("stale@example.com", "stale", SystemRole.ADMIN);
        UUID kept = insertUser("kept@example.com", "kept", SystemRole.ADMIN);

        var result = serviceFor(kept).reconcile();

        assertThat(result.demoted()).containsExactly(stale);
        assertThat(roleOf(stale)).isEqualTo("USER");
        assertThat(roleOf(kept)).isEqualTo("ADMIN");
    }

    @Test
    void anEmptyListDemotesEveryAdmin() {
        UUID admin = insertUser("a@example.com", "a", SystemRole.ADMIN);

        serviceFor().reconcile();

        assertThat(roleOf(admin)).isEqualTo("USER");
    }

    @Test
    void anUnknownIdIsReportedAndIgnoredNotAnError() {
        UUID real = insertUser("real@example.com", "real", SystemRole.USER);
        UUID ghost = UUID.randomUUID();

        var result = serviceFor(real, ghost).reconcile();

        assertThat(result.unknown()).containsExactly(ghost);
        assertThat(result.promoted()).containsExactly(real);
        assertThat(roleOf(real)).isEqualTo("ADMIN");
    }

    @Test
    void rerunningChangesNothing() {
        UUID boss = insertUser("boss@example.com", "boss", SystemRole.USER);
        var service = serviceFor(boss);
        service.reconcile();

        var second = service.reconcile();

        assertThat(second.promoted()).isEmpty();
        assertThat(second.demoted()).isEmpty();
        assertThat(roleOf(boss)).isEqualTo("ADMIN");
    }

    @Test
    void registeringWithAnAdminsEmailConfersNothing() {
        UUID impostor = insertUser("boss@example.com", "impostor", SystemRole.USER);
        UUID unrelatedAdminId = UUID.randomUUID();

        serviceFor(unrelatedAdminId).reconcile();

        assertThat(roleOf(impostor)).isEqualTo("USER");
    }

    @Test
    void bindsACommaSeparatedListOfUuids() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();

        assertThat(bind(a + "," + b).userIds()).containsExactly(a, b);
        assertThat(bind(a + " , " + b + " ").userIds()).containsExactly(a, b);
    }

    @Test
    void anEmptyOrUnsetValueMeansNoAdmins() {
        assertThat(bind("").userIds()).isEmpty();
        assertThat(new Binder(new MapConfigurationPropertySource(Map.of()))
            .bind("identity.admin", AdminProperties.class)
            .orElse(new AdminProperties(null)).userIds()).isEmpty();
    }

    @Test
    void aMalformedEntryFailsBindingSoStartupFailsLoudly() {
        assertThatThrownBy(() -> bind(UUID.randomUUID() + ",not-a-uuid"))
            .isInstanceOf(BindException.class);
    }

    private AdminReconciliationService serviceFor(UUID... ids) {
        return new AdminReconciliationService(userRepository, new AdminProperties(java.util.List.of(ids)));
    }

    private static AdminProperties bind(String value) {
        return new Binder(new MapConfigurationPropertySource(Map.of("identity.admin.user-ids", value)))
            .bind("identity.admin", AdminProperties.class)
            .get();
    }

    private UUID insertUser(String email, String username, SystemRole role) {
        UUID id = UUID.randomUUID();
        OffsetDateTime now = OffsetDateTime.now();
        dsl.insertInto(Users.USERS)
            .set(Users.USERS.ID, id)
            .set(Users.USERS.EMAIL, email)
            .set(Users.USERS.USERNAME, username)
            .set(Users.USERS.PASSWORD_HASH, "x")
            .set(Users.USERS.STATUS, "ACTIVE")
            .set(Users.USERS.ROLE, role.name())
            .set(Users.USERS.CREATED_AT, now)
            .set(Users.USERS.UPDATED_AT, now)
            .execute();
        return id;
    }

    private String roleOf(UUID id) {
        return dsl.select(Users.USERS.ROLE).from(Users.USERS).where(Users.USERS.ID.eq(id)).fetchOne(Users.USERS.ROLE);
    }
}
