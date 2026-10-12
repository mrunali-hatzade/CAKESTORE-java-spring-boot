package com.cakeplatform.api.modules.storefront;

import com.cakeplatform.api.modules.order.Order;
import com.cakeplatform.api.modules.order.OrderItem;
import com.cakeplatform.api.modules.order.OrderRepository;
import com.cakeplatform.api.modules.product.Product;
import com.cakeplatform.api.modules.product.ProductRepository;
import com.cakeplatform.api.modules.shop.Shop;
import com.cakeplatform.api.modules.shop.ShopRepository;
import com.cakeplatform.api.modules.shop.ShopStatus;
import com.cakeplatform.api.modules.storefront.dto.GuestOrderRequest;
import com.cakeplatform.api.modules.storefront.dto.StorefrontShopResponse;
import com.cakeplatform.api.modules.storefront.dto.StorefrontOrderItem;
import com.cakeplatform.api.modules.storefront.dto.StorefrontDeliverySlotResponse;
import com.cakeplatform.api.modules.storefront.dto.ValidateCouponRequest;
import com.cakeplatform.api.modules.storefront.dto.ValidateCouponResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import com.cakeplatform.api.modules.storefront.dto.StorefrontShopSummaryDTO;
import com.cakeplatform.api.modules.storefront.dto.PopularCityDTO;
import com.cakeplatform.api.modules.storefront.dto.ShopSummaryProjection;
import com.cakeplatform.api.modules.storefront.dto.PopularCityProjection;
import com.cakeplatform.api.modules.shop.BusinessType;
import com.cakeplatform.api.modules.shop.VerificationStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

@Service
public class CustomerStorefrontService {

    private final ShopRepository shopRepository;
    private final ProductRepository productRepository;
    private final OrderRepository orderRepository;
    private final com.cakeplatform.api.modules.shop.CouponRepository couponRepository;
    private final com.cakeplatform.api.modules.notification.NotificationService notificationService;
    private final com.cakeplatform.api.modules.notification.AdminNotificationService adminNotificationService;
    private final com.cakeplatform.api.modules.interaction.CustomCakeRequestRepository customCakeRequestRepository;
    private final com.cakeplatform.api.modules.product.ProductCategoryRepository categoryRepository;
    private final com.cakeplatform.api.modules.shop.ShopDeliverySlotRepository deliverySlotRepository;
    private final com.cakeplatform.api.modules.shop.ShopBannerRepository shopBannerRepository;
    private final com.cakeplatform.api.modules.shop.ShopBusinessHoursRepository shopBusinessHoursRepository;
    private final com.cakeplatform.api.modules.shop.ShopDeliveryConfigRepository shopDeliveryConfigRepository;
    private final com.cakeplatform.api.modules.shop.ShopStorefrontSettingsRepository shopStorefrontSettingsRepository;
    private final com.cakeplatform.api.modules.shop.ShopCustomFormFieldRepository shopCustomFormFieldRepository;
    private final com.cakeplatform.api.modules.interaction.FeedbackRepository feedbackRepository;
    private final com.cakeplatform.api.modules.review.ProductReviewRepository productReviewRepository;
    private final com.cakeplatform.api.modules.subscription.SubscriptionRepository subscriptionRepository;
    private java.time.Clock clock = java.time.Clock.systemDefaultZone();
    private final com.cakeplatform.api.modules.user.UserRepository userRepository;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void setClock(java.time.Clock clock) {
        if (clock != null) {
            this.clock = clock;
        }
    }

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.cakeplatform.api.modules.shop.ShopSocialLinkRepository shopSocialLinkRepository;


    @org.springframework.beans.factory.annotation.Autowired
    public CustomerStorefrontService(
            ShopRepository shopRepository,
            ProductRepository productRepository,
            OrderRepository orderRepository,
            com.cakeplatform.api.modules.shop.CouponRepository couponRepository,
            com.cakeplatform.api.modules.notification.NotificationService notificationService,
            com.cakeplatform.api.modules.notification.AdminNotificationService adminNotificationService,
            com.cakeplatform.api.modules.interaction.CustomCakeRequestRepository customCakeRequestRepository,
            com.cakeplatform.api.modules.product.ProductCategoryRepository categoryRepository,
            com.cakeplatform.api.modules.shop.ShopDeliverySlotRepository deliverySlotRepository,
            com.cakeplatform.api.modules.shop.ShopBannerRepository shopBannerRepository,
            com.cakeplatform.api.modules.shop.ShopBusinessHoursRepository shopBusinessHoursRepository,
            com.cakeplatform.api.modules.shop.ShopDeliveryConfigRepository shopDeliveryConfigRepository,
            com.cakeplatform.api.modules.shop.ShopStorefrontSettingsRepository shopStorefrontSettingsRepository,
            com.cakeplatform.api.modules.shop.ShopCustomFormFieldRepository shopCustomFormFieldRepository,
            com.cakeplatform.api.modules.interaction.FeedbackRepository feedbackRepository,
            com.cakeplatform.api.modules.review.ProductReviewRepository productReviewRepository,
            com.cakeplatform.api.modules.subscription.SubscriptionRepository subscriptionRepository,
            com.cakeplatform.api.modules.user.UserRepository userRepository
    ) {
        this.shopRepository = shopRepository;
        this.productRepository = productRepository;
        this.orderRepository = orderRepository;
        this.couponRepository = couponRepository;
        this.notificationService = notificationService;
        this.adminNotificationService = adminNotificationService;
        this.customCakeRequestRepository = customCakeRequestRepository;
        this.categoryRepository = categoryRepository;
        this.deliverySlotRepository = deliverySlotRepository;
        this.shopBannerRepository = shopBannerRepository;
        this.shopBusinessHoursRepository = shopBusinessHoursRepository;
        this.shopDeliveryConfigRepository = shopDeliveryConfigRepository;
        this.shopStorefrontSettingsRepository = shopStorefrontSettingsRepository;
        this.shopCustomFormFieldRepository = shopCustomFormFieldRepository;
        this.feedbackRepository = feedbackRepository;
        this.productReviewRepository = productReviewRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.userRepository = userRepository;
    }

