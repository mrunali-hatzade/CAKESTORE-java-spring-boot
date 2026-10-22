package com.cakeplatform.api.modules.shop.service;

import com.cakeplatform.api.modules.shop.Shop;
import com.cakeplatform.api.modules.shop.ShopRepository;
import com.cakeplatform.api.modules.shop.dto.ShopResponse;
import com.cakeplatform.api.modules.shop.dto.UpdateShopRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ShopService {

    private final ShopRepository shopRepository;
    @org.springframework.beans.factory.annotation.Autowired
    private com.cakeplatform.api.modules.audit.ActivityLoggerService activityLogger;
    private final com.cakeplatform.api.modules.security.ShopAccessValidator shopAccessValidator;
    private final com.cakeplatform.api.modules.storefront.StorefrontCacheService storefrontCacheService;
    private final com.cakeplatform.api.modules.location.service.LocationValidationService locationValidationService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.cakeplatform.api.modules.location.service.GeocodingService geocodingService;

    public void setGeocodingService(com.cakeplatform.api.modules.location.service.GeocodingService geocodingService) {
        this.geocodingService = geocodingService;
    }

    @org.springframework.beans.factory.annotation.Autowired
    public ShopService(
            ShopRepository shopRepository,
            com.cakeplatform.api.modules.security.ShopAccessValidator shopAccessValidator,
            @org.springframework.beans.factory.annotation.Autowired(required = false) com.cakeplatform.api.modules.storefront.StorefrontCacheService storefrontCacheService,
            @org.springframework.beans.factory.annotation.Autowired(required = false) com.cakeplatform.api.modules.location.service.LocationValidationService locationValidationService) {
        this.shopRepository = shopRepository;
        this.shopAccessValidator = shopAccessValidator;
        this.storefrontCacheService = storefrontCacheService;
        this.locationValidationService = locationValidationService;
    }

    public ShopService(
            ShopRepository shopRepository,
            com.cakeplatform.api.modules.security.ShopAccessValidator shopAccessValidator) {
        this(shopRepository, shopAccessValidator, null, null);
    }

    public ShopService(ShopRepository shopRepository) {
        this(shopRepository, null, null, null);
    }

    @Transactional(readOnly = true)
    public ShopResponse getMyShopProfile(Long ownerId) {
        Shop shop = getShopByOwnerId(ownerId);
        return mapToResponse(shop);
    }

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.cakeplatform.api.modules.subscription.SubscriptionRepository subscriptionRepository;

    @Transactional
    public ShopResponse updateOperationalStatus(Long ownerId, boolean enabled) {
        Shop shop = getShopByOwnerId(ownerId);

        if (shop.isDeleted()) {
            throw new IllegalArgumentException("Cannot update operational status: Shop is deleted");
        }
        if (shop.getStatus() == com.cakeplatform.api.modules.shop.ShopStatus.SUSPENDED) {
            throw new com.cakeplatform.api.exception.SubscriptionExpiredException("Shop is suspended by administration. Operational status cannot be changed.");
        }

        if (enabled) {
            // Cannot re-enable if marketplace restricted by admin
            if (Boolean.TRUE.equals(shop.getIsMarketplaceRestricted())) {
                throw new IllegalStateException("Bakery cannot be enabled while an administrative marketplace restriction is active. Reason: " + shop.getMarketplaceRestrictionReason());
            }

            // Must have active, unexpired subscription
            if (subscriptionRepository != null) {
                com.cakeplatform.api.modules.subscription.Subscription latestSub = subscriptionRepository
                        .findFirstByShopIdOrderByCreatedAtDesc(shop.getId())
                        .orElseThrow(() -> new com.cakeplatform.api.exception.SubscriptionExpiredException("No subscription found. Please subscribe to a plan before opening your bakery."));

                if (latestSub.getStatus() == com.cakeplatform.api.modules.subscription.SubscriptionStatus.EXPIRED ||
                    latestSub.getStatus() == com.cakeplatform.api.modules.subscription.SubscriptionStatus.SUSPENDED ||
                    latestSub.getStatus() == com.cakeplatform.api.modules.subscription.SubscriptionStatus.CANCELLED ||
                    (latestSub.getExpiryDate() != null && latestSub.getExpiryDate().isBefore(java.time.LocalDateTime.now()))) {
                    throw new com.cakeplatform.api.exception.SubscriptionExpiredException("Subscription is " + latestSub.getStatus().name() + ". Please renew before opening your bakery.");
                }
            }

            // Explicit owner re-opening transitions legacy INACTIVE to ACTIVE
            if (shop.getStatus() == com.cakeplatform.api.modules.shop.ShopStatus.INACTIVE) {
                shop.setStatus(com.cakeplatform.api.modules.shop.ShopStatus.ACTIVE);
                shop.setInactiveReason(null);
            }

            shop.setIsOwnerEnabled(true);
        } else {
            shop.setIsOwnerEnabled(false);
        }

        shop = shopRepository.save(shop);
        if (storefrontCacheService != null) {
            storefrontCacheService.evictShopDetails(shop.getId());
            storefrontCacheService.evictShopProducts(shop.getId());
        }

        if (activityLogger != null) {
            activityLogger.logActivity(
                    ownerId,
                    shop.getId(),
                    "OPERATIONAL_STATUS_CHANGED",
                    "SHOP",
                    shop.getId(),
                    "Owner set operational status to: " + (enabled ? "OPEN" : "CLOSED")
            );
        }

        return mapToResponse(shop);
    }

    @Transactional
    public ShopResponse updateShopStatusAndReason(Long ownerId, com.cakeplatform.api.modules.shop.ShopStatus status, String reason) {
        Shop shop = getShopByOwnerId(ownerId);
        if (shop.isDeleted()) {
            throw new IllegalArgumentException("Cannot update status: Shop is deleted");
        }
        if (shop.getStatus() == com.cakeplatform.api.modules.shop.ShopStatus.SUSPENDED) {
            throw new com.cakeplatform.api.exception.SubscriptionExpiredException("Shop is suspended by administration. Cannot change status.");
        }

        if (status == com.cakeplatform.api.modules.shop.ShopStatus.ACTIVE) {
            // Re-enabling/activating requires eligibility checks
            if (Boolean.TRUE.equals(shop.getIsMarketplaceRestricted())) {
                throw new IllegalStateException("Bakery cannot be activated while an administrative marketplace restriction is active. Reason: " + shop.getMarketplaceRestrictionReason());
            }

            if (subscriptionRepository != null) {
                com.cakeplatform.api.modules.subscription.Subscription latestSub = subscriptionRepository
                        .findFirstByShopIdOrderByCreatedAtDesc(shop.getId())
                        .orElseThrow(() -> new com.cakeplatform.api.exception.SubscriptionExpiredException("No subscription found. Please subscribe to a plan before activating your bakery."));

                if (latestSub.getStatus() == com.cakeplatform.api.modules.subscription.SubscriptionStatus.EXPIRED ||
                    latestSub.getStatus() == com.cakeplatform.api.modules.subscription.SubscriptionStatus.SUSPENDED ||
                    latestSub.getStatus() == com.cakeplatform.api.modules.subscription.SubscriptionStatus.CANCELLED ||
                    (latestSub.getExpiryDate() != null && latestSub.getExpiryDate().isBefore(java.time.LocalDateTime.now()))) {
                    throw new com.cakeplatform.api.exception.SubscriptionExpiredException("Subscription is " + latestSub.getStatus().name() + ". Please renew before activating your bakery.");
                }
            }
            shop.setIsOwnerEnabled(true);
            shop.setStatus(com.cakeplatform.api.modules.shop.ShopStatus.ACTIVE);
            shop.setInactiveReason(null);
        } else if (status == com.cakeplatform.api.modules.shop.ShopStatus.INACTIVE) {
            shop.setIsOwnerEnabled(false);
            shop.setStatus(com.cakeplatform.api.modules.shop.ShopStatus.INACTIVE);
            if (reason != null && !reason.trim().isEmpty()) {
                shop.setInactiveReason(reason.trim());
            } else {
                shop.setInactiveReason(null);
            }
        } else {
            shop.setStatus(status);
        }

        shop = shopRepository.save(shop);
        if (storefrontCacheService != null) {
            storefrontCacheService.evictShopDetails(shop.getId());
            storefrontCacheService.evictShopProducts(shop.getId());
        }
        
        if (activityLogger != null) {
            if (status == com.cakeplatform.api.modules.shop.ShopStatus.INACTIVE) {
                activityLogger.logActivity(ownerId, shop.getId(), "STATUS_CHANGE", "SHOP", shop.getId(), "Shop set to inactive. Reason: " + reason);
            } else {
                activityLogger.logActivity(ownerId, shop.getId(), "STATUS_CHANGE", "SHOP", shop.getId(), "Shop status updated to: " + status.name());
            }
        }
        
        return mapToResponse(shop);
    }


    public ShopResponse updateMyShopProfile(Long ownerId, UpdateShopRequest request) {
        Shop shop = getShopByOwnerId(ownerId);

        if (shop.getStatus() == com.cakeplatform.api.modules.shop.ShopStatus.SUSPENDED) {
            throw new com.cakeplatform.api.exception.SubscriptionExpiredException("Shop is suspended by administration. Profile updates are disabled.");
        }

        boolean isLocationUpdated = request.getState() != null || request.getDistrict() != null 
                || request.getCity() != null || request.getPincode() != null;

        if (isLocationUpdated && locationValidationService != null) {
            String effectiveState = request.getState() != null ? request.getState() : shop.getState();
            String effectiveDistrict = request.getDistrict() != null ? request.getDistrict() : shop.getDistrict();
            String effectiveCity = request.getCity() != null ? request.getCity() : shop.getCity();
            String effectiveArea = request.getArea() != null ? request.getArea() : shop.getArea();
            String effectivePincode = request.getPincode() != null ? request.getPincode() : shop.getPincode();

            locationValidationService.validateLocation(
                    com.cakeplatform.api.modules.location.dto.LocationValidationDTO.builder()
                            .state(effectiveState)
                            .district(effectiveDistrict)
                            .city(effectiveCity)
                            .area(effectiveArea)
                            .pincode(effectivePincode)
                            .build()
            );
        }

        if (request.getBusinessName() != null) shop.setBusinessName(request.getBusinessName());
        if (request.getDescription() != null) shop.setDescription(request.getDescription());
        if (request.getPhone() != null) shop.setPhone(request.getPhone());
        if (request.getEmail() != null) shop.setEmail(request.getEmail());
        if (request.getFssaiRegistration() != null) shop.setFssaiRegistration(request.getFssaiRegistration());
        if (request.getAddress() != null) shop.setAddress(request.getAddress());
        if (request.getCity() != null) shop.setCity(request.getCity());
        if (request.getState() != null) shop.setState(request.getState());
        if (request.getPincode() != null) shop.setPincode(request.getPincode());
        
        if (request.getAddressLine1() != null) shop.setAddressLine1(request.getAddressLine1());
        if (request.getAddressLine2() != null) shop.setAddressLine2(request.getAddressLine2());
        if (request.getArea() != null) shop.setArea(request.getArea());
        if (request.getDistrict() != null) shop.setDistrict(request.getDistrict());
        
        Double reqLat = request.getLatitude();
        Double reqLng = request.getLongitude();
        if (reqLat != null || reqLng != null) {
            if (reqLat == null || reqLng == null || (geocodingService != null && !geocodingService.isValidCoordinates(reqLat, reqLng))
                    || reqLat < -90.0 || reqLat > 90.0 || reqLng < -180.0 || reqLng > 180.0) {
                throw new com.cakeplatform.api.modules.location.exception.InvalidLocationException(
                        "Invalid geographic coordinates. Latitude must be between -90 and 90, and longitude between -180 and 180."
                );
            }
            shop.setLatitude(reqLat);
            shop.setLongitude(reqLng);
        }


        if (request.getBusinessCategory() != null) shop.setBusinessCategory(request.getBusinessCategory());
        if (request.getLogoUrl() != null) shop.setLogoUrl(request.getLogoUrl());
        if (request.getCoverImageUrl() != null) shop.setCoverImageUrl(request.getCoverImageUrl());
        if (request.getAboutStory() != null) shop.setAboutStory(request.getAboutStory());
        if (request.getAboutImageUrl() != null) shop.setAboutImageUrl(request.getAboutImageUrl());
        if (request.getShowAboutImage() != null) shop.setShowAboutImage(request.getShowAboutImage());
        if (request.getWhatsappNumber() != null) shop.setWhatsappNumber(request.getWhatsappNumber());
        if (request.getMapLocationUrl() != null) shop.setMapLocationUrl(request.getMapLocationUrl());

        Shop updatedShop = shopRepository.save(shop);
        if (storefrontCacheService != null) {
            storefrontCacheService.evictShopDetails(updatedShop.getId());
        }
        return mapToResponse(updatedShop);
    }

    private Shop getShopByOwnerId(Long ownerId) {
        if (shopAccessValidator != null) {
            return shopAccessValidator.getShopByOwnerId(ownerId);
        }
        return shopRepository.findFirstByOwnerId(ownerId)
                .orElseThrow(() -> new IllegalArgumentException("Shop not found for owner ID: " + ownerId));
    }

    private ShopResponse mapToResponse(Shop shop) {
        return ShopResponse.builder()
                .id(shop.getId())
                .businessName(shop.getBusinessName())
                .description(shop.getDescription())
                .phone(shop.getPhone())
                .email(shop.getEmail())
                .address(shop.getAddress())
                .addressLine1(shop.getAddressLine1())
                .addressLine2(shop.getAddressLine2())
                .area(shop.getArea())
                .city(shop.getCity())
                .district(shop.getDistrict())
                .state(shop.getState())
                .pincode(shop.getPincode())
                .latitude(shop.getLatitude())
                .longitude(shop.getLongitude())
                .businessCategory(shop.getBusinessCategory())
                .businessType(shop.getBusinessType() != null ? shop.getBusinessType().name() : null)
                .yearsInBusiness(shop.getYearsInBusiness())
                .fssaiRegistration(shop.getFssaiRegistration())
                .logoUrl(shop.getLogoUrl())
                .coverImageUrl(shop.getCoverImageUrl())
                .aboutStory(shop.getAboutStory())
                .aboutImageUrl(shop.getAboutImageUrl())
                .showAboutImage(shop.getShowAboutImage())
                .whatsappNumber(shop.getWhatsappNumber())
                .mapLocationUrl(shop.getMapLocationUrl())
                .status(shop.getStatus())
                .verificationStatus(shop.getVerificationStatus() != null ? shop.getVerificationStatus().name() : null)
                .isOwnerEnabled(shop.getIsOwnerEnabled())
                .isMarketplaceRestricted(shop.getIsMarketplaceRestricted())
                .marketplaceRestrictionReason(shop.getMarketplaceRestrictionReason())
                .createdAt(shop.getCreatedAt())
                .updatedAt(shop.getUpdatedAt())
                .build();
    }
}
