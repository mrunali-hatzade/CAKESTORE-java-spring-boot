package com.cakeplatform.api.modules.shop.service;

import com.cakeplatform.api.modules.security.ShopAccessValidator;
import com.cakeplatform.api.modules.shop.*;
import com.cakeplatform.api.modules.shop.dto.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalTime;
import java.util.List;

@Service
public class OwnerStorefrontService {

    private final ShopAccessValidator shopAccessValidator;
    private final ShopBannerRepository shopBannerRepository;
    private final ShopBusinessHoursRepository shopBusinessHoursRepository;
    private final ShopDeliveryConfigRepository shopDeliveryConfigRepository;
    private final ShopStorefrontSettingsRepository shopStorefrontSettingsRepository;
    private final ShopCustomFormFieldRepository shopCustomFormFieldRepository;
    private final ShopSocialLinkRepository shopSocialLinkRepository;
    private final com.cakeplatform.api.modules.storefront.StorefrontCacheService storefrontCacheService;

    @org.springframework.beans.factory.annotation.Autowired
    private ShopService shopService;

    @org.springframework.beans.factory.annotation.Autowired
    public OwnerStorefrontService(
            ShopAccessValidator shopAccessValidator,
            ShopBannerRepository shopBannerRepository,
            ShopBusinessHoursRepository shopBusinessHoursRepository,
            ShopDeliveryConfigRepository shopDeliveryConfigRepository,
            ShopStorefrontSettingsRepository shopStorefrontSettingsRepository,
            ShopCustomFormFieldRepository shopCustomFormFieldRepository,
            @org.springframework.beans.factory.annotation.Autowired(required = false) ShopSocialLinkRepository shopSocialLinkRepository,
            @org.springframework.beans.factory.annotation.Autowired(required = false) com.cakeplatform.api.modules.storefront.StorefrontCacheService storefrontCacheService) {
        this.shopAccessValidator = shopAccessValidator;
        this.shopBannerRepository = shopBannerRepository;
        this.shopBusinessHoursRepository = shopBusinessHoursRepository;
        this.shopDeliveryConfigRepository = shopDeliveryConfigRepository;
        this.shopStorefrontSettingsRepository = shopStorefrontSettingsRepository;
        this.shopCustomFormFieldRepository = shopCustomFormFieldRepository;
        this.shopSocialLinkRepository = shopSocialLinkRepository;
        this.storefrontCacheService = storefrontCacheService;
    }

    public OwnerStorefrontService(
            ShopAccessValidator shopAccessValidator,
            ShopBannerRepository shopBannerRepository,
            ShopBusinessHoursRepository shopBusinessHoursRepository,
            ShopDeliveryConfigRepository shopDeliveryConfigRepository,
            ShopStorefrontSettingsRepository shopStorefrontSettingsRepository,
            ShopCustomFormFieldRepository shopCustomFormFieldRepository,
            com.cakeplatform.api.modules.storefront.StorefrontCacheService storefrontCacheService) {
        this(shopAccessValidator, shopBannerRepository, shopBusinessHoursRepository,
             shopDeliveryConfigRepository, shopStorefrontSettingsRepository,
             shopCustomFormFieldRepository, null, storefrontCacheService);
    }

    public OwnerStorefrontService(
            ShopAccessValidator shopAccessValidator,
            ShopBannerRepository shopBannerRepository,
            ShopBusinessHoursRepository shopBusinessHoursRepository,
            ShopDeliveryConfigRepository shopDeliveryConfigRepository,
            ShopStorefrontSettingsRepository shopStorefrontSettingsRepository,
            ShopCustomFormFieldRepository shopCustomFormFieldRepository) {
        this(shopAccessValidator, shopBannerRepository, shopBusinessHoursRepository,
             shopDeliveryConfigRepository, shopStorefrontSettingsRepository,
             shopCustomFormFieldRepository, null, null);
    }


    // --- Banners ---
    public List<ShopBanner> getBanners(Long ownerId) {
        Shop shop = shopAccessValidator.getValidShopForOwner(ownerId);
        return shopBannerRepository.findByShopIdOrderByDisplayOrderAsc(shop.getId());
    }