    // Backward-compatible constructor for existing test suites
    public CustomerStorefrontService(
            ShopRepository shopRepository,
            ProductRepository productRepository,
            OrderRepository orderRepository,
            com.cakeplatform.api.modules.shop.CouponRepository couponRepository,
            com.cakeplatform.api.modules.notification.NotificationService notificationService,
            com.cakeplatform.api.modules.notification.AdminNotificationService adminNotificationService,
            com.cakeplatform.api.modules.interaction.CustomCakeRequestRepository customCakeRequestRepository,
            com.cakeplatform.api.modules.product.ProductCategoryRepository categoryRepository,
            com.cakeplatform.api.modules.shop.ShopDeliverySlotRepository deliverySlotRepository
    ) {
        this(
                shopRepository,
                productRepository,
                orderRepository,
                couponRepository,
                notificationService,
                adminNotificationService,
                customCakeRequestRepository,
                categoryRepository,
                deliverySlotRepository,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null
        );
    }

    private Shop getActiveShop(Long shopId) {
        Shop shop = shopRepository.findById(shopId)
                .orElseThrow(() -> new RuntimeException("Shop not found"));
        
        if (shop.getStatus() != ShopStatus.ACTIVE) {
            if (shop.getStatus() == ShopStatus.PENDING) {
                throw new RuntimeException("Shop is currently unavailable or pending approval");
            }
            throw new RuntimeException("Shop is currently unavailable");
        }
        
        // Enforce subscription validation matching ShopAccessValidator
        if (subscriptionRepository == null) {
            throw new IllegalStateException("Subscription validation requires subscriptionRepository");
        }
        
        if (!isShopSubscriptionValid(shopId)) {
            throw new RuntimeException("Storefront is currently unavailable due to an expired subscription");
        }
        return shop;
    }

    /**
     * Validate that the shop's latest subscription is present, active and not expired.
     * Returns false if no subscription, status is EXPIRED/SUSPENDED/CANCELLED, or expiry is before or equal to now.
     */
    public boolean isShopSubscriptionValid(Long shopId) {
        if (subscriptionRepository == null) {
            return false;
        }
        var latest = subscriptionRepository.findFirstByShopIdOrderByCreatedAtDesc(shopId).orElse(null);
        if (latest == null) {
            return false;
        }
        if (latest.getStatus() == null) {
            return false;
        }
        switch (latest.getStatus()) {
            case EXPIRED:
            case SUSPENDED:
            case CANCELLED:
                return false;
            default:
                break;
        }
        java.time.LocalDateTime now = java.time.LocalDateTime.now(clock);
        // Expired if expiryDate is null or not after now (i.e., <= now)
        if (latest.getExpiryDate() != null && !latest.getExpiryDate().isAfter(now)) {
            return false;
        }
        return true;
    }

    @org.springframework.cache.annotation.Cacheable(value = "shopDetails", key = "#shopId", condition = "#root.target.isShopSubscriptionValid(#shopId)")
    public StorefrontShopResponse getShopDetails(Long shopId) {
        Shop shop = getActiveShop(shopId);
        return mapToStorefrontShopResponse(shop);
    }

    public List<StorefrontShopResponse> searchShops(
            String state,
            String district,
            String city,
            String area,
            com.cakeplatform.api.modules.shop.BusinessType businessType,
            String search,
            String location
    ) {
        org.springframework.data.jpa.domain.Specification<Shop> spec =
                com.cakeplatform.api.modules.shop.ShopSpecification.filterShops(
                        state, district, city, area, businessType, search, location
                );
        List<Shop> allShops = shopRepository.findAll(spec);
        List<Shop> filteredShops = allShops.stream().filter(shop -> {
            // Enforce subscription validation; exclude shops without valid subscription
            if (subscriptionRepository != null && isShopSubscriptionValid(shop.getId())) {
                return true;
            }
            return false;
        }).collect(Collectors.toList());
        
        return filteredShops.stream()
                .map(this::mapToStorefrontShopResponse)
                .collect(Collectors.toList());
    }

    public List<StorefrontShopResponse> searchShopsByLocation(String location) {
        return searchShops(null, null, null, null, null, null, location);
    }

    private volatile List<PopularCityDTO> popularCitiesCache = null;
    private volatile long lastPopularCitiesCacheTime = 0L;
    private static final long POPULAR_CITIES_CACHE_TTL_MS = 15 * 60 * 1000L; // 15 minutes

    public List<PopularCityDTO> getPopularCities(int limit) {
        int effectiveLimit = limit > 0 ? Math.min(limit, 50) : 10;
        long now = System.currentTimeMillis();
        List<PopularCityDTO> cached = popularCitiesCache;
        if (cached != null && (now - lastPopularCitiesCacheTime) < POPULAR_CITIES_CACHE_TTL_MS) {
            return cached.stream().limit(effectiveLimit).collect(Collectors.toList());
        }
        synchronized (this) {
            cached = popularCitiesCache;
            if (cached != null && (System.currentTimeMillis() - lastPopularCitiesCacheTime) < POPULAR_CITIES_CACHE_TTL_MS) {
                return cached.stream().limit(effectiveLimit).collect(Collectors.toList());
            }
            List<PopularCityProjection> rows = shopRepository.findPopularCities();
            List<PopularCityDTO> freshList = rows.stream()
                    .map(r -> PopularCityDTO.builder()
                            .cityName(r.getCityName())
                            .stateName(r.getStateName())
                            .activeBakeryCount(r.getActiveBakeryCount())
                            .build())
                    .collect(Collectors.toList());
            popularCitiesCache = freshList;
            lastPopularCitiesCacheTime = System.currentTimeMillis();
            return freshList.stream().limit(effectiveLimit).collect(Collectors.toList());
        }
    }

