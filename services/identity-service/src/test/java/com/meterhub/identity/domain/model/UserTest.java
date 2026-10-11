package com.meterhub.identity.domain.model;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class UserTest {

    @Test
    void aPlainUserHoldsOnlyTheUserRole() {
        assertThat(userWith(SystemRole.USER).systemRoles()).containsExactly(SystemRole.USER);
    }

    @Test
    void adminIsAdditiveSoEveryAdminIsAlsoAUser() {
        assertThat(List.copyOf(userWith(SystemRole.ADMIN).systemRoles()))
            .containsExactly(SystemRole.USER, SystemRole.ADMIN);
    }

    @Test
    void builderDefaultsToUser() {
        assertThat(User.builder().build().systemRoles()).containsExactly(SystemRole.USER);
    }

    private static User userWith(SystemRole role) {
        return User.builder().role(role).status(AccountStatus.ACTIVE).build();
    }
}
