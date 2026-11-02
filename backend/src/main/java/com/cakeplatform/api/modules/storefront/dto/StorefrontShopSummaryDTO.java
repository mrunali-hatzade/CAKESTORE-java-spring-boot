package com.cakeplatform.api.modules.storefront.dto;

import com.cakeplatform.api.modules.shop.BusinessType;
import com.cakeplatform.api.modules.shop.VerificationStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StorefrontShopSummaryDTO {
    private Long id;
    private String businessName;
    private String description;
    private BusinessType businessType;
    private String businessCategory;
    private String logoUrl;
    private String coverImageUrl;
    private String address;
    private String addressLine1;
    private String addressLine2;
    private String area;
    private String city;
    private String district;
    private String state;
    private String pincode;
    private String country;
    private Double latitude;
    private Double longitude;
    private Double distanceKm;
    private String status;
    private VerificationStatus verificationStatus;
    private Double averageRating;
    private Long totalReviews;
    private Boolean isPureVeg;
    private Boolean isOpenNow;
    private String openStatusText;
    private String timezone;
}
