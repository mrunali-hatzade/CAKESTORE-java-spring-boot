package com.cakeplatform.api.modules.storefront;

import com.cakeplatform.api.modules.location.dto.GeocodeResultDTO;
import com.cakeplatform.api.modules.location.service.GeocodingService;
import com.cakeplatform.api.modules.order.Order;
import com.cakeplatform.api.modules.order.OrderRepository;
import com.cakeplatform.api.modules.product.Product;
import com.cakeplatform.api.modules.product.ProductRepository;
import com.cakeplatform.api.modules.shop.*;
import com.cakeplatform.api.modules.shop.service.DeliveryEligibilityService;
import com.cakeplatform.api.modules.storefront.dto.*;
import com.cakeplatform.api.modules.subscription.Subscription;
import com.cakeplatform.api.modules.subscription.SubscriptionRepository;
import com.cakeplatform.api.modules.subscription.SubscriptionStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Proxy;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.*;

public class CustomerStorefrontDeliveryGeofencingTest {

    private CustomerStorefrontService storefrontService;
    private StubGeocodingService geocodingService;

    private Shop shop;
    private ShopDeliveryConfig deliveryConfig;
    private Product product;
    private ShopDeliverySlot deliverySlot;
    private Subscription subscription;
    private AtomicBoolean orderSaved = new AtomicBoolean(false);

    private static final Long SHOP_ID = 440L;

    private static class StubGeocodingService implements GeocodingService {
        @Override
        public Optional<Coordinates> geocodeAddress(String addressLine1, String addressLine2, String area, String city, String district, String state, String pincode) {
            GeocodeResultDTO dto = geocodeDetailed(addressLine1, addressLine2, area, city, district, state, pincode, null);
            if (dto.isFound() && dto.getLatitude() != null && dto.getLongitude() != null) {
                return Optional.of(new Coordinates(dto.getLatitude(), dto.getLongitude()));
            }
            return Optional.empty();
        }

        @Override
        public GeocodeResultDTO geocodeDetailed(String addressLine1, String addressLine2, String area, String city, String district, String state, String pincode, String query) {
            String combined = ((addressLine1 != null ? addressLine1 : "") + " " + (query != null ? query : "")).toLowerCase();
            if (combined.contains("delhi") || "110001".equals(pincode)) {
                return GeocodeResultDTO.builder().found(true).latitude(28.6139).longitude(77.2090).provider("STUB").build();
            }
            if (combined.contains("deccan") || combined.contains("fc road") || "411004".equals(pincode)) {
                if (combined.contains("remote") || combined.contains("hill station")) {
                    return GeocodeResultDTO.builder().found(true).latitude(19.2000).longitude(73.1000).provider("STUB").build();
                }
                if (combined.contains("lonavala") || combined.contains("old mumbai highway")) {
                    return GeocodeResultDTO.builder().found(true).latitude(18.7500).longitude(73.4000).provider("STUB").build();
                }
                return GeocodeResultDTO.builder().found(true).latitude(18.5167).longitude(73.8415).provider("STUB").build();
            }
            if (combined.contains("kothrud") || "411038".equals(pincode)) {
                return GeocodeResultDTO.builder().found(true).latitude(18.5074).longitude(73.8077).provider("STUB").build();
            }
            if (combined.contains("camp") || "411001".equals(pincode)) {
                return GeocodeResultDTO.builder().found(true).latitude(18.5158).longitude(73.8794).provider("STUB").build();
            }
            // Fallback Pune
            return GeocodeResultDTO.builder().found(true).latitude(18.5204).longitude(73.8567).provider("STUB").build();
        }
    }

    private StorefrontOrderItem createItem(Long productId, int quantity) {
        StorefrontOrderItem item = new StorefrontOrderItem();
        item.setProductId(productId);
        item.setQuantity(quantity);
        return item;
    }

    @SuppressWarnings("unchecked")
    private static <T> T createProxy(Class<T> intf, java.lang.reflect.InvocationHandler handler) {
        return (T) Proxy.newProxyInstance(intf.getClassLoader(), new Class<?>[]{intf}, handler);
    }

