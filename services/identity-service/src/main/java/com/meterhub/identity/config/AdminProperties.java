package com.meterhub.identity.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;
import java.util.UUID;

/**
 * Admins are declared by user ID, never by email: registration does not verify
 * email, so an email-based rule would let anyone claim admin by registering
 * that address first. A malformed ID fails binding and therefore startup.
 */
@ConfigurationProperties(prefix = "identity.admin")
public record AdminProperties(List<UUID> userIds) {

    public AdminProperties {
        userIds = userIds == null ? List.of() : List.copyOf(userIds);
    }
}