    public Page<StorefrontShopSummaryDTO> discoverShopsPaged(
            String country,
            String state,
            String district,
            String city,
            String area,
            String pincode,
            BusinessType businessType,
            String search,
            String location,
            Double latitude,
            Double longitude,
            Double radiusKm,
            String sortBy,
            int page,
            int size
    ) {
        int effectivePage = Math.max(0, page);
        int effectiveSize = (size > 0) ? Math.min(size, 100) : 20;
        int offset = effectivePage * effectiveSize;

        String cleanCity = cleanParam(city);
        String cleanState = cleanParam(state);
        String cleanDistrict = cleanParam(district);
        String cleanArea = cleanParam(area);
        String cleanPincode = cleanParam(pincode);
        String cleanSearch = cleanParam(search);
        String cleanLocation = cleanParam(location);
        String businessTypeStr = businessType != null ? businessType.name() : null;

        if (latitude != null && longitude != null) {
            double effectiveRadius = (radiusKm != null && radiusKm > 0) ? Math.min(radiusKm, 100.0) : 10.0;
            double latDelta = effectiveRadius / 111.0;
            double cosLat = Math.cos(Math.toRadians(latitude));
            if (cosLat < 0.0001) cosLat = 0.0001;
            double lngDelta = effectiveRadius / (111.0 * cosLat);
            double minLat = latitude - latDelta;
            double maxLat = latitude + latDelta;
            double minLng = longitude - lngDelta;
            double maxLng = longitude + lngDelta;

            String cleanSortBy = (sortBy != null && !sortBy.isBlank()) ? sortBy.trim().toLowerCase() : "distance";

            List<ShopSummaryProjection> projections;
            if ("newest".equals(cleanSortBy)) {
                projections = shopRepository.findNearbyActiveShopsOrderByNewest(
                        latitude, longitude, minLat, maxLat, minLng, maxLng, effectiveRadius,
                        cleanCity, cleanState, cleanDistrict, cleanArea, cleanPincode,
                        businessTypeStr, cleanSearch, effectiveSize, offset
                );
            } else if ("rating".equals(cleanSortBy)) {
                projections = shopRepository.findNearbyActiveShopsOrderByRating(
                        latitude, longitude, minLat, maxLat, minLng, maxLng, effectiveRadius,
                        cleanCity, cleanState, cleanDistrict, cleanArea, cleanPincode,
                        businessTypeStr, cleanSearch, effectiveSize, offset
                );
            } else {
                projections = shopRepository.findNearbyActiveShopsOrderByDistance(
                        latitude, longitude, minLat, maxLat, minLng, maxLng, effectiveRadius,
                        cleanCity, cleanState, cleanDistrict, cleanArea, cleanPincode,
                        businessTypeStr, cleanSearch, effectiveSize, offset
                );
            }

            long total = shopRepository.countNearbyActiveShops(
                    latitude, longitude, minLat, maxLat, minLng, maxLng, effectiveRadius,
                    cleanCity, cleanState, cleanDistrict, cleanArea, cleanPincode,
                    businessTypeStr, cleanSearch
            );

            List<StorefrontShopSummaryDTO> content = projections.stream()
                    .map(this::mapProjectionToSummaryDTO)
                    .collect(Collectors.toList());
            return new PageImpl<>(content, PageRequest.of(effectivePage, effectiveSize), total);
        } else {
            String cleanSortBy = (sortBy != null && !sortBy.isBlank()) ? sortBy.trim().toLowerCase() : "rating";

            List<ShopSummaryProjection> projections;
            if ("newest".equals(cleanSortBy)) {
                projections = shopRepository.findActiveShopsWithSummaryOrderByNewest(
                        cleanCity, cleanState, cleanDistrict, cleanArea, cleanPincode,
                        businessTypeStr, cleanSearch, cleanLocation, effectiveSize, offset
                );
            } else {
                projections = shopRepository.findActiveShopsWithSummaryOrderByRating(
                        cleanCity, cleanState, cleanDistrict, cleanArea, cleanPincode,
                        businessTypeStr, cleanSearch, cleanLocation, effectiveSize, offset
                );
            }
            
            long total = shopRepository.countActiveShops(
                    cleanCity, cleanState, cleanDistrict, cleanArea, cleanPincode,
                    businessTypeStr, cleanSearch, cleanLocation
            );

            List<StorefrontShopSummaryDTO> content = projections.stream()
                    .map(this::mapProjectionToSummaryDTO)
                    .collect(Collectors.toList());
            return new PageImpl<>(content, PageRequest.of(effectivePage, effectiveSize), total);
        }
    }

    public List<StorefrontShopSummaryDTO> discoverShops(
            String country,
            String state,
            String district,
            String city,
            String area,
            String pincode,
            BusinessType businessType,
            String search,
            String location,
            Double latitude,
            Double longitude,
            Double radiusKm,
            String sortBy
    ) {
        return discoverShops(country, state, district, city, area, pincode, businessType,
                search, location, latitude, longitude, radiusKm, sortBy, null);
    }

    public List<StorefrontShopSummaryDTO> discoverShops(
            String country,
            String state,
            String district,
            String city,
            String area,
            String pincode,
            BusinessType businessType,
            String search,
            String location,
            Double latitude,
            Double longitude,
            Double radiusKm,
            String sortBy,
            Integer size
    ) {
        int effectiveSize = (size != null && size > 0) ? Math.min(size, 100) : 100;
        Page<StorefrontShopSummaryDTO> page = discoverShopsPaged(
                country, state, district, city, area, pincode, businessType,
                search, location, latitude, longitude, radiusKm, sortBy, 0, effectiveSize
        );
        return page.getContent();
    }

    private StorefrontShopSummaryDTO mapProjectionToSummaryDTO(ShopSummaryProjection p) {
        BusinessType bType = null;
        if (p.getBusinessType() != null) {
            try {
                bType = BusinessType.valueOf(p.getBusinessType());
            } catch (Exception ignored) {}
        }
        VerificationStatus vStatus = null;
        if (p.getVerificationStatus() != null) {
            try {
                vStatus = VerificationStatus.valueOf(p.getVerificationStatus());
            } catch (Exception ignored) {}
        }

        Double distanceKm = p.getDistanceKm();
        if (distanceKm != null) {
            distanceKm = Math.round(distanceKm * 100.0) / 100.0;
        }

        Double avgRating = p.getAvgRating();
        if (avgRating != null) {
            avgRating = Math.round(avgRating * 10.0) / 10.0;
        }

        boolean hideStreet = false;
        if (p.getHideStreetAddress() != null) {
            hideStreet = Boolean.TRUE.equals(p.getHideStreetAddress());
        } else if (shopStorefrontSettingsRepository != null) {
            hideStreet = shopStorefrontSettingsRepository.findByShopId(p.getId())
                    .map(s -> Boolean.TRUE.equals(s.getHideStreetAddress()))
                    .orElse(false);
        }
        return StorefrontShopSummaryDTO.builder()

                .id(p.getId())
                .businessName(p.getBusinessName())
                .description(p.getDescription())
                .businessType(bType)
                .businessCategory(p.getBusinessCategory())
                .logoUrl(p.getLogoUrl())
                .coverImageUrl(p.getCoverImageUrl())
                .address(hideStreet ? null : p.getAddress())
                .addressLine1(hideStreet ? null : p.getAddressLine1())
                .addressLine2(hideStreet ? null : p.getAddressLine2())
                .area(p.getArea())
                .city(p.getCity())
                .district(p.getDistrict())
                .state(p.getState())
                .pincode(p.getPincode())
                .country("India")
                .latitude(hideStreet ? null : p.getLatitude())
                .longitude(hideStreet ? null : p.getLongitude())
                .distanceKm(distanceKm)
                .status(p.getStatus())
                .verificationStatus(vStatus)
                .averageRating(avgRating)
                .totalReviews(p.getTotalReviews() != null ? p.getTotalReviews() : 0L)
                .isPureVeg(false)
                .build();

    }