    @Transactional
    public ShopBanner createBanner(Long ownerId, ShopBannerRequest request) {
        Shop shop = shopAccessValidator.getValidShopForOwner(ownerId);
        ShopBanner banner = ShopBanner.builder()
                .shop(shop)
                .imageUrl(request.getImageUrl())
                .title(request.getTitle())
                .subtitle(request.getSubtitle())
                .buttonText(request.getButtonText())
                .buttonUrl(request.getButtonUrl())
                .displayOrder(request.getDisplayOrder() != null ? request.getDisplayOrder() : 0)
                .isActive(request.getIsActive() != null ? request.getIsActive() : true)
                .build();
        ShopBanner saved = shopBannerRepository.save(banner);
        if (storefrontCacheService != null) storefrontCacheService.evictShopDetails(shop.getId());
        return saved;
    }

    @Transactional
    public ShopBanner updateBanner(Long ownerId, Long bannerId, ShopBannerRequest request) {
        Shop shop = shopAccessValidator.getValidShopForOwner(ownerId);
        ShopBanner banner = shopBannerRepository.findByIdAndShopId(bannerId, shop.getId())
                .orElseThrow(() -> new RuntimeException("Banner not found or unauthorized"));

        banner.setImageUrl(request.getImageUrl());
        banner.setTitle(request.getTitle());
        banner.setSubtitle(request.getSubtitle());
        banner.setButtonText(request.getButtonText());
        banner.setButtonUrl(request.getButtonUrl());
        if (request.getDisplayOrder() != null) banner.setDisplayOrder(request.getDisplayOrder());
        if (request.getIsActive() != null) banner.setIsActive(request.getIsActive());

        ShopBanner saved = shopBannerRepository.save(banner);
        if (storefrontCacheService != null) storefrontCacheService.evictShopDetails(shop.getId());
        return saved;
    }

    @Transactional
    public void deleteBanner(Long ownerId, Long bannerId) {
        Shop shop = shopAccessValidator.getValidShopForOwner(ownerId);
        ShopBanner banner = shopBannerRepository.findByIdAndShopId(bannerId, shop.getId())
                .orElseThrow(() -> new RuntimeException("Banner not found or unauthorized"));
        shopBannerRepository.delete(banner);
        if (storefrontCacheService != null) storefrontCacheService.evictShopDetails(shop.getId());
    }

    // --- Business Hours ---
    public List<ShopBusinessHours> getBusinessHours(Long ownerId) {
        Shop shop = shopAccessValidator.getValidShopForOwner(ownerId);
        return shopBusinessHoursRepository.findByShopId(shop.getId());
    }

    @Transactional
    public ShopBusinessHours saveBusinessHour(Long ownerId, ShopBusinessHoursRequest request) {
        Shop shop = shopAccessValidator.getValidShopForOwner(ownerId);

        if (request.getDayOfWeek() == null || request.getDayOfWeek().trim().isEmpty()) {
            throw new IllegalArgumentException("Day of week is required");
        }
        String dayOfWeek = request.getDayOfWeek().trim().toUpperCase();
        try {
            java.time.DayOfWeek.valueOf(dayOfWeek);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid day of week: " + request.getDayOfWeek());
        }

        if (request.getIsOpen() == null) {
            throw new IllegalArgumentException("isOpen flag is required");
        }

        if (Boolean.TRUE.equals(request.getIsOpen())) {
            if (request.getOpenTime() == null || request.getCloseTime() == null) {
                throw new IllegalArgumentException("Opening and closing times are required when the day is open");
            }
            if (!request.getCloseTime().isAfter(request.getOpenTime())) {
                throw new IllegalArgumentException("Closing time must be strictly after opening time");
            }
        }

        ShopBusinessHours hours = shopBusinessHoursRepository.findByShopIdAndDayOfWeek(shop.getId(), dayOfWeek)
                .orElseGet(() -> ShopBusinessHours.builder().shop(shop).dayOfWeek(dayOfWeek).build());

        hours.setIsOpen(request.getIsOpen());
        if (Boolean.TRUE.equals(request.getIsOpen())) {
            hours.setOpenTime(request.getOpenTime());
            hours.setCloseTime(request.getCloseTime());
        } else {
            hours.setOpenTime(request.getOpenTime() != null ? request.getOpenTime()
                    : (hours.getOpenTime() != null ? hours.getOpenTime() : LocalTime.of(9, 0)));
            hours.setCloseTime(request.getCloseTime() != null ? request.getCloseTime()
                    : (hours.getCloseTime() != null ? hours.getCloseTime() : LocalTime.of(21, 0)));
        }

        ShopBusinessHours saved = shopBusinessHoursRepository.save(hours);
        if (storefrontCacheService != null) storefrontCacheService.evictShopDetails(shop.getId());
        return saved;
    }

