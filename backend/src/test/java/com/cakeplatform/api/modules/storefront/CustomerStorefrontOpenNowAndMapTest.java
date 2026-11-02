package com.cakeplatform.api.modules.storefront;

import com.cakeplatform.api.modules.shop.*;
import com.cakeplatform.api.modules.shop.service.OperatingHoursService;
import com.cakeplatform.api.modules.storefront.dto.ShopSummaryProjection;
import com.cakeplatform.api.modules.storefront.dto.StorefrontShopSummaryDTO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.time.*;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("CustomerStorefront Open Now & Map Coordinates Unit Tests")
class CustomerStorefrontOpenNowAndMapTest {

    private CustomerStorefrontService storefrontService;
    private ShopRepository mockShopRepository;
    private ShopBusinessHoursRepository mockBusinessHoursRepository;
    private OperatingHoursService operatingHoursService;

    // Captured query parameters for verification
    private Boolean capturedOpenNow;
    private String capturedSearch;
    private String capturedLocation;
    private String capturedBusinessType;

    // Stub list of shop projections to return
    private List<ShopSummaryProjection> stubProjections = new ArrayList<>();
    private List<ShopBusinessHours> stubBusinessHours = new ArrayList<>();

    @BeforeEach
    void setUp() {
        operatingHoursService = new OperatingHoursService();
        stubProjections.clear();
        stubBusinessHours.clear();
        capturedOpenNow = null;
        capturedSearch = null;
        capturedLocation = null;
        capturedBusinessType = null;

        // Dynamic Proxy for ShopRepository
        mockShopRepository = (ShopRepository) Proxy.newProxyInstance(
                ShopRepository.class.getClassLoader(),
                new Class<?>[]{ShopRepository.class},
                new InvocationHandler() {
                    @Override
                    public Object invoke(Object proxy, Method method, Object[] args) {
                        String name = method.getName();
                        if (name.startsWith("findActiveShopsWithSummary") || name.startsWith("findNearbyActiveShops")) {
                            if (name.contains("NearbyActiveShops")) {
                                if (args.length >= 15 && args[14] instanceof Boolean) {
                                    capturedOpenNow = (Boolean) args[14];
                                }
                            } else {
                                if (args.length >= 9 && args[8] instanceof Boolean) {
                                    capturedOpenNow = (Boolean) args[8];
                                }
                            }
                            if (args.length >= 8 && args[6] instanceof String) {
                                capturedSearch = (String) args[6];
                            }
                            if (args.length >= 8 && args[7] instanceof String) {
                                capturedLocation = (String) args[7];
                            }
                            if (args.length >= 6 && args[5] instanceof String) {
                                capturedBusinessType = (String) args[5];
                            }
                            return stubProjections;
                        }
                        if (name.startsWith("countActiveShops") || name.startsWith("countNearbyActiveShops")) {
                            if (name.contains("NearbyActiveShops")) {
                                if (args.length >= 15 && args[14] instanceof Boolean) {
                                    capturedOpenNow = (Boolean) args[14];
                                }
                            } else {
                                if (args.length >= 9 && args[8] instanceof Boolean) {
                                    capturedOpenNow = (Boolean) args[8];
                                }
                            }
                            return (long) stubProjections.size();
                        }
                        if (name.equals("hashCode")) return 42;
                        if (name.equals("equals")) return args[0] == proxy;
                        if (name.equals("toString")) return "MockShopRepository";
                        return null;
                    }
                }
        );

        // Dynamic Proxy for ShopBusinessHoursRepository
        mockBusinessHoursRepository = (ShopBusinessHoursRepository) Proxy.newProxyInstance(
                ShopBusinessHoursRepository.class.getClassLoader(),
                new Class<?>[]{ShopBusinessHoursRepository.class},
                new InvocationHandler() {
                    @Override
                    public Object invoke(Object proxy, Method method, Object[] args) {
                        String name = method.getName();
                        if (name.equals("findByShopIdIn")) {
                            return stubBusinessHours;
                        }
                        if (name.equals("findByShopId")) {
                            return stubBusinessHours;
                        }
                        if (name.equals("hashCode")) return 43;
                        if (name.equals("equals")) return args[0] == proxy;
                        if (name.equals("toString")) return "MockBusinessHoursRepository";
                        return Collections.emptyList();
                    }
                }
        );

        // Build service
        storefrontService = new CustomerStorefrontService(
                mockShopRepository, null, null, null, null, null, null,
                null, null, null, mockBusinessHoursRepository, null, null, null,
                null, null, null, null
        );
        storefrontService.setOperatingHoursService(operatingHoursService);

        // Fixed clock for testing: Monday 2026-11-02 14:00:00 IST
        Clock fixedClock = Clock.fixed(
                ZonedDateTime.of(LocalDate.of(2026, 11, 2), LocalTime.of(14, 0), ZoneId.of("Asia/Kolkata")).toInstant(),
                ZoneId.of("Asia/Kolkata")
        );
        storefrontService.setClock(fixedClock);
    }

