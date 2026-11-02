package com.cakeplatform.api.modules.storefront;

import com.cakeplatform.api.modules.shop.BusinessType;
import com.cakeplatform.api.modules.shop.ShopBusinessHoursRepository;
import com.cakeplatform.api.modules.shop.ShopRepository;
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
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("CustomerStorefront Dietary Discovery & Smart Filters Unit Tests")
class CustomerStorefrontDietarySearchTest {

    private CustomerStorefrontService storefrontService;
    private ShopRepository mockShopRepository;
    private ShopBusinessHoursRepository mockBusinessHoursRepository;
    private OperatingHoursService operatingHoursService;

    // Captured parameters for verification
    private Boolean capturedEggless;
    private Boolean capturedVegan;
    private Boolean capturedGlutenFree;
    private Boolean capturedOpenNow;
    private String capturedSearch;
    private String capturedLocation;

    private List<ShopSummaryProjection> stubProjections = new ArrayList<>();

    @BeforeEach
    void setUp() {
        operatingHoursService = new OperatingHoursService();
        stubProjections.clear();
        capturedEggless = null;
        capturedVegan = null;
        capturedGlutenFree = null;
        capturedOpenNow = null;
        capturedSearch = null;
        capturedLocation = null;

        mockShopRepository = (ShopRepository) Proxy.newProxyInstance(
                ShopRepository.class.getClassLoader(),
                new Class<?>[]{ShopRepository.class},
                new InvocationHandler() {
                    @Override
                    public Object invoke(Object proxy, Method method, Object[] args) {
                        String name = method.getName();
                        if (name.startsWith("findActiveShopsWithSummary") || name.startsWith("findNearbyActiveShops")) {
                            if (name.contains("NearbyActiveShops")) {
                                // args: lat, lng, minLat, maxLat, minLng, maxLng, radius, city, state, district, area, pincode, businessType, search, openNow, eggless, vegan, glutenFree, limit, offset
                                if (args.length >= 18) {
                                    capturedOpenNow = (Boolean) args[14];
                                    capturedEggless = (Boolean) args[15];
                                    capturedVegan = (Boolean) args[16];
                                    capturedGlutenFree = (Boolean) args[17];
                                }
                            } else {
                                // args: city, state, district, area, pincode, businessType, search, location, openNow, eggless, vegan, glutenFree, limit, offset
                                if (args.length >= 12) {
                                    capturedSearch = (String) args[6];
                                    capturedLocation = (String) args[7];
                                    capturedOpenNow = (Boolean) args[8];
                                    capturedEggless = (Boolean) args[9];
                                    capturedVegan = (Boolean) args[10];
                                    capturedGlutenFree = (Boolean) args[11];
                                }
                            }
                            return stubProjections;
                        }
                        if (name.startsWith("countActiveShops") || name.startsWith("countNearbyActiveShops")) {
                            if (name.contains("NearbyActiveShops")) {
                                if (args.length >= 18) {
                                    capturedOpenNow = (Boolean) args[14];
                                    capturedEggless = (Boolean) args[15];
                                    capturedVegan = (Boolean) args[16];
                                    capturedGlutenFree = (Boolean) args[17];
                                }
                            } else {
                                if (args.length >= 12) {
                                    capturedSearch = (String) args[6];
                                    capturedLocation = (String) args[7];
                                    capturedOpenNow = (Boolean) args[8];
                                    capturedEggless = (Boolean) args[9];
                                    capturedVegan = (Boolean) args[10];
                                    capturedGlutenFree = (Boolean) args[11];
                                }
                            }
                            return (long) stubProjections.size();
                        }
                        if (method.getReturnType().equals(boolean.class)) return false;
                        if (method.getReturnType().equals(long.class)) return 0L;
                        if (method.getReturnType().equals(int.class)) return 0;
                        return null;
                    }
                }
        );

        mockBusinessHoursRepository = (ShopBusinessHoursRepository) Proxy.newProxyInstance(
                ShopBusinessHoursRepository.class.getClassLoader(),
                new Class<?>[]{ShopBusinessHoursRepository.class},
                (proxy, method, args) -> Collections.emptyList()
        );

        storefrontService = new CustomerStorefrontService(
                mockShopRepository, null, null, null, null, null, null,
                null, null, null, mockBusinessHoursRepository, null, null, null,
                null, null, null, null
        );
        storefrontService.setOperatingHoursService(operatingHoursService);
        storefrontService.setClock(Clock.fixed(Instant.parse("2026-11-02T10:00:00Z"), ZoneId.of("UTC")));
    }

    private ShopSummaryProjection createStubProjection(Long id, String name, String city) {
        return (ShopSummaryProjection) Proxy.newProxyInstance(
                ShopSummaryProjection.class.getClassLoader(),
                new Class<?>[]{ShopSummaryProjection.class},
                (proxy, method, args) -> {
                    String m = method.getName();
                    if ("getId".equals(m)) return id;
                    if ("getBusinessName".equals(m)) return name;
                    if ("getCity".equals(m)) return city;
                    if ("getStatus".equals(m)) return "ACTIVE";
                    if ("getVerificationStatus".equals(m)) return "VERIFIED";
                    if ("getTimezone".equals(m)) return "Asia/Kolkata";
                    if ("getAvgRating".equals(m)) return 4.8;
                    if ("getTotalReviews".equals(m)) return 15L;
                    if ("getDistanceKm".equals(m)) return 2.5;
                    return null;
                }
        );
    }