    // --- Delivery Config ---
    public ShopDeliveryConfig getDeliveryConfig(Long ownerId) {
        Shop shop = shopAccessValidator.getValidShopForOwner(ownerId);
        return shopDeliveryConfigRepository.findByShopId(shop.getId())
                .orElseGet(() -> {
                    ShopDeliveryConfig defaultCfg = ShopDeliveryConfig.builder()
                            .shop(shop)
                            .deliveryEnabled(true)
                            .deliveryChargeType("FIXED")
                            .fixedChargeAmount(java.math.BigDecimal.valueOf(50.00))
                            .minOrderForFreeDelivery(java.math.BigDecimal.valueOf(1000.00))
                            .build();
                    return shopDeliveryConfigRepository.save(defaultCfg);
                });
    }

    @Transactional
    public ShopDeliveryConfig updateDeliveryConfig(Long ownerId, ShopDeliveryConfigRequest request) {
        Shop shop = shopAccessValidator.getValidShopForOwner(ownerId);
        ShopDeliveryConfig config = shopDeliveryConfigRepository.findByShopId(shop.getId())
                .orElseGet(() -> ShopDeliveryConfig.builder().shop(shop).build());

        if (request.getDeliveryEnabled() != null) {
            config.setDeliveryEnabled(request.getDeliveryEnabled());
        } else if (config.getDeliveryEnabled() == null) {
            config.setDeliveryEnabled(true);
        }
        config.setDeliveryChargeType(request.getDeliveryChargeType().trim().toUpperCase());
        config.setFixedChargeAmount(request.getFixedChargeAmount());
        config.setMinOrderForFreeDelivery(request.getMinOrderForFreeDelivery());
        config.setDeliveryNotes(request.getDeliveryNotes());

        ShopDeliveryConfig saved = shopDeliveryConfigRepository.save(config);
        if (storefrontCacheService != null) storefrontCacheService.evictShopDetails(shop.getId());
        return saved;
    }

    // --- Storefront Settings ---
    public ShopStorefrontSettings getStorefrontSettings(Long ownerId) {
        Shop shop = shopAccessValidator.getValidShopForOwner(ownerId);
        return shopStorefrontSettingsRepository.findByShopId(shop.getId())
                .orElseGet(() -> {
                    boolean isHomeBakery = shop.getBusinessType() == BusinessType.HOME_BAKERY;
                    ShopStorefrontSettings defaultSettings = ShopStorefrontSettings.builder()
                            .shop(shop)
                            .hideStreetAddress(isHomeBakery)
                            .build();
                    return shopStorefrontSettingsRepository.save(defaultSettings);
                });
    }