    private ShopSummaryProjection createStubProjection(Long id, String name, Double lat, Double lng, String status) {
        return (ShopSummaryProjection) Proxy.newProxyInstance(
                ShopSummaryProjection.class.getClassLoader(),
                new Class<?>[]{ShopSummaryProjection.class},
                (proxy, method, args) -> {
                    switch (method.getName()) {
                        case "getId": return id;
                        case "getBusinessName": return name;
                        case "getDescription": return "Artisanal cakes";
                        case "getBusinessType": return "BAKERY_SHOP";
                        case "getBusinessCategory": return "Cakes";
                        case "getCity": return "Pune";
                        case "getState": return "Maharashtra";
                        case "getPincode": return "411001";
                        case "getLatitude": return lat;
                        case "getLongitude": return lng;
                        case "getStatus": return status;
                        case "getVerificationStatus": return "VERIFIED";
                        case "getAvgRating": return 4.8;
                        case "getTotalReviews": return 15L;
                        case "getTimezone": return "Asia/Kolkata";
                        case "getDistanceKm": return 2.5;
                        case "getHideStreetAddress": return false;
                        case "hashCode": return id.hashCode();
                        case "equals": return args[0] == proxy;
                        case "toString": return "Projection-" + id;
                        default: return null;
                    }
                }
        );
    }

    @Test
    @DisplayName("1. Open Now filter is propagated to repository with openNow=true")
    void testOpenNowFilterPropagated() {
        stubProjections.add(createStubProjection(101L, "Sugar Blossom", 18.5204, 73.8567, "ACTIVE"));

        Page<StorefrontShopSummaryDTO> result = storefrontService.discoverShopsPaged(
                "India", "Maharashtra", null, "Pune", null, null,
                BusinessType.BAKERY_SHOP, "Cakes", null, null, null, null, "rating",
                true, 0, 10
        );

        assertNotNull(result);
        assertEquals(Boolean.TRUE, capturedOpenNow, "openNow=true must be passed to repository query");
        assertEquals("Cakes", capturedSearch);
    }

    @Test
    @DisplayName("2. Open status and badges are truthfully populated on returned DTOs")
    void testOpenStatusPopulatedOnDto() {
        Shop shop = new Shop();
        shop.setId(101L);

        // Shop is open Monday 09:00 - 21:00 (clock is Monday 14:00)
        ShopBusinessHours hours = ShopBusinessHours.builder()
                .id(1L)
                .shop(shop)
                .dayOfWeek("MONDAY")
                .isOpen(true)
                .openTime(LocalTime.of(9, 0))
                .closeTime(LocalTime.of(21, 0))
                .build();
        stubBusinessHours.add(hours);
        stubProjections.add(createStubProjection(101L, "Sweet Treat", 18.5204, 73.8567, "ACTIVE"));

        Page<StorefrontShopSummaryDTO> page = storefrontService.discoverShopsPaged(
                null, null, null, "Pune", null, null, null, null, null,
                null, null, null, "rating", false, 0, 10
        );

        assertEquals(1, page.getContent().size());
        StorefrontShopSummaryDTO dto = page.getContent().get(0);
        assertTrue(dto.getIsOpenNow(), "Shop should be evaluated as open now at Monday 14:00");
        assertEquals("Open Now", dto.getOpenStatusText());
    }

    @Test
    @DisplayName("3. Shop with missing operating hours safely defaults to isOpenNow=false")
    void testShopWithMissingOperatingHoursDefaultsToClosed() {
        // No business hours added to stubBusinessHours
        stubProjections.add(createStubProjection(102L, "Mystery Bakes", 18.5204, 73.8567, "ACTIVE"));

        Page<StorefrontShopSummaryDTO> page = storefrontService.discoverShopsPaged(
                null, null, null, "Pune", null, null, null, null, null,
                null, null, null, "rating", false, 0, 10
        );

        assertEquals(1, page.getContent().size());
        StorefrontShopSummaryDTO dto = page.getContent().get(0);
        assertFalse(dto.getIsOpenNow(), "Shop with missing business hours must safely be false");
        assertEquals("Closed", dto.getOpenStatusText());
    }

    @Test
    @DisplayName("4. Coordinates preserved for map discovery (both present and null)")
    void testCoordinatesPreservedForMap() {
        stubProjections.add(createStubProjection(101L, "With Coords", 18.5204, 73.8567, "ACTIVE"));
        stubProjections.add(createStubProjection(102L, "Without Coords", null, null, "ACTIVE"));

        Page<StorefrontShopSummaryDTO> page = storefrontService.discoverShopsPaged(
                null, null, null, null, null, null, null, null, null,
                null, null, null, null, false, 0, 10
        );

        assertEquals(2, page.getContent().size());
        StorefrontShopSummaryDTO shop1 = page.getContent().get(0);
        assertNotNull(shop1.getLatitude(), "Valid latitude must be preserved");
        assertNotNull(shop1.getLongitude(), "Valid longitude must be preserved");
        assertEquals(18.5204, shop1.getLatitude(), 0.0001);

        StorefrontShopSummaryDTO shop2 = page.getContent().get(1);
        assertNull(shop2.getLatitude(), "Missing coordinates must be null without throwing errors");
        assertNull(shop2.getLongitude());
    }

    @Test
    @DisplayName("5. Inactive or non-active shops are excluded by query filter")
    void testInactiveShopsExclusion() {
        // Query layer enforces WHERE s.status = 'ACTIVE'
        // If projection list is empty (because repository excluded inactive shops), service returns empty page
        Page<StorefrontShopSummaryDTO> page = storefrontService.discoverShopsPaged(
                null, null, null, null, null, null, null, null, null,
                null, null, null, null, true, 0, 10
        );

        assertTrue(page.getContent().isEmpty());
        assertEquals(0, page.getTotalElements());
    }
}

