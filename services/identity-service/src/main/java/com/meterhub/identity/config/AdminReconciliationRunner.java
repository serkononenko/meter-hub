package com.meterhub.identity.config;

import com.meterhub.identity.application.service.AdminReconciliationService;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.stereotype.Component;

@Configuration
@EnableConfigurationProperties(AdminProperties.class)
class AdminConfig {
}

@Component
class AdminReconciliationRunner implements ApplicationRunner {

    private final AdminReconciliationService reconciliation;

    AdminReconciliationRunner(AdminReconciliationService reconciliation) {
        this.reconciliation = reconciliation;
    }

    @Override
    public void run(ApplicationArguments args) {
        reconciliation.reconcile();
    }
}
