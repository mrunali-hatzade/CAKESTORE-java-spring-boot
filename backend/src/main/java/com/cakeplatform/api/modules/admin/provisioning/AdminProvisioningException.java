package com.cakeplatform.api.modules.admin.provisioning;

import lombok.Getter;

@Getter
public class AdminProvisioningException extends RuntimeException {

    private final AdminProvisioningResult.Status status;

    public AdminProvisioningException(AdminProvisioningResult.Status status, String message) {
        super(message);
        this.status = status;
    }
}

