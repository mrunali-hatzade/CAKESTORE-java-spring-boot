package com.cakeplatform.api.modules.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class AuthResponse {
    private Long id;
    private Long shopId;
    private String token;
    private String email;
    private String role;
    private String fullName;
    private String shopStatus; // To handle PENDING shop logins
    private String subscriptionStatus;
}