    @Transactional
    public ShopStorefrontSettings updateStorefrontSettings(Long ownerId, ShopStorefrontSettingsRequest request) {
        Shop shop = shopAccessValidator.getValidShopForOwner(ownerId);
        ShopStorefrontSettings settings = shopStorefrontSettingsRepository.findByShopId(shop.getId())
                .orElseGet(() -> ShopStorefrontSettings.builder().shop(shop).build());

        if (request.getHeroBannerEnabled() != null) settings.setHeroBannerEnabled(request.getHeroBannerEnabled());
        if (request.getTopRatedEnabled() != null) settings.setTopRatedEnabled(request.getTopRatedEnabled());
        if (request.getReviewsEnabled() != null) settings.setReviewsEnabled(request.getReviewsEnabled());
        if (request.getBakeryInfoEnabled() != null) settings.setBakeryInfoEnabled(request.getBakeryInfoEnabled());
        if (request.getCategoriesEnabled() != null) settings.setCategoriesEnabled(request.getCategoriesEnabled());
        if (request.getFiltersEnabled() != null) settings.setFiltersEnabled(request.getFiltersEnabled());
        if (request.getRatingsEnabled() != null) settings.setRatingsEnabled(request.getRatingsEnabled());
        if (request.getAboutStoryEnabled() != null) settings.setAboutStoryEnabled(request.getAboutStoryEnabled());
        if (request.getAboutImageEnabled() != null) settings.setAboutImageEnabled(request.getAboutImageEnabled());
        if (request.getFulfillmentEnabled() != null) settings.setFulfillmentEnabled(request.getFulfillmentEnabled());
        if (request.getLeadTimeDays() != null) settings.setLeadTimeDays(request.getLeadTimeDays());
        if (request.getLeadTimeMessage() != null) settings.setLeadTimeMessage(request.getLeadTimeMessage());
        if (request.getCustomCakesEnabled() != null) settings.setCustomCakesEnabled(request.getCustomCakesEnabled());
        if (request.getCcFieldOccasionEnabled() != null) settings.setCcFieldOccasionEnabled(request.getCcFieldOccasionEnabled());
        if (request.getCcFieldFlavourEnabled() != null) settings.setCcFieldFlavourEnabled(request.getCcFieldFlavourEnabled());
        if (request.getCcFieldServingsEnabled() != null) settings.setCcFieldServingsEnabled(request.getCcFieldServingsEnabled());
        if (request.getCcFieldDateEnabled() != null) settings.setCcFieldDateEnabled(request.getCcFieldDateEnabled());
        if (request.getCcFieldBudgetEnabled() != null) settings.setCcFieldBudgetEnabled(request.getCcFieldBudgetEnabled());
        if (request.getCcFieldDeliveryEnabled() != null) settings.setCcFieldDeliveryEnabled(request.getCcFieldDeliveryEnabled());
        if (request.getCcFieldDesignEnabled() != null) settings.setCcFieldDesignEnabled(request.getCcFieldDesignEnabled());
        if (request.getCcFieldReferenceEnabled() != null) settings.setCcFieldReferenceEnabled(request.getCcFieldReferenceEnabled());
        if (request.getWhatsappEnabled() != null) settings.setWhatsappEnabled(request.getWhatsappEnabled());
        if (request.getPhoneEnabled() != null) settings.setPhoneEnabled(request.getPhoneEnabled());
        if (request.getEmailEnabled() != null) settings.setEmailEnabled(request.getEmailEnabled());
        if (request.getAddressEnabled() != null) settings.setAddressEnabled(request.getAddressEnabled());
        if (request.getMapEnabled() != null) settings.setMapEnabled(request.getMapEnabled());
        if (request.getBusinessHoursEnabled() != null) settings.setBusinessHoursEnabled(request.getBusinessHoursEnabled());
        if (request.getHideStreetAddress() != null) settings.setHideStreetAddress(request.getHideStreetAddress());

        ShopStorefrontSettings saved = shopStorefrontSettingsRepository.save(settings);
        if (storefrontCacheService != null) storefrontCacheService.evictShopDetails(shop.getId());
        return saved;
    }

    // --- Custom Form Fields ---
    public List<ShopCustomFormField> getCustomFormFields(Long ownerId) {
        Shop shop = shopAccessValidator.getValidShopForOwner(ownerId);
        return shopCustomFormFieldRepository.findByShopIdOrderByDisplayOrderAsc(shop.getId());
    }

    @Transactional
    public ShopCustomFormField createCustomFormField(Long ownerId, ShopCustomFormFieldRequest request) {
        Shop shop = shopAccessValidator.getValidShopForOwner(ownerId);
        ShopCustomFormField field = ShopCustomFormField.builder()
                .shop(shop)
                .fieldKey(request.getFieldKey().trim())
                .fieldLabel(request.getFieldLabel().trim())
                .fieldType(request.getFieldType().trim().toUpperCase())
                .isRequired(request.getIsRequired() != null ? request.getIsRequired() : false)
                .isEnabled(request.getIsEnabled() != null ? request.getIsEnabled() : true)
                .optionsJson(request.getOptionsJson())
                .displayOrder(request.getDisplayOrder() != null ? request.getDisplayOrder() : 0)
                .build();
        ShopCustomFormField saved = shopCustomFormFieldRepository.save(field);
        if (storefrontCacheService != null) storefrontCacheService.evictShopDetails(shop.getId());
        return saved;
    }

