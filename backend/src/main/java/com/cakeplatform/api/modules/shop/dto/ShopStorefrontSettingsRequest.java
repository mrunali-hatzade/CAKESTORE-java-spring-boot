package com.cakeplatform.api.modules.shop.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ShopStorefrontSettingsRequest {
    @NotNull
    private Boolean heroBannerEnabled;
    @NotNull
    private Boolean topRatedEnabled;
    @NotNull
    private Boolean reviewsEnabled;
    @NotNull
    private Boolean bakeryInfoEnabled;
    @NotNull
    private Boolean categoriesEnabled;
    @NotNull
    private Boolean filtersEnabled;
    @NotNull
    private Boolean ratingsEnabled;
    @NotNull
    private Boolean aboutStoryEnabled;
    @NotNull
    private Boolean aboutImageEnabled;
    @NotNull
    private Boolean fulfillmentEnabled;
    @NotNull
    private Integer leadTimeDays;
    private String leadTimeMessage;
    @NotNull
    private Boolean customCakesEnabled;
    private Boolean ccFieldOccasionEnabled;
    private Boolean ccFieldFlavourEnabled;
    private Boolean ccFieldServingsEnabled;
    private Boolean ccFieldDateEnabled;
    private Boolean ccFieldBudgetEnabled;
    private Boolean ccFieldDeliveryEnabled;
    private Boolean ccFieldDesignEnabled;
    private Boolean ccFieldReferenceEnabled;
    @NotNull
    private Boolean whatsappEnabled;
    @NotNull
    private Boolean phoneEnabled;
    @NotNull
    private Boolean emailEnabled;
    @NotNull
    private Boolean addressEnabled;
    @NotNull
    private Boolean mapEnabled;
    @NotNull
    private Boolean businessHoursEnabled;
    private Boolean hideStreetAddress;
}

