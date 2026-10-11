package com.meterhub.identity.application.service;

import com.meterhub.identity.config.AdminProperties;
import com.meterhub.identity.domain.model.SystemRole;
import com.meterhub.identity.ports.outbound.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/** The declared admin list is the source of truth: listed users become ADMIN, every other ADMIN is demoted. */
@Service
public class AdminReconciliationService {

    private static final Logger log = LoggerFactory.getLogger(AdminReconciliationService.class);

    private final UserRepository userRepository;
    private final AdminProperties properties;

    public AdminReconciliationService(UserRepository userRepository, AdminProperties properties) {
        this.userRepository = userRepository;
        this.properties = properties;
    }

    @Transactional
    public Result reconcile() {
        Set<UUID> declared = new HashSet<>(properties.userIds());
        Set<UUID> promoted = new HashSet<>();
        Set<UUID> demoted = new HashSet<>();
        Set<UUID> unknown = new HashSet<>();

        Set<UUID> currentAdmins = userRepository.findIdsByRole(SystemRole.ADMIN);

        for (UUID id : declared) {
            if (currentAdmins.contains(id)) {
                continue;
            }
            if (userRepository.updateRole(id, SystemRole.ADMIN)) {
                promoted.add(id);
                log.info("Promoted user {} to ADMIN (listed in IDENTITY_ADMIN_USER_IDS)", id);
            } else {
                unknown.add(id);
                log.warn("IDENTITY_ADMIN_USER_IDS lists {} but no such user exists; ignoring", id);
            }
        }
        for (UUID id : currentAdmins) {
            if (!declared.contains(id) && userRepository.updateRole(id, SystemRole.USER)) {
                demoted.add(id);
                log.info("Demoted user {} to USER (no longer listed in IDENTITY_ADMIN_USER_IDS)", id);
            }
        }
        return new Result(promoted, demoted, unknown);
    }

    public record Result(Set<UUID> promoted, Set<UUID> demoted, Set<UUID> unknown) {
    }
}