    @Transactional
    public ShopCustomFormField updateCustomFormField(Long ownerId, Long fieldId, ShopCustomFormFieldRequest request) {
        Shop shop = shopAccessValidator.getValidShopForOwner(ownerId);
        ShopCustomFormField field = shopCustomFormFieldRepository.findByIdAndShopId(fieldId, shop.getId())
                .orElseThrow(() -> new RuntimeException("Custom form field not found or unauthorized"));

        field.setFieldKey(request.getFieldKey().trim());
        field.setFieldLabel(request.getFieldLabel().trim());
        field.setFieldType(request.getFieldType().trim().toUpperCase());
        if (request.getIsRequired() != null) field.setIsRequired(request.getIsRequired());
        if (request.getIsEnabled() != null) field.setIsEnabled(request.getIsEnabled());
        field.setOptionsJson(request.getOptionsJson());
        if (request.getDisplayOrder() != null) field.setDisplayOrder(request.getDisplayOrder());

        ShopCustomFormField saved = shopCustomFormFieldRepository.save(field);
        if (storefrontCacheService != null) storefrontCacheService.evictShopDetails(shop.getId());
        return saved;
    }

    @Transactional
    public void deleteCustomFormField(Long ownerId, Long fieldId) {
        Shop shop = shopAccessValidator.getValidShopForOwner(ownerId);
        ShopCustomFormField field = shopCustomFormFieldRepository.findByIdAndShopId(fieldId, shop.getId())
                .orElseThrow(() -> new RuntimeException("Custom form field not found or unauthorized"));
        shopCustomFormFieldRepository.delete(field);
        if (storefrontCacheService != null) storefrontCacheService.evictShopDetails(shop.getId());
    }

    // --- Flexible Social Media & External Links ---
    public List<ShopSocialLinkResponse> getSocialLinks(Long ownerId) {
        Shop shop = shopAccessValidator.getValidShopForOwner(ownerId);
        if (shopSocialLinkRepository == null) return java.util.Collections.emptyList();
        return shopSocialLinkRepository.findByShopIdOrderByDisplayOrderAsc(shop.getId()).stream()
                .map(this::mapToSocialLinkResponse)
                .collect(java.util.stream.Collectors.toList());
    }

    @Transactional
    public ShopSocialLinkResponse createSocialLink(Long ownerId, ShopSocialLinkRequest request) {
        Shop shop = shopAccessValidator.getValidShopForOwner(ownerId);
        if (request.getPlatform() == null || request.getPlatform().trim().isEmpty()) {
            throw new IllegalArgumentException("Platform is required");
        }
        if (request.getTitle() == null || request.getTitle().trim().isEmpty()) {
            throw new IllegalArgumentException("Title is required");
        }
        validateSocialUrl(request.getPlatform(), request.getUrl());

        ShopSocialLink link = ShopSocialLink.builder()
                .shop(shop)
                .platform(request.getPlatform().trim().toUpperCase())
                .title(request.getTitle().trim())
                .url(request.getUrl().trim())
                .iconKey(request.getIconKey() != null ? request.getIconKey().trim() : null)
                .displayOrder(request.getDisplayOrder() != null ? request.getDisplayOrder() : 0)
                .isActive(request.getIsActive() != null ? request.getIsActive() : true)
                .build();

        ShopSocialLink saved = shopSocialLinkRepository.save(link);
        if (storefrontCacheService != null) storefrontCacheService.evictShopDetails(shop.getId());
        return mapToSocialLinkResponse(saved);
    }

    @Transactional
    public ShopSocialLinkResponse updateSocialLink(Long ownerId, Long linkId, ShopSocialLinkRequest request) {
        Shop shop = shopAccessValidator.getValidShopForOwner(ownerId);
        ShopSocialLink link = shopSocialLinkRepository.findByIdAndShopId(linkId, shop.getId())
                .orElseThrow(() -> new RuntimeException("Social link not found or unauthorized"));

        if (request.getPlatform() == null || request.getPlatform().trim().isEmpty()) {
            throw new IllegalArgumentException("Platform is required");
        }
        if (request.getTitle() == null || request.getTitle().trim().isEmpty()) {
            throw new IllegalArgumentException("Title is required");
        }
        validateSocialUrl(request.getPlatform(), request.getUrl());

        link.setPlatform(request.getPlatform().trim().toUpperCase());
        link.setTitle(request.getTitle().trim());
        link.setUrl(request.getUrl().trim());
        if (request.getIconKey() != null) link.setIconKey(request.getIconKey().trim());
        if (request.getDisplayOrder() != null) link.setDisplayOrder(request.getDisplayOrder());
        if (request.getIsActive() != null) link.setIsActive(request.getIsActive());

        ShopSocialLink saved = shopSocialLinkRepository.save(link);
        if (storefrontCacheService != null) storefrontCacheService.evictShopDetails(shop.getId());
        return mapToSocialLinkResponse(saved);
    }

