package com.cakeplatform.api.modules.shop.dto;

import com.cakeplatform.api.modules.shop.ShopStatus;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class ShopResponse {
    private Long id;
    private String businessName;
    private String description;
    private String phone;
    private String email;
    private String address;
    private String city;
    private String state;
    private String pincode;
    private String addressLine1;
    private String addressLine2;
    private String area;
    private String district;
    private Double latitude;
    private Double longitude;

    private String businessCategory;
    private String businessType;
    private Integer yearsInBusiness;
    private String fssaiRegistration;

    private String logoUrl;
    private String coverImageUrl;

    private String aboutStory;
    private String aboutImageUrl;
    private Boolean showAboutImage;
    private String whatsappNumber;
    private String mapLocationUrl;

    private ShopStatus status;
    private String verificationStatus;
    private Boolean isOwnerEnabled;
    private Boolean isMarketplaceRestricted;
    private String marketplaceRestrictionReason;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