    private String cleanParam(String val) {
        if (val == null) return null;
        String trimmed = val.trim();
        if (trimmed.isEmpty() || isAllFilter(trimmed)) {
            return null;
        }
        return trimmed;
    }

    private boolean isAllFilter(String value) {
        String trimmed = value.trim().toLowerCase();
        return trimmed.equals("all") || trimmed.startsWith("all ");
    }

    public List<com.cakeplatform.api.modules.product.dto.CategoryResponse> getShopCategories(Long shopId) {
        getActiveShop(shopId);
        return categoryRepository.findNonEmptyByShopId(shopId);
    }

    private StorefrontShopResponse mapToStorefrontShopResponse(Shop shop) {
        StorefrontShopResponse response = new StorefrontShopResponse();
        response.setId(shop.getId());
        response.setBusinessName(shop.getBusinessName());
        response.setDescription(shop.getDescription());
        response.setBusinessCategory(shop.getBusinessCategory());
        response.setBusinessType(shop.getBusinessType());
        response.setLogoUrl(shop.getLogoUrl());
        response.setCoverImageUrl(shop.getCoverImageUrl());
        response.setPhone(shop.getPhone());
        response.setAddress(shop.getAddress());
        response.setArea(shop.getArea());
        response.setCity(shop.getCity());
        response.setDistrict(shop.getDistrict());
        response.setState(shop.getState());
        response.setPincode(shop.getPincode());
        response.setLatitude(shop.getLatitude());
        response.setLongitude(shop.getLongitude());
        response.setStatus(shop.getStatus() != null ? shop.getStatus().name() : null);
        response.setYearsInBusiness(shop.getYearsInBusiness());
        response.setFssaiRegistration(shop.getFssaiRegistration());
        response.setVerificationStatus(shop.getVerificationStatus() != null ? shop.getVerificationStatus().name() : null);
        response.setInactiveReason(shop.getInactiveReason());

        // Extended Shop Info
        response.setAddressLine1(shop.getAddressLine1());
        response.setAddressLine2(shop.getAddressLine2());
        response.setEmail(shop.getEmail());
        response.setAboutStory(shop.getAboutStory());
        response.setAboutImageUrl(shop.getAboutImageUrl());
        response.setShowAboutImage(shop.getShowAboutImage());
        response.setWhatsappNumber(shop.getWhatsappNumber());
        response.setMapLocationUrl(shop.getMapLocationUrl());

        // Computed Real Feedback / Rating
        if (feedbackRepository != null) {
            Double avgRating = feedbackRepository.calculateAverageRatingByShopId(shop.getId());
            Long totalReviews = feedbackRepository.countApprovedByShopId(shop.getId());
            response.setAverageRating(avgRating != null ? Math.round(avgRating * 10.0) / 10.0 : null);
            response.setTotalReviews(totalReviews != null ? totalReviews : 0L);
        } else {
            response.setAverageRating(null);
            response.setTotalReviews(0L);
        }

        // Storefront Components & Toggles
        if (shopBannerRepository != null) {
            response.setBanners(shopBannerRepository.findByShopIdAndIsActiveTrueOrderByDisplayOrderAsc(shop.getId()));
        }
        if (shopBusinessHoursRepository != null) {
            response.setBusinessHours(shopBusinessHoursRepository.findByShopId(shop.getId()));
        }
        if (shopDeliveryConfigRepository != null) {
            response.setDeliveryConfig(shopDeliveryConfigRepository.findByShopId(shop.getId()).orElse(null));
        }
        com.cakeplatform.api.modules.shop.ShopStorefrontSettings ss = null;
        if (shopStorefrontSettingsRepository != null) {
            ss = shopStorefrontSettingsRepository.findByShopId(shop.getId()).orElse(null);
            response.setStorefrontSettings(ss);
        }
        if (ss != null && Boolean.TRUE.equals(ss.getHideStreetAddress())) {
            response.setAddress(null);
            response.setAddressLine1(null);
            response.setAddressLine2(null);
            response.setMapLocationUrl(null);
            response.setLatitude(null);
            response.setLongitude(null);
        }

        if (shopCustomFormFieldRepository != null) {
            response.setCustomCakeFormFields(shopCustomFormFieldRepository.findByShopIdAndIsEnabledTrueOrderByDisplayOrderAsc(shop.getId()));
        }

        // Active Social & External Links
        if (shopSocialLinkRepository != null) {
            List<com.cakeplatform.api.modules.shop.ShopSocialLink> activeLinks =
                    shopSocialLinkRepository.findByShopIdAndIsActiveTrueOrderByDisplayOrderAsc(shop.getId());
            response.setSocialLinks(activeLinks.stream().map(link -> com.cakeplatform.api.modules.shop.dto.ShopSocialLinkResponse.builder()
                    .id(link.getId())
                    .platform(link.getPlatform())
                    .title(link.getTitle())
                    .url(link.getUrl())
                    .iconKey(link.getIconKey())
                    .displayOrder(link.getDisplayOrder())
                    .isActive(link.getIsActive())
                    .createdAt(link.getCreatedAt())
                    .updatedAt(link.getUpdatedAt())
                    .build()).collect(Collectors.toList()));
        } else {
            response.setSocialLinks(java.util.Collections.emptyList());
        }

        return response;
    }