    @Transactional
    public void deleteSocialLink(Long ownerId, Long linkId) {
        Shop shop = shopAccessValidator.getValidShopForOwner(ownerId);
        ShopSocialLink link = shopSocialLinkRepository.findByIdAndShopId(linkId, shop.getId())
                .orElseThrow(() -> new RuntimeException("Social link not found or unauthorized"));
        shopSocialLinkRepository.delete(link);
        if (storefrontCacheService != null) storefrontCacheService.evictShopDetails(shop.getId());
    }

    private void validateSocialUrl(String platform, String url) {
        if (url == null || url.trim().isEmpty()) {
            throw new IllegalArgumentException("URL is required");
        }
        String trimmed = url.trim();
        String lower = trimmed.toLowerCase();

        // Reject dangerous schemes
        if (lower.startsWith("javascript:") || lower.startsWith("data:") ||
            lower.startsWith("file:") || lower.startsWith("vbscript:")) {
            throw new IllegalArgumentException("Dangerous or unsupported URL protocol");
        }

        // Must start with http://, https://, or whatsapp:// (or wa.me)
        if (!lower.startsWith("http://") && !lower.startsWith("https://") &&
            !lower.startsWith("whatsapp://")) {
            throw new IllegalArgumentException("URL must start with http://, https:// or whatsapp://");
        }

        if (platform != null) {
            String p = platform.trim().toUpperCase();
            if ("INSTAGRAM".equals(p) && !lower.contains("instagram.com")) {
                throw new IllegalArgumentException("Invalid Instagram URL");
            } else if ("FACEBOOK".equals(p) && !lower.contains("facebook.com") && !lower.contains("fb.com") && !lower.contains("fb.me")) {
                throw new IllegalArgumentException("Invalid Facebook URL");
            } else if ("YOUTUBE".equals(p) && !lower.contains("youtube.com") && !lower.contains("youtu.be")) {
                throw new IllegalArgumentException("Invalid YouTube URL");
            } else if ("PINTEREST".equals(p) && !lower.contains("pinterest.com") && !lower.contains("pin.it")) {
                throw new IllegalArgumentException("Invalid Pinterest URL");
            } else if ("TELEGRAM".equals(p) && !lower.contains("t.me") && !lower.contains("telegram.me")) {
                throw new IllegalArgumentException("Invalid Telegram URL");
            } else if ("LINKEDIN".equals(p) && !lower.contains("linkedin.com")) {
                throw new IllegalArgumentException("Invalid LinkedIn URL");
            } else if ("TIKTOK".equals(p) && !lower.contains("tiktok.com")) {
                throw new IllegalArgumentException("Invalid TikTok URL");
            }
        }
    }

    private ShopSocialLinkResponse mapToSocialLinkResponse(ShopSocialLink link) {
        return ShopSocialLinkResponse.builder()
                .id(link.getId())
                .platform(link.getPlatform())
                .title(link.getTitle())
                .url(link.getUrl())
                .iconKey(link.getIconKey())
                .displayOrder(link.getDisplayOrder())
                .isActive(link.getIsActive())
                .createdAt(link.getCreatedAt())
                .updatedAt(link.getUpdatedAt())
                .build();
    }

    // --- Website Management Atomic Save ---
    @Transactional
    public void saveWebsiteConfiguration(Long ownerId, WebsiteConfigurationRequest request) {
        // Validation occurs inside these individual service methods.
        // If any of them throw an exception, the entire transaction rolls back.
        
        shopService.updateMyShopProfile(ownerId, request.getShopProfile());
        updateDeliveryConfig(ownerId, request.getDeliveryConfig());
        updateStorefrontSettings(ownerId, request.getStorefrontSettings());
    }
}

