package com.meterhub.household.testsupport;

import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;

/**
 * Supplies the RS256 verification key as environment properties so the real
 * {@code JwtConfig} bean wiring runs unchanged in tests. Referenced from
 * {@link HouseholdIntegrationTest}.
 */
public class JwtKeysContextInitializer implements ApplicationContextInitializer<ConfigurableApplicationContext> {

    @Override
    public void initialize(ConfigurableApplicationContext applicationContext) {
        applicationContext.getEnvironment().getPropertySources()
            .addFirst(JwtTestKeys.propertySource());
    }
}