    @BeforeEach
    void setUp() {
        shop = new Shop();
        shop.setId(SHOP_ID);
        shop.setBusinessName("Sweet Layers Patisserie");
        shop.setStatus(ShopStatus.ACTIVE);
        shop.setIsOwnerEnabled(true);
        shop.setIsMarketplaceRestricted(false);
        shop.setLatitude(18.5204); // Shivajinagar, Pune
        shop.setLongitude(73.8567);
        shop.setCity("Pune");
        shop.setPincode("411005");

        deliveryConfig = ShopDeliveryConfig.builder()
                .shop(shop)
                .deliveryEnabled(true)
                .deliveryChargeType("FIXED")
                .fixedChargeAmount(BigDecimal.valueOf(50.00))
                .minOrderForFreeDelivery(BigDecimal.valueOf(500.00))
                .maxDeliveryRadiusKm(10.0) // 10 km geofence
                .serviceablePincodes("411004, 411005, 411016")
                .build();
        shop.setDeliveryConfig(deliveryConfig);

        product = new Product();
        product.setId(201L);
        product.setShop(shop);
        product.setName("Belgian Chocolate Truffle");
        product.setPrice(BigDecimal.valueOf(450.00));
        product.setAvailability(true);
        product.setStatus("ACTIVE");

        deliverySlot = new ShopDeliverySlot();
        deliverySlot.setId(501L);
        deliverySlot.setShop(shop);
        deliverySlot.setIsActive(true);
        deliverySlot.setStartTime(LocalTime.of(16, 0));
        deliverySlot.setEndTime(LocalTime.of(19, 0));
        deliverySlot.setDayOfWeek("EVERYDAY");
        deliverySlot.setMaxOrders(10);

        subscription = new Subscription();
        subscription.setId(1L);
        subscription.setShop(shop);
        subscription.setStatus(SubscriptionStatus.ACTIVE);
        subscription.setExpiryDate(LocalDateTime.now().plusMonths(1));

        orderSaved.set(false);

        ShopRepository shopRepo = createProxy(ShopRepository.class, (proxy, method, args) -> {
            if ("findById".equals(method.getName()) && SHOP_ID.equals(args[0])) {
                return Optional.of(shop);
            }
            return Optional.empty();
        });

        ShopDeliveryConfigRepo deliveryConfigRepo = createProxy(ShopDeliveryConfigRepo.class, (proxy, method, args) -> {
            if ("findByShopId".equals(method.getName()) && SHOP_ID.equals(args[0])) {
                return Optional.of(deliveryConfig);
            }
            return Optional.empty();
        });

        ProductRepository prodRepo = createProxy(ProductRepository.class, (proxy, method, args) -> {
            if ("findByIdAndShopId".equals(method.getName()) && Long.valueOf(201L).equals(args[0]) && SHOP_ID.equals(args[1])) {
                return Optional.of(product);
            }
            return Optional.empty();
        });

        ShopDeliverySlotRepository slotRepo = createProxy(ShopDeliverySlotRepository.class, (proxy, method, args) -> {
            if ("findByIdAndShopIdWithLock".equals(method.getName()) && Long.valueOf(501L).equals(args[0]) && SHOP_ID.equals(args[1])) {
                return Optional.of(deliverySlot);
            }
            return Optional.empty();
        });

        OrderRepository orderRepo = createProxy(OrderRepository.class, (proxy, method, args) -> {
            if ("save".equals(method.getName())) {
                orderSaved.set(true);
                return args[0];
            }
            if ("countActiveOrdersForSlotAndDate".equals(method.getName())) {
                return 0L;
            }
            return null;
        });

        SubscriptionRepository subRepo = createProxy(SubscriptionRepository.class, (proxy, method, args) -> {
            if ("findFirstByShopIdOrderByCreatedAtDesc".equals(method.getName())) {
                return Optional.of(subscription);
            }
            return Optional.empty();
        });

        storefrontService = new CustomerStorefrontService(
                shopRepo, prodRepo, orderRepo, null, null, null,
                null, null, slotRepo, null, null, deliveryConfigRepo,
                null, null, null, null, subRepo, null
        );

        geocodingService = new StubGeocodingService();
        DeliveryEligibilityService eligibilityService = new DeliveryEligibilityService(geocodingService);
        storefrontService.setDeliveryEligibilityService(eligibilityService);
    }

    private interface ShopDeliveryConfigRepo extends ShopDeliveryConfigRepository {}

    @Test
    @DisplayName("Quote: Address within radius and serviceable pincode is accepted with delivery fee")
    void testQuoteInsideRadius() {
        // Customer in Deccan Gymkhana (approx 1.8 km away)
        StorefrontQuoteRequest quoteReq = StorefrontQuoteRequest.builder()
                .fulfillmentMethod("HOME_DELIVERY")
                .deliveryAddress("FC Road, Deccan, Pune, 411004")
                .deliveryPincode("411004")
                .deliveryLatitude(18.5167)
                .deliveryLongitude(73.8415)
                .items(List.of(createItem(201L, 1)))
                .build();

        StorefrontQuoteResponse response = storefrontService.calculateQuote(SHOP_ID, quoteReq);

        assertNotNull(response);
        assertTrue(response.getCanDeliver());
        assertNull(response.getRejectionReason());
        assertEquals(BigDecimal.valueOf(450.00), response.getSubtotal());
        assertEquals(BigDecimal.valueOf(50.00), response.getDeliveryFee()); // under 500 threshold
        assertEquals(BigDecimal.valueOf(500.00), response.getFinalTotal());
    }