    public List<StorefrontDeliverySlotResponse> getShopDeliverySlots(Long shopId, java.time.LocalDate deliveryDate) {
        Shop shop = getActiveShop(shopId);
        List<com.cakeplatform.api.modules.shop.ShopDeliverySlot> slots = shop.getDeliverySlots();
        if (slots == null || slots.isEmpty()) {
            slots = deliverySlotRepository.findByShopIdAndIsActiveTrue(shopId);
        }

        return slots.stream()
                .filter(com.cakeplatform.api.modules.shop.ShopDeliverySlot::getIsActive)
                .map(slot -> {
                    StorefrontDeliverySlotResponse response = new StorefrontDeliverySlotResponse();
                    response.setId(slot.getId());
                    response.setDayOfWeek(slot.getDayOfWeek());
                    response.setStartTime(slot.getStartTime());
                    response.setEndTime(slot.getEndTime());
                    int max = slot.getMaxOrders() != null ? slot.getMaxOrders() : 10;
                    response.setMaxOrders(max);

                    if (deliveryDate != null) {
                        long booked = orderRepository.countActiveOrdersForSlotAndDate(slot.getId(), deliveryDate);
                        int remaining = (int) Math.max(0, max - booked);
                        response.setBookedOrders((int) booked);
                        response.setRemainingCapacity(remaining);
                        response.setAvailable(remaining > 0);
                    } else {
                        response.setAvailable(true);
                        response.setRemainingCapacity(max);
                        response.setBookedOrders(0);
                    }
                    return response;
                })
                .collect(Collectors.toList());
    }

    public List<StorefrontDeliverySlotResponse> getShopDeliverySlots(Long shopId) {
        return getShopDeliverySlots(shopId, null);
    }

    @Transactional(readOnly = true)
    @org.springframework.cache.annotation.Cacheable(value = "shopProducts", key = "#shopId", condition = "#root.target.isShopSubscriptionValid(#shopId)")
    public List<Product> getShopProducts(Long shopId) {
        // Enforce active shop check
        getActiveShop(shopId);
        
        // Return only active products for the storefront
        List<Product> products = productRepository.findByShopId(shopId).stream()
                .filter(p -> p.getAvailability() && "ACTIVE".equals(p.getStatus()))
                .collect(Collectors.toList());
                
        // Initialize lazy collections to avoid LazyInitializationException during JSON serialization
        for (Product p : products) {
            if (p.getVariants() != null) p.getVariants().size();
            if (p.getAddons() != null) p.getAddons().size();
        }
        
        return products;
    }

    @Transactional(readOnly = true)
    public List<Product> getTopRatedProducts(Long shopId, int limit) {
        getActiveShop(shopId);
        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(0, limit > 0 ? limit : 8);
        List<Product> products = productRepository.findTopRatedProducts(shopId, pageable);
        
        for (Product p : products) {
            if (p.getVariants() != null) p.getVariants().size();
            if (p.getAddons() != null) p.getAddons().size();
        }
        
        return products;
    }

