package com.meterhub.gateway.auth;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Wires the access-token revocation cache: binds
 * {@link RevocationCacheProperties} and turns on the poll schedule.
 */
@Configuration
@EnableScheduling
@EnableConfigurationProperties(RevocationCacheProperties.class)
public class RevocationConfig {
}