    @Test
    @DisplayName("Quote: Address outside radius sets canDeliver=false and provides rejection reason")
    void testQuoteOutsideRadius() {
        // Customer 30 km away in Lonavala outskirts
        StorefrontQuoteRequest quoteReq = StorefrontQuoteRequest.builder()
                .fulfillmentMethod("HOME_DELIVERY")
                .deliveryAddress("Old Mumbai Highway, 411004")
                .deliveryPincode("411004")
                .deliveryLatitude(18.7500)
                .deliveryLongitude(73.4000)
                .items(List.of(createItem(201L, 1)))
                .build();

        StorefrontQuoteResponse response = storefrontService.calculateQuote(SHOP_ID, quoteReq);

        assertNotNull(response);
        assertFalse(response.getCanDeliver());
        assertEquals("This address is outside this bakery's delivery area.", response.getRejectionReason());
        assertEquals(BigDecimal.ZERO, response.getDeliveryFee());
    }

    @Test
    @DisplayName("Quote: Unserviceable pincode sets canDeliver=false")
    void testQuoteUnserviceablePincode() {
        StorefrontQuoteRequest quoteReq = StorefrontQuoteRequest.builder()
                .fulfillmentMethod("HOME_DELIVERY")
                .deliveryAddress("Camp, Pune, 411001") // 411001 not in {411004, 411005, 411016}
                .deliveryPincode("411001")
                .deliveryLatitude(18.5158)
                .deliveryLongitude(73.8794)
                .items(List.of(createItem(201L, 1)))
                .build();

        StorefrontQuoteResponse response = storefrontService.calculateQuote(SHOP_ID, quoteReq);

        assertNotNull(response);
        assertFalse(response.getCanDeliver());
        assertEquals("This pincode is not currently serviceable.", response.getRejectionReason());
    }

    @Test
    @DisplayName("Quote: Free delivery threshold is respected when eligible")
    void testQuoteFreeDeliveryThreshold() {
        // 2 cakes = 900.00 (>= 500.00 threshold)
        StorefrontQuoteRequest quoteReq = StorefrontQuoteRequest.builder()
                .fulfillmentMethod("HOME_DELIVERY")
                .deliveryAddress("FC Road, Pune, 411004")
                .deliveryPincode("411004")
                .deliveryLatitude(18.5167)
                .deliveryLongitude(73.8415)
                .items(List.of(createItem(201L, 2)))
                .build();

        StorefrontQuoteResponse response = storefrontService.calculateQuote(SHOP_ID, quoteReq);

        assertTrue(response.getCanDeliver());
        assertEquals(BigDecimal.valueOf(900.00), response.getSubtotal());
        assertEquals(BigDecimal.ZERO, response.getDeliveryFee()); // Free delivery!
        assertTrue(response.getIsFreeDelivery());
        assertEquals(BigDecimal.valueOf(900.00), response.getFinalTotal());
    }

    @Test
    @DisplayName("Order Placement: API bypass attempt outside radius is strictly rejected with 400 Bad Request")
    void testOrderPlacementOutsideRadiusRejected() {
        GuestOrderRequest orderReq = new GuestOrderRequest();
        orderReq.setCustomerName("Aditi Sharma");
        orderReq.setCustomerEmail("aditi@example.com");
        orderReq.setCustomerPhone("9876543210");
        orderReq.setPaymentMethod("COD");
        orderReq.setFulfillmentMethod("HOME_DELIVERY");
        orderReq.setDeliveryDate(LocalDate.now().plusDays(1));
        orderReq.setDeliverySlotId(501L);
        orderReq.setDeliveryAddress("Remote Hill Station, 411004");
        orderReq.setDeliveryPincode("411004");
        orderReq.setDeliveryLatitude(19.2000); // 80 km away
        orderReq.setDeliveryLongitude(73.1000);
        orderReq.setItems(List.of(createItem(201L, 1)));

        var ex = assertThrows(IllegalArgumentException.class, () ->
                storefrontService.placeGuestOrder(SHOP_ID, orderReq)
        );

        assertEquals("This address is outside this bakery's delivery area.", ex.getMessage());
        assertFalse(orderSaved.get());
    }

