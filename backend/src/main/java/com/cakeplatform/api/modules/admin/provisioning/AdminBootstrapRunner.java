package com.cakeplatform.api.modules.admin.provisioning;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "app.admin.bootstrap.enabled", havingValue = "true")
@RequiredArgsConstructor
@Slf4j
public class AdminBootstrapRunner implements ApplicationRunner {

    private final AdminProvisioningService provisioningService;

    @Value("${app.admin.bootstrap.email:${APP_ADMIN_BOOTSTRAP_EMAIL:${ADMIN_BOOTSTRAP_EMAIL:}}}")
    private String bootstrapEmail;

    @Value("${app.admin.bootstrap.password:${APP_ADMIN_BOOTSTRAP_PASSWORD:${ADMIN_BOOTSTRAP_PASSWORD:}}}")
    private String bootstrapPassword;

    @Value("${app.admin.bootstrap.full-name:${APP_ADMIN_BOOTSTRAP_FULL_NAME:${ADMIN_BOOTSTRAP_FULL_NAME:System Administrator}}}")
    private String bootstrapFullName;

    @Value("${app.admin.bootstrap.mobile:${APP_ADMIN_BOOTSTRAP_MOBILE:${ADMIN_BOOTSTRAP_MOBILE:}}}")
    private String bootstrapMobile;

    @Value("${app.admin.bootstrap.exit-on-completion:${APP_ADMIN_BOOTSTRAP_EXIT_ON_COMPLETION:false}}")
    private boolean exitOnCompletion;

    @Override
    public void run(ApplicationArguments args) {
        log.info("[ADMIN_BOOTSTRAP] Secure admin provisioning runner invoked.");

        AdminProvisioningRequest request = AdminProvisioningRequest.builder()
                .email(bootstrapEmail)
                .password(bootstrapPassword)
                .fullName(bootstrapFullName)
                .mobile(bootstrapMobile)
                .build();

        try {
            AdminProvisioningResult result = provisioningService.provisionInitialAdmin(request);
            log.info("[ADMIN_BOOTSTRAP] {}", result.getMessage());
        } catch (Exception ex) {
            log.error("[ADMIN_BOOTSTRAP] Admin provisioning failed: {}", ex.getMessage());
            if (exitOnCompletion) {
                System.exit(1);
            }
            throw ex;
        }

        if (exitOnCompletion) {
            log.info("[ADMIN_BOOTSTRAP] Execution complete. Exiting JVM as requested (exit-on-completion=true).");
            System.exit(0);
        }
    }
}