    @Test
    @DisplayName("Should correctly pass single EGGLESS dietary filter to repository")
    void testSingleEgglessFilter() {
        stubProjections.add(createStubProjection(1L, "Pure Eggless Treats", "Mumbai"));

        Page<StorefrontShopSummaryDTO> result = storefrontService.discoverShopsPaged(
                "India", null, null, "Mumbai", null, null, null,
                null, null, null, null, null, "rating", false,
                Collections.singletonList("EGGLESS"), 0, 10
        );

        assertNotNull(result);
        assertEquals(1, result.getContent().size());
        assertTrue(capturedEggless, "requireEggless should be true");
        assertFalse(capturedVegan, "requireVegan should be false");
        assertFalse(capturedGlutenFree, "requireGlutenFree should be false");
    }

    @Test
    @DisplayName("Should correctly pass single VEGAN dietary filter to repository")
    void testSingleVeganFilter() {
        stubProjections.add(createStubProjection(2L, "Green Leaf Vegan Bakes", "Bengaluru"));

        Page<StorefrontShopSummaryDTO> result = storefrontService.discoverShopsPaged(
                "India", null, null, "Bengaluru", null, null, null,
                null, null, null, null, null, "rating", false,
                Collections.singletonList("VEGAN"), 0, 10
        );

        assertNotNull(result);
        assertEquals(1, result.getContent().size());
        assertFalse(capturedEggless, "requireEggless should be false");
        assertTrue(capturedVegan, "requireVegan should be true");
        assertFalse(capturedGlutenFree, "requireGlutenFree should be false");
    }

    @Test
    @DisplayName("Should correctly pass single GLUTEN_FREE dietary filter with hyphen normalization")
    void testSingleGlutenFreeFilterHyphenNormalization() {
        stubProjections.add(createStubProjection(3L, "Gluten-Free Bliss", "Delhi"));

        Page<StorefrontShopSummaryDTO> result = storefrontService.discoverShopsPaged(
                "India", null, null, "Delhi", null, null, null,
                null, null, null, null, null, "rating", false,
                Collections.singletonList("gluten-free"), 0, 10
        );

        assertNotNull(result);
        assertEquals(1, result.getContent().size());
        assertFalse(capturedEggless, "requireEggless should be false");
        assertFalse(capturedVegan, "requireVegan should be false");
        assertTrue(capturedGlutenFree, "requireGlutenFree should be true");
    }

    @Test
    @DisplayName("Should correctly pass multiple combined dietary filters (EGGLESS + VEGAN + GLUTEN_FREE)")
    void testMultipleDietaryFilters() {
        stubProjections.add(createStubProjection(4L, "Holistic Healthy Bakery", "Pune"));

        Page<StorefrontShopSummaryDTO> result = storefrontService.discoverShopsPaged(
                "India", null, null, "Pune", null, null, null,
                null, null, null, null, null, "rating", false,
                Arrays.asList("EGGLESS", "VEGAN", "GLUTEN_FREE"), 0, 10
        );

        assertNotNull(result);
        assertEquals(1, result.getContent().size());
        assertTrue(capturedEggless, "requireEggless should be true");
        assertTrue(capturedVegan, "requireVegan should be true");
        assertTrue(capturedGlutenFree, "requireGlutenFree should be true");
    }

    @Test
    @DisplayName("Should support comma-separated dietary query parameter parsing")
    void testCommaSeparatedDietaryQuery() {
        stubProjections.add(createStubProjection(5L, "Artisan Veg Bakes", "Chennai"));

        Page<StorefrontShopSummaryDTO> result = storefrontService.discoverShopsPaged(
                "India", null, null, "Chennai", null, null, null,
                null, null, null, null, null, "rating", false,
                Collections.singletonList("eggless,vegan"), 0, 10
        );

        assertNotNull(result);
        assertTrue(capturedEggless, "requireEggless should be parsed from comma string");
        assertTrue(capturedVegan, "requireVegan should be parsed from comma string");
        assertFalse(capturedGlutenFree, "requireGlutenFree should be false");
    }

    @Test
    @DisplayName("Should pass all false dietary flags when dietary list is null or empty")
    void testNullOrEmptyDietaryFilter() {
        stubProjections.add(createStubProjection(6L, "Traditional Bakery", "Kolkata"));

        Page<StorefrontShopSummaryDTO> result = storefrontService.discoverShopsPaged(
                "India", null, null, "Kolkata", null, null, null,
                null, null, null, null, null, "rating", false,
                null, 0, 10
        );

        assertNotNull(result);
        assertFalse(capturedEggless, "requireEggless should be false when null");
        assertFalse(capturedVegan, "requireVegan should be false when null");
        assertFalse(capturedGlutenFree, "requireGlutenFree should be false when null");
    }

    @Test
    @DisplayName("Should pass dietary filters to nearby geolocation discovery query")
    void testNearbyDietaryFilter() {
        stubProjections.add(createStubProjection(7L, "Nearby Vegan Spot", "Hyderabad"));

        Page<StorefrontShopSummaryDTO> result = storefrontService.discoverShopsPaged(
                "India", null, null, null, null, null, null,
                null, null, 17.3850, 78.4867, 10.0, "distance", false,
                Collections.singletonList("VEGAN"), 0, 10
        );

        assertNotNull(result);
        assertFalse(capturedEggless);
        assertTrue(capturedVegan);
        assertFalse(capturedGlutenFree);
    }
}