    @Transactional
    public Order placeGuestOrder(Long shopId, GuestOrderRequest request) {
        Shop shop = getActiveShop(shopId);

        if (request.getDeliveryDate() == null) {
            throw new IllegalArgumentException("Delivery date is required");
        }
        if (request.getDeliveryDate().isBefore(java.time.LocalDate.now())) {
            throw new IllegalArgumentException("Delivery date cannot be in the past");
        }
        
        com.cakeplatform.api.modules.shop.ShopDeliverySlot slot = null;
        if (request.getDeliverySlotId() != null) {
            // Pessimistic Row Lock with strict tenant isolation: locks slot row for (slotId, shopId)
            if (deliverySlotRepository != null) {
                slot = deliverySlotRepository.findByIdAndShopIdWithLock(request.getDeliverySlotId(), shopId).orElse(null);
            }
            if (slot == null && shop.getDeliverySlots() != null) {
                slot = shop.getDeliverySlots().stream()
                        .filter(s -> s.getId() != null && s.getId().equals(request.getDeliverySlotId())
                                && (s.getShop() == null || s.getShop().getId() == null || s.getShop().getId().equals(shopId)))
                        .findFirst().orElse(null);
            }
            if (slot == null) {
                throw new IllegalArgumentException("Delivery slot not found or does not belong to this shop");
            }

            if (!Boolean.TRUE.equals(slot.getIsActive())) {
                throw new IllegalArgumentException("Selected delivery slot is currently inactive");
            }

            // Validate day of week match (if slot specifies a day other than EVERYDAY/ALL)
            String slotDay = slot.getDayOfWeek();
            if (slotDay != null && !slotDay.equalsIgnoreCase("EVERYDAY") && !slotDay.equalsIgnoreCase("ALL")) {
                String requestedDay = request.getDeliveryDate().getDayOfWeek().name();
                if (!slotDay.equalsIgnoreCase(requestedDay)) {
                    throw new IllegalArgumentException("Delivery slot is for " + slotDay + ", but selected date is a " + requestedDay);
                }
            }

            // Authoritative database check under row lock
            long bookedCount = (orderRepository != null && slot.getId() != null)
                    ? orderRepository.countActiveOrdersForSlotAndDate(slot.getId(), request.getDeliveryDate())
                    : 0;
            int maxOrders = slot.getMaxOrders() != null ? slot.getMaxOrders() : 10;
            if (bookedCount >= maxOrders) {
                throw new com.cakeplatform.api.exception.DeliverySlotFullException(
                        "This delivery slot is fully booked. Please select another slot."
                );
            }
        }

        boolean isOnlinePayment = "ONLINE_PAYMENT".equalsIgnoreCase(request.getPaymentMethod())
                || "RAZORPAY".equalsIgnoreCase(request.getPaymentMethod());

        Order order = new Order();
        order.setShop(shop);
        order.setCustomerName(request.getCustomerName());
        order.setCustomerEmail(request.getCustomerEmail());
        order.setCustomerPhone(request.getCustomerPhone());

        // Hydrate/Link Order to Customer Account
        if (userRepository != null) {
            String normalizedPhone = com.cakeplatform.api.modules.auth.service.AuthService.normalizeIndianMobile(request.getCustomerPhone());
            if (normalizedPhone != null) {
                userRepository.findByMobile(normalizedPhone).ifPresent(order::setCustomer);
            }
        }

        order.setDeliveryAddress(request.getDeliveryAddress());
        order.setSpecialInstructions(request.getSpecialInstructions());
        order.setPaymentMethod(request.getPaymentMethod());
        order.setOrderNumber("ORD-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        order.setPaymentStatus("PENDING");
        order.setOrderStatus(isOnlinePayment ? "PAYMENT_PENDING" : "NEW");
        order.setDeliveryDate(request.getDeliveryDate());
        order.setDeliverySlot(slot);

        BigDecimal subtotal = BigDecimal.ZERO;

        for (StorefrontOrderItem itemRequest : request.getItems()) {
            Product product = productRepository.findByIdAndShopId(itemRequest.getProductId(), shopId)
                    .orElseThrow(() -> new RuntimeException("Product not found or does not belong to shop"));

            if (!product.getAvailability() || !"ACTIVE".equals(product.getStatus())) {
                throw new RuntimeException("Product " + product.getName() + " is currently unavailable");
            }
            
            BigDecimal basePrice = product.getPrice();
            String variantName = null;
            
            com.cakeplatform.api.modules.product.ProductVariant selectedVariant = null;
            if (itemRequest.getVariantId() != null) {
                selectedVariant = product.getVariants().stream()
                    .filter(v -> v.getId().equals(itemRequest.getVariantId()) && v.getIsAvailable())
                    .findFirst()
                    .orElseThrow(() -> new RuntimeException("Variant unavailable"));
                basePrice = selectedVariant.getPrice();
                variantName = selectedVariant.getName();
            }
            
            // Addon processing
            BigDecimal addonsTotal = BigDecimal.ZERO;
            StringBuilder addonsSummary = new StringBuilder();
            if (itemRequest.getAddonIds() != null && !itemRequest.getAddonIds().isEmpty()) {
                for (Long addonId : itemRequest.getAddonIds()) {
                    com.cakeplatform.api.modules.product.ProductAddon addon = product.getAddons().stream()
                        .filter(a -> a.getId().equals(addonId) && a.getIsAvailable())
                        .findFirst()
                        .orElseThrow(() -> new RuntimeException("Addon unavailable"));
                    addonsTotal = addonsTotal.add(addon.getPrice());
                    if (addonsSummary.length() > 0) addonsSummary.append(", ");
                    addonsSummary.append(addon.getName()).append(" (+₹").append(addon.getPrice()).append(")");
                }
            }

            // Dietary upcharge: real database-backed product pricing
            BigDecimal dietaryUpcharge = BigDecimal.ZERO;
            if (Boolean.TRUE.equals(product.getAllowEggChoice())
                    && "EGGLESS".equalsIgnoreCase(itemRequest.getDietaryPreference())
                    && product.getEgglessPriceDiff() != null) {
                dietaryUpcharge = product.getEgglessPriceDiff();
            } else if ("GLUTEN_FREE".equalsIgnoreCase(itemRequest.getDietaryPreference())) {
                dietaryUpcharge = BigDecimal.valueOf(10.00);
            }

            OrderItem orderItem = new OrderItem();
            orderItem.setOrder(order);
            orderItem.setProduct(product);
            orderItem.setProductNameSnapshot(product.getName());
            
            BigDecimal unitPrice = basePrice.add(addonsTotal).add(dietaryUpcharge);
            orderItem.setUnitPrice(unitPrice);
            orderItem.setQuantity(itemRequest.getQuantity());
            
            orderItem.setVariantName(variantName);
            orderItem.setDietaryPreference(itemRequest.getDietaryPreference());
            orderItem.setCakeMessage(itemRequest.getCakeMessage());
            orderItem.setPhotoReferenceUrl(itemRequest.getPhotoReferenceUrl());
            orderItem.setAddonsSummary(addonsSummary.toString());

            // Variant-aware snapshotting of image and original price
            String itemImageUrl = (selectedVariant != null && selectedVariant.getImageUrl() != null && !selectedVariant.getImageUrl().trim().isEmpty())
                    ? selectedVariant.getImageUrl()
                    : product.getImageUrl();
            orderItem.setProductImageUrl(itemImageUrl);

            BigDecimal itemOriginalPrice = (selectedVariant != null && selectedVariant.getOriginalPrice() != null)
                    ? selectedVariant.getOriginalPrice()
                    : product.getOriginalPrice();
            orderItem.setOriginalPrice(itemOriginalPrice);

            BigDecimal itemTotal = unitPrice.multiply(BigDecimal.valueOf(itemRequest.getQuantity()));
            orderItem.setTotalPrice(itemTotal);
            subtotal = subtotal.add(itemTotal);

            order.getItems().add(orderItem);
        }

        order.setSubtotal(subtotal);

        // Authoritative Delivery Charge Calculation from shop_delivery_configs
        BigDecimal calculatedDeliveryCharge = BigDecimal.valueOf(50.00); // Default fallback
        com.cakeplatform.api.modules.shop.ShopDeliveryConfig deliveryConfig = (shopDeliveryConfigRepository != null)
                ? shopDeliveryConfigRepository.findByShopId(shopId).orElse(null)
                : null;
        if (deliveryConfig != null) {
            if ("FREE".equalsIgnoreCase(deliveryConfig.getDeliveryChargeType())) {
                calculatedDeliveryCharge = BigDecimal.ZERO;
            } else if ("FIXED".equalsIgnoreCase(deliveryConfig.getDeliveryChargeType())) {
                calculatedDeliveryCharge = deliveryConfig.getFixedChargeAmount() != null ? deliveryConfig.getFixedChargeAmount() : BigDecimal.ZERO;
                if (deliveryConfig.getMinOrderForFreeDelivery() != null 
                        && subtotal.compareTo(deliveryConfig.getMinOrderForFreeDelivery()) >= 0) {
                    calculatedDeliveryCharge = BigDecimal.ZERO;
                }
            }
        }
        order.setDeliveryCharge(calculatedDeliveryCharge);
        
        BigDecimal discount = BigDecimal.ZERO;
        
        // Coupon Validation & Atomic Concurrency Update
        if (request.getCouponCode() != null && !request.getCouponCode().isBlank()) {
            String cleanCode = request.getCouponCode().trim().toUpperCase();
            com.cakeplatform.api.modules.shop.Coupon coupon = couponRepository.findByShopIdAndCodeIgnoreCase(shopId, cleanCode)
                .orElseThrow(() -> new RuntimeException("Invalid coupon code"));
                
            if (!Boolean.TRUE.equals(coupon.getIsActive())) {
                throw new RuntimeException("Coupon is inactive");
            }
            
            java.time.LocalDateTime now = java.time.LocalDateTime.now();
            if (coupon.getStartDate() != null && coupon.getStartDate().isAfter(now)) {
                throw new RuntimeException("Coupon is not active yet");
            }
            
            if (coupon.getExpiryDate() != null && coupon.getExpiryDate().isBefore(now)) {
                throw new RuntimeException("Coupon has expired");
            }
            
            if (coupon.getMinOrderValue() != null && subtotal.compareTo(coupon.getMinOrderValue()) < 0) {
                throw new RuntimeException("Minimum order value of \u20B9" + coupon.getMinOrderValue().stripTrailingZeros().toPlainString() + " required for this coupon");
            }
            
            // Server-side Authoritative Discount Calculation
            if (coupon.getDiscountType() == com.cakeplatform.api.modules.shop.Coupon.DiscountType.FLAT) {
                discount = coupon.getDiscountValue();
            } else if (coupon.getDiscountType() == com.cakeplatform.api.modules.shop.Coupon.DiscountType.PERCENTAGE) {
                discount = subtotal.multiply(coupon.getDiscountValue()).divide(BigDecimal.valueOf(100), 2, java.math.RoundingMode.HALF_UP);
                if (coupon.getMaxDiscountCap() != null && discount.compareTo(coupon.getMaxDiscountCap()) > 0) {
                    discount = coupon.getMaxDiscountCap();
                }
            }
            
            if (discount.compareTo(subtotal) > 0) {
                discount = subtotal;
            }
            if (discount.compareTo(BigDecimal.ZERO) < 0) {
                discount = BigDecimal.ZERO;
            }

            // Atomic Concurrency Protection: Increment used_count only if within usage_limit
            int updated = couponRepository.incrementUsedCountIfWithinLimit(coupon.getId());
            if (updated == 0) {
                throw new RuntimeException("Coupon usage limit reached");
            }
            
            order.setCouponCode(coupon.getCode());
        }
        
        // Ensure discount doesn't exceed subtotal
        if (discount.compareTo(subtotal) > 0) discount = subtotal;
        if (discount.compareTo(BigDecimal.ZERO) < 0) discount = BigDecimal.ZERO;
        
        order.setDiscountAmount(discount);
        BigDecimal calculatedTotal = subtotal.subtract(discount).add(order.getDeliveryCharge());
        if (calculatedTotal.compareTo(BigDecimal.ZERO) < 0) {
            calculatedTotal = BigDecimal.ZERO;
        }
        order.setTotalAmount(calculatedTotal);

        Order savedOrder = orderRepository.save(order);

        // Send Notification to Owner (Only for COD orders upon placement; Online orders are notified upon successful payment verification)
        if (!isOnlinePayment && notificationService != null && shop.getOwner() != null) {
            try {
                notificationService.createNotification(
                        shop.getOwner(),
                        com.cakeplatform.api.modules.notification.NotificationType.NEW_ORDER,
                        "New Order Received!",
                        "You have received a new order (" + savedOrder.getOrderNumber() + ") from " + savedOrder.getCustomerName(),
                        savedOrder.getId() != null ? savedOrder.getId().toString() : "0",
                        true
                );
            } catch (Exception ignored) {
                // Safe failure isolation
            }
        }

        // Admin notification for individual bakery orders is suppressed per platform policy;
        // platform administrators monitor aggregated bakery performance via the Analytics Dashboard.
        
        // Send SMS to Customer (Only for COD orders upon placement)
        if (!isOnlinePayment) {
            try {
                org.springframework.web.context.request.RequestAttributes attrs = org.springframework.web.context.request.RequestContextHolder.getRequestAttributes();
                if (attrs instanceof org.springframework.web.context.request.ServletRequestAttributes servletAttrs) {
                    com.cakeplatform.api.modules.notification.SmsService smsService = org.springframework.web.context.support.WebApplicationContextUtils
                        .getRequiredWebApplicationContext(servletAttrs.getRequest().getServletContext())
                        .getBean(com.cakeplatform.api.modules.notification.SmsService.class);
                    if (smsService != null) {
                        smsService.sendSms(savedOrder.getCustomerPhone(), "Hi " + savedOrder.getCustomerName() + ", your Cake Platform order " + savedOrder.getOrderNumber() + " has been received! 🎂");
                    }
                }
            } catch (Exception ignored) {
                // Non-blocking SMS dispatch
            }
        }

        return savedOrder;
    }

    public Order getGuestOrder(String orderNumber) {
        return orderRepository.findByOrderNumber(orderNumber)
                .orElseThrow(() -> new RuntimeException("Order not found or invalid order number"));
    }

    @Transactional(readOnly = true)
    public Product getShopProductDetails(Long shopId, Long productId) {
        Shop shop = getActiveShop(shopId);
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new RuntimeException("Product not found"));

        if (product.getShop() == null || !product.getShop().getId().equals(shop.getId())) {
            throw new RuntimeException("Product does not belong to this bakery");
        }

        if (!Boolean.TRUE.equals(product.getAvailability()) || !"ACTIVE".equalsIgnoreCase(product.getStatus())) {
            throw new RuntimeException("Product is currently unavailable");
        }

        if (product.getVariants() != null) product.getVariants().size();
        if (product.getAddons() != null) product.getAddons().size();

        return product;
    }

