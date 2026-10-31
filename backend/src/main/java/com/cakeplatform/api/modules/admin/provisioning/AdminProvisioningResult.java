package com.cakeplatform.api.modules.admin.provisioning;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminProvisioningResult {

    public enum Status {
        SUCCESS,
        REFUSED_ADMIN_EXISTS,
        REFUSED_DUPLICATE_EMAIL,
        REFUSED_DUPLICATE_MOBILE,
        REFUSED_INVALID_CONFIG,
        REFUSED_WEAK_PASSWORD,
        /**
         * Raised when the database advisory lock cannot be acquired (PostgreSQL)
         * or when the database dialect is unknown and provisioning must be aborted
         * to prevent a fall-through to JVM-only locking in production.
         */
        REFUSED_DATABASE_LOCK
    }

    private Status status;
    private Long adminUserId;
    private String email;
    private String message;
}