    @Test
    @DisplayName("Order Placement: Coordinate spoofing attempt is strictly rejected")
    void testOrderPlacementCoordinateSpoofingRejected() {
        GuestOrderRequest orderReq = new GuestOrderRequest();
        orderReq.setCustomerName("Attacker User");
        orderReq.setCustomerEmail("attacker@example.com");
        orderReq.setCustomerPhone("9876543210");
        orderReq.setPaymentMethod("COD");
        orderReq.setFulfillmentMethod("HOME_DELIVERY");
        orderReq.setDeliveryDate(LocalDate.now().plusDays(1));
        orderReq.setDeliverySlotId(501L);
        // Address is in Delhi 110001, but attacker submits Pune bakery coordinates
        orderReq.setDeliveryAddress("Connaught Place, Delhi 110001");
        orderReq.setDeliveryPincode("110001");
        orderReq.setDeliveryLatitude(18.5204); // Pune coordinates
        orderReq.setDeliveryLongitude(73.8567);
        orderReq.setItems(List.of(createItem(201L, 1)));

        var ex = assertThrows(IllegalArgumentException.class, () ->
                storefrontService.placeGuestOrder(SHOP_ID, orderReq)
        );

        assertTrue(ex.getMessage().contains("do not match the delivery address location")
                || ex.getMessage().contains("outside this bakery's delivery area")
                || ex.getMessage().contains("not currently serviceable"));
        assertFalse(orderSaved.get());
    }

    @Test
    @DisplayName("Order Placement: PIN spoofing attempt (whitelisted PIN but different address) is rejected")
    void testOrderPlacementPinSpoofingRejected() {
        GuestOrderRequest orderReq = new GuestOrderRequest();
        orderReq.setCustomerName("Attacker User");
        orderReq.setCustomerEmail("attacker@example.com");
        orderReq.setCustomerPhone("9876543210");
        orderReq.setPaymentMethod("COD");
        orderReq.setFulfillmentMethod("HOME_DELIVERY");
        orderReq.setDeliveryDate(LocalDate.now().plusDays(1));
        orderReq.setDeliverySlotId(501L);
        // Address is in Delhi 110001, but attacker submits whitelisted Pune PIN 411004
        orderReq.setDeliveryAddress("Connaught Place, Delhi 110001");
        orderReq.setDeliveryPincode("411004");
        orderReq.setDeliveryLatitude(28.6139);
        orderReq.setDeliveryLongitude(77.2090);
        orderReq.setItems(List.of(createItem(201L, 1)));

        var ex = assertThrows(IllegalArgumentException.class, () ->
                storefrontService.placeGuestOrder(SHOP_ID, orderReq)
        );

        assertEquals("The delivery address PIN code (110001) does not match the submitted PIN code (411004).", ex.getMessage());
        assertFalse(orderSaved.get());
    }

    @Test
    @DisplayName("Order Placement: Pickup outside radius succeeds without applying delivery geofence")
    void testOrderPlacementPickupOutsideRadiusAllowed() {
        GuestOrderRequest orderReq = new GuestOrderRequest();
        orderReq.setCustomerName("Vikram Rao");
        orderReq.setCustomerEmail("vikram@example.com");
        orderReq.setCustomerPhone("9876543211");
        orderReq.setPaymentMethod("COD");
        orderReq.setFulfillmentMethod("SELF_PICKUP"); // Store Pickup
        orderReq.setDeliveryDate(LocalDate.now().plusDays(1));
        orderReq.setDeliverySlotId(501L);
        orderReq.setDeliveryAddress("Customer residing in Mumbai, 400001");
        orderReq.setDeliveryLatitude(19.0760);
        orderReq.setDeliveryLongitude(72.8777);
        orderReq.setItems(List.of(createItem(201L, 1)));

        Order placed = storefrontService.placeGuestOrder(SHOP_ID, orderReq);

        assertNotNull(placed);
        assertEquals("SELF_PICKUP", placed.getFulfillmentMethod());
        assertEquals(BigDecimal.ZERO, placed.getDeliveryCharge());
        assertTrue(orderSaved.get());
    }

    @Test
    @DisplayName("Order Placement: Non-serviceable pincode rejected even if coordinates are close")
    void testOrderPlacementNonServiceablePincodeRejected() {
        GuestOrderRequest orderReq = new GuestOrderRequest();
        orderReq.setCustomerName("Pooja K");
        orderReq.setCustomerEmail("pooja@example.com");
        orderReq.setCustomerPhone("9876543212");
        orderReq.setPaymentMethod("COD");
        orderReq.setFulfillmentMethod("HOME_DELIVERY");
        orderReq.setDeliveryDate(LocalDate.now().plusDays(1));
        orderReq.setDeliverySlotId(501L);
        orderReq.setDeliveryAddress("Kothrud, Pune, 411038"); // 411038 not whitelisted
        orderReq.setDeliveryPincode("411038");
        orderReq.setDeliveryLatitude(18.5074);
        orderReq.setDeliveryLongitude(73.8077);
        orderReq.setItems(List.of(createItem(201L, 1)));

        var ex = assertThrows(IllegalArgumentException.class, () ->
                storefrontService.placeGuestOrder(SHOP_ID, orderReq)
        );

        assertEquals("This pincode is not currently serviceable.", ex.getMessage());
        assertFalse(orderSaved.get());
    }
}
