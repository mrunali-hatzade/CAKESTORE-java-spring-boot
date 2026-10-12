package com.cakeplatform.api.modules.storefront.dto;

import com.cakeplatform.api.modules.shop.BusinessType;
import com.cakeplatform.api.modules.shop.ShopBanner;
import com.cakeplatform.api.modules.shop.ShopBusinessHours;
import com.cakeplatform.api.modules.shop.ShopCustomFormField;
import com.cakeplatform.api.modules.shop.ShopDeliveryConfig;
import com.cakeplatform.api.modules.shop.ShopStorefrontSettings;
import lombok.Data;

import java.util.List;

@Data
public class StorefrontShopResponse {
    private Long id;
    private String businessName;
    private String description;
    private String businessCategory;
    private BusinessType businessType;
    private String logoUrl;
    private String coverImageUrl;
    private String phone;
    private String email;
    private String address;
    private String addressLine1;
    private String addressLine2;
    private String area;
    private String city;
    private String district;
    private String state;
    private String pincode;
    private Double latitude;
    private Double longitude;
    private String status;
    private Integer yearsInBusiness;
    private String fssaiRegistration;
    private String verificationStatus;
    private String inactiveReason;

    // About & Social
    private String aboutStory;
    private String aboutImageUrl;
    private Boolean showAboutImage;
    private String whatsappNumber;
    private String mapLocationUrl;

    // Review Summary
    private Double averageRating;
    private Long totalReviews;

    // Storefront Configuration & Components
    private List<ShopBanner> banners;
    private List<ShopBusinessHours> businessHours;
    private ShopDeliveryConfig deliveryConfig;
    private ShopStorefrontSettings storefrontSettings;
    private List<ShopCustomFormField> customCakeFormFields;
    private List<com.cakeplatform.api.modules.shop.dto.ShopSocialLinkResponse> socialLinks;
}

