package com.cakeplatform.api.modules.storefront.dto;

public interface ShopSummaryProjection {
    Long getId();
    String getBusinessName();
    String getDescription();
    String getBusinessType();
    String getBusinessCategory();
    String getLogoUrl();
    String getCoverImageUrl();
    String getAddress();
    String getAddressLine1();
    String getAddressLine2();
    String getArea();
    String getCity();
    String getDistrict();
    String getState();
    String getPincode();
    Double getLatitude();
    Double getLongitude();
    String getStatus();
    String getVerificationStatus();
    Double getAvgRating();
    Long getTotalReviews();
    Double getDistanceKm();
    Boolean getHideStreetAddress();
}

