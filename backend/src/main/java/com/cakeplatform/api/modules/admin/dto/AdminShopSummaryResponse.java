package com.cakeplatform.api.modules.admin.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class AdminShopSummaryResponse {
    private Long shopId;
    private String businessName;
    private String ownerName;
    private String ownerEmail;
    private String shopStatus;
    private LocalDateTime registeredAt;
    private String subscriptionStatus;
    private Boolean isOwnerEnabled;
    private Boolean isMarketplaceRestricted;
}