    @Transactional
    public com.cakeplatform.api.modules.interaction.CustomCakeRequest submitProductEnquiry(com.cakeplatform.api.modules.storefront.dto.ProductEnquiryRequest request) {
        Shop shop = getActiveShop(request.getShopId());

        Product product = productRepository.findById(request.getProductId())
                .orElseThrow(() -> new RuntimeException("Product not found"));

        if (product.getShop() == null || !product.getShop().getId().equals(shop.getId())) {
            throw new RuntimeException("Product does not belong to this bakery");
        }

        if (!Boolean.TRUE.equals(product.getAvailability()) || !"ACTIVE".equalsIgnoreCase(product.getStatus())) {
            throw new RuntimeException("Product is currently unavailable");
        }

        com.cakeplatform.api.modules.interaction.CustomCakeRequest cakeRequest = new com.cakeplatform.api.modules.interaction.CustomCakeRequest();
        cakeRequest.setShop(shop);
        cakeRequest.setCustomerName(request.getCustomerName().trim());
        cakeRequest.setCustomerEmail(request.getCustomerEmail().trim());
        cakeRequest.setCustomerMobile(request.getCustomerPhone().trim());
        cakeRequest.setCakeType(product.getName());
        int servings = request.getQuantity() != null && request.getQuantity() > 0 ? request.getQuantity() : 1;
        cakeRequest.setServings(servings);
        if (product.getPrice() != null) {
            cakeRequest.setBudget(product.getPrice().multiply(BigDecimal.valueOf(servings)));
        }
        cakeRequest.setRequiredDate(request.getPreferredDate());
        cakeRequest.setReferenceImageUrl(product.getImageUrl());

        StringBuilder noteBuilder = new StringBuilder();
        noteBuilder.append("Product Enquiry for '").append(product.getName()).append("' (Product ID: ").append(product.getId()).append(")");
        if (request.getMessage() != null && !request.getMessage().isBlank()) {
            noteBuilder.append("\nCustomer Note: ").append(request.getMessage().trim());
        }
        cakeRequest.setDesignDescription(noteBuilder.toString());
        cakeRequest.setStatus("PENDING");

        com.cakeplatform.api.modules.interaction.CustomCakeRequest saved = customCakeRequestRepository.save(cakeRequest);

        if (notificationService != null && shop.getOwner() != null) {
            try {
                notificationService.createNotification(
                        shop.getOwner(),
                        com.cakeplatform.api.modules.notification.NotificationType.CUSTOM_ORDER_REQUEST,
                        "Product Cake Enquiry",
                        "New enquiry received for '" + product.getName() + "' from " + request.getCustomerName(),
                        saved.getId() != null ? saved.getId().toString() : "0",
                        true
                );
            } catch (Exception ignored) {
                // Do not abort customer enquiry if owner notification dispatch fails
            }
        }

        return saved;
    }

