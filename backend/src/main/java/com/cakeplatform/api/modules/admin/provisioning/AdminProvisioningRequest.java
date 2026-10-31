package com.cakeplatform.api.modules.admin.provisioning;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminProvisioningRequest {
    private String email;
    private String password;
    private String fullName;
    private String mobile;
}

