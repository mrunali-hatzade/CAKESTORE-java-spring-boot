package com.cakeplatform.api.modules.shop;

import com.cakeplatform.api.modules.user.User;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "shops")
@Data
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
@org.hibernate.annotations.SQLDelete(sql = "UPDATE shops SET is_deleted = true WHERE id=?")
@org.hibernate.annotations.SQLRestriction("is_deleted=false")
public class Shop {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "is_deleted", nullable = false)
    private boolean isDeleted = false;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Column(name = "business_name", nullable = false)
    private String businessName;

    private String description;
    private String phone;
    private String email;
    private String address;
    private String city;
    private String state;
    private String pincode;

    @Column(name = "business_category")
    private String businessCategory;

    @Enumerated(EnumType.STRING)
    @Column(name = "business_type")
    private BusinessType businessType;

    @Column(name = "years_in_business")
    private Integer yearsInBusiness;

    @Column(name = "fssai_registration")
    private String fssaiRegistration;

    @Column(name = "address_line_1")
    private String addressLine1;

    @Column(name = "address_line_2")
    private String addressLine2;

    private String area;
    private String district;

    @Column(name = "latitude")
    private Double latitude;

    @Column(name = "longitude")
    private Double longitude;

    @Column(name = "logo_url")
    private String logoUrl;

    @Column(name = "cover_image_url")
    private String coverImageUrl;

    @Column(name = "about_story", columnDefinition = "TEXT")
    private String aboutStory;

    @Column(name = "about_image_url", length = 1000)
    private String aboutImageUrl;

    @Column(name = "show_about_image", nullable = false)
    private Boolean showAboutImage = true;

    @Column(name = "whatsapp_number", length = 50)
    private String whatsappNumber;

    @Column(name = "map_location_url", length = 1000)
    private String mapLocationUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ShopStatus status = ShopStatus.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(name = "verification_status")
    private VerificationStatus verificationStatus = VerificationStatus.PROCESSING;

    @Column(name = "inactive_reason", length = 500)
    private String inactiveReason;

    @Column(name = "is_owner_enabled", nullable = false)
    private Boolean isOwnerEnabled = true;

    @Column(name = "is_marketplace_restricted", nullable = false)
    private Boolean isMarketplaceRestricted = false;

    @Column(name = "marketplace_restriction_reason", length = 500)
    private String marketplaceRestrictionReason;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @JsonIgnore
    @OneToMany(mappedBy = "shop", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ShopDeliverySlot> deliverySlots = new ArrayList<>();

    @JsonIgnore
    @OneToOne(mappedBy = "shop", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private ShopDeliveryConfig deliveryConfig;

    @JsonIgnore
    @OneToOne(mappedBy = "shop", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private ShopStorefrontSettings storefrontSettings;

    @JsonIgnore
    @OneToMany(mappedBy = "shop", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("displayOrder ASC, createdAt ASC")
    private List<ShopBanner> banners = new ArrayList<>();

    @JsonIgnore
    @OneToMany(mappedBy = "shop", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ShopBusinessHours> businessHours = new ArrayList<>();

    @JsonIgnore
    @OneToMany(mappedBy = "shop", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("displayOrder ASC")
    private List<ShopCustomFormField> customFormFields = new ArrayList<>();

    @JsonIgnore
    @OneToMany(mappedBy = "shop", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("displayOrder ASC")
    private List<ShopSocialLink> socialLinks = new ArrayList<>();
}