    public ValidateCouponResponse validateCouponForStorefront(Long shopId, ValidateCouponRequest request) {
        if (request == null || request.getCode() == null || request.getCode().isBlank()) {
            return ValidateCouponResponse.builder()
                    .valid(false)
                    .message("Coupon code is required")
                    .discountAmount(BigDecimal.ZERO)
                    .build();
        }

        getActiveShop(shopId);

        BigDecimal subtotal = request.getSubtotal() != null ? request.getSubtotal() : BigDecimal.ZERO;
        String cleanCode = request.getCode().trim().toUpperCase();

        var couponOpt = couponRepository.findByShopIdAndCodeIgnoreCase(shopId, cleanCode);
        if (couponOpt.isEmpty()) {
            return ValidateCouponResponse.builder()
                    .valid(false)
                    .code(cleanCode)
                    .discountAmount(BigDecimal.ZERO)
                    .message("Invalid coupon code")
                    .build();
        }

        com.cakeplatform.api.modules.shop.Coupon coupon = couponOpt.get();

        if (!Boolean.TRUE.equals(coupon.getIsActive())) {
            return ValidateCouponResponse.builder()
                    .valid(false)
                    .code(coupon.getCode())
                    .discountAmount(BigDecimal.ZERO)
                    .message("Coupon is inactive")
                    .build();
        }

        java.time.LocalDateTime now = java.time.LocalDateTime.now();
        if (coupon.getStartDate() != null && coupon.getStartDate().isAfter(now)) {
            return ValidateCouponResponse.builder()
                    .valid(false)
                    .code(coupon.getCode())
                    .discountAmount(BigDecimal.ZERO)
                    .message("Coupon is not active yet")
                    .build();
        }

        if (coupon.getExpiryDate() != null && coupon.getExpiryDate().isBefore(now)) {
            return ValidateCouponResponse.builder()
                    .valid(false)
                    .code(coupon.getCode())
                    .discountAmount(BigDecimal.ZERO)
                    .message("Coupon has expired")
                    .build();
        }

        if (coupon.getUsageLimit() != null && coupon.getUsedCount() >= coupon.getUsageLimit()) {
            return ValidateCouponResponse.builder()
                    .valid(false)
                    .code(coupon.getCode())
                    .discountAmount(BigDecimal.ZERO)
                    .message("Coupon usage limit reached")
                    .build();
        }

        if (coupon.getMinOrderValue() != null && subtotal.compareTo(coupon.getMinOrderValue()) < 0) {
            return ValidateCouponResponse.builder()
                    .valid(false)
                    .code(coupon.getCode())
                    .discountAmount(BigDecimal.ZERO)
                    .minOrderValue(coupon.getMinOrderValue())
                    .message("Minimum order value of \u20B9" + coupon.getMinOrderValue().stripTrailingZeros().toPlainString() + " required")
                    .build();
        }

        BigDecimal discount = BigDecimal.ZERO;
        if (coupon.getDiscountType() == com.cakeplatform.api.modules.shop.Coupon.DiscountType.FLAT) {
            discount = coupon.getDiscountValue();
        } else if (coupon.getDiscountType() == com.cakeplatform.api.modules.shop.Coupon.DiscountType.PERCENTAGE) {
            discount = subtotal.multiply(coupon.getDiscountValue()).divide(BigDecimal.valueOf(100), 2, java.math.RoundingMode.HALF_UP);
            if (coupon.getMaxDiscountCap() != null && discount.compareTo(coupon.getMaxDiscountCap()) > 0) {
                discount = coupon.getMaxDiscountCap();
            }
        }

        if (discount.compareTo(subtotal) > 0) {
            discount = subtotal;
        }
        if (discount.compareTo(BigDecimal.ZERO) < 0) {
            discount = BigDecimal.ZERO;
        }

        BigDecimal newSubtotal = subtotal.subtract(discount);
        if (newSubtotal.compareTo(BigDecimal.ZERO) < 0) {
            newSubtotal = BigDecimal.ZERO;
        }

        return ValidateCouponResponse.builder()
                .valid(true)
                .code(coupon.getCode())
                .discountType(coupon.getDiscountType().name())
                .discountValue(coupon.getDiscountValue())
                .discountAmount(discount)
                .minOrderValue(coupon.getMinOrderValue())
                .maxDiscountCap(coupon.getMaxDiscountCap())
                .newSubtotal(newSubtotal)
                .message("Coupon applied successfully")
                .build();
    }

    public List<com.cakeplatform.api.modules.storefront.dto.PublicCouponResponse> getPublicShopCoupons(Long shopId) {
        getActiveShop(shopId);
        java.time.LocalDateTime now = java.time.LocalDateTime.now();
        List<com.cakeplatform.api.modules.shop.Coupon> coupons = couponRepository.findByShopId(shopId);

        return coupons.stream()
                .filter(c -> Boolean.TRUE.equals(c.getIsActive()))
                .filter(c -> c.getStartDate() == null || !c.getStartDate().isAfter(now))
                .filter(c -> c.getExpiryDate() == null || !c.getExpiryDate().isBefore(now))
                .filter(c -> c.getUsageLimit() == null || c.getUsedCount() < c.getUsageLimit())
                .map(c -> com.cakeplatform.api.modules.storefront.dto.PublicCouponResponse.builder()
                        .code(c.getCode())
                        .discountType(c.getDiscountType())
                        .discountValue(c.getDiscountValue())
                        .minOrderValue(c.getMinOrderValue())
                        .maxDiscountCap(c.getMaxDiscountCap())
                        .expiryDate(c.getExpiryDate())
                        .build())
                .collect(java.util.stream.Collectors.toList());
    }
}
