package com.meterhub.identity.ports.outbound;

import com.meterhub.identity.domain.model.User;

import com.meterhub.identity.domain.model.SystemRole;

import java.util.Optional;
import java.util.Set;
import java.util.UUID;

public interface UserRepository {
    User save(User user);

    Optional<User> findById(UUID id);

    Optional<User> findByEmail(String email);

    Optional<User> findByUsername(String username);

    Set<UUID> findIdsByRole(SystemRole role);

    boolean updateRole(UUID userId, SystemRole role);
}
