package com.cakeplatform.api.modules.shop;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "shop_storefront_settings")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ShopStorefrontSettings {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shop_id", nullable = false, unique = true)
    private Shop shop;

    @Column(name = "hero_banner_enabled", nullable = false)
    @Builder.Default
    private Boolean heroBannerEnabled = true;

    @Column(name = "top_rated_enabled", nullable = false)
    @Builder.Default
    private Boolean topRatedEnabled = true;

    @Column(name = "reviews_enabled", nullable = false)
    @Builder.Default
    private Boolean reviewsEnabled = true;

    @Column(name = "bakery_info_enabled", nullable = false)
    @Builder.Default
    private Boolean bakeryInfoEnabled = true;

    @Column(name = "categories_enabled", nullable = false)
    @Builder.Default
    private Boolean categoriesEnabled = true;

    @Column(name = "filters_enabled", nullable = false)
    @Builder.Default
    private Boolean filtersEnabled = true;

    @Column(name = "ratings_enabled", nullable = false)
    @Builder.Default
    private Boolean ratingsEnabled = true;

    @Column(name = "about_story_enabled", nullable = false)
    @Builder.Default
    private Boolean aboutStoryEnabled = true;

    @Column(name = "about_image_enabled", nullable = false)
    @Builder.Default
    private Boolean aboutImageEnabled = true;

    @Column(name = "fulfillment_enabled", nullable = false)
    @Builder.Default
    private Boolean fulfillmentEnabled = true;

    @Column(name = "lead_time_days", nullable = false)
    @Builder.Default
    private Integer leadTimeDays = 2;

    @Column(name = "lead_time_message", length = 500)
    @Builder.Default
    private String leadTimeMessage = "Orders require 2 days advance booking.";

    @Column(name = "custom_cakes_enabled", nullable = false)
    @Builder.Default
    private Boolean customCakesEnabled = true;

    @Column(name = "cc_field_occasion_enabled", nullable = false)
    @Builder.Default
    private Boolean ccFieldOccasionEnabled = true;

    @Column(name = "cc_field_flavour_enabled", nullable = false)
    @Builder.Default
    private Boolean ccFieldFlavourEnabled = true;

    @Column(name = "cc_field_servings_enabled", nullable = false)
    @Builder.Default
    private Boolean ccFieldServingsEnabled = true;

    @Column(name = "cc_field_date_enabled", nullable = false)
    @Builder.Default
    private Boolean ccFieldDateEnabled = true;

    @Column(name = "cc_field_budget_enabled", nullable = false)
    @Builder.Default
    private Boolean ccFieldBudgetEnabled = true;

    @Column(name = "cc_field_delivery_enabled", nullable = false)
    @Builder.Default
    private Boolean ccFieldDeliveryEnabled = true;

    @Column(name = "cc_field_design_enabled", nullable = false)
    @Builder.Default
    private Boolean ccFieldDesignEnabled = true;

    @Column(name = "cc_field_reference_enabled", nullable = false)
    @Builder.Default
    private Boolean ccFieldReferenceEnabled = true;

    @Column(name = "whatsapp_enabled", nullable = false)
    @Builder.Default
    private Boolean whatsappEnabled = true;

    @Column(name = "phone_enabled", nullable = false)
    @Builder.Default
    private Boolean phoneEnabled = true;

    @Column(name = "email_enabled", nullable = false)
    @Builder.Default
    private Boolean emailEnabled = true;

    @Column(name = "address_enabled", nullable = false)
    @Builder.Default
    private Boolean addressEnabled = true;

    @Column(name = "map_enabled", nullable = false)
    @Builder.Default
    private Boolean mapEnabled = true;

    @Column(name = "business_hours_enabled", nullable = false)
    @Builder.Default
    private Boolean businessHoursEnabled = true;

    @Column(name = "hide_street_address", nullable = false)
    @Builder.Default
    private Boolean hideStreetAddress = false;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
