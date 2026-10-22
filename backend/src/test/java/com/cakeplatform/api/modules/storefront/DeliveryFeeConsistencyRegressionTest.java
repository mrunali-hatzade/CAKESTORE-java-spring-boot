package com.cakeplatform.api.modules.storefront;

import com.cakeplatform.api.exception.PriceMismatchException;
import com.cakeplatform.api.modules.order.Order;
import com.cakeplatform.api.modules.order.OrderRepository;
import com.cakeplatform.api.modules.product.Product;
import com.cakeplatform.api.modules.product.ProductRepository;
import com.cakeplatform.api.modules.shop.Coupon;
import com.cakeplatform.api.modules.shop.CouponRepository;
import com.cakeplatform.api.modules.shop.Shop;
import com.cakeplatform.api.modules.shop.ShopDeliveryConfig;
import com.cakeplatform.api.modules.shop.ShopDeliveryConfigRepository;
import com.cakeplatform.api.modules.shop.ShopDeliverySlot;
import com.cakeplatform.api.modules.shop.ShopDeliverySlotRepository;
import com.cakeplatform.api.modules.shop.ShopRepository;
import com.cakeplatform.api.modules.shop.ShopStatus;
import com.cakeplatform.api.modules.storefront.dto.GuestOrderRequest;
import com.cakeplatform.api.modules.storefront.dto.StorefrontOrderItem;
import com.cakeplatform.api.modules.storefront.dto.StorefrontQuoteRequest;
import com.cakeplatform.api.modules.storefront.dto.StorefrontQuoteResponse;
import com.cakeplatform.api.modules.storefront.dto.StorefrontShopResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DeliveryFeeConsistencyRegressionTest {

    @Mock
    private ShopRepository shopRepository;

    @Mock
    private ProductRepository productRepository;

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private ShopDeliveryConfigRepository shopDeliveryConfigRepository;

    @Mock
    private ShopDeliverySlotRepository deliverySlotRepository;

    @Mock
    private CouponRepository couponRepository;

    @Mock
    private com.cakeplatform.api.modules.subscription.SubscriptionRepository subscriptionRepository;

    @Mock
    private com.cakeplatform.api.modules.notification.NotificationService notificationService;

    @Mock
    private com.cakeplatform.api.modules.notification.AdminNotificationService adminNotificationService;

    @InjectMocks
    private CustomerStorefrontService customerStorefrontService;

    private Shop shop17;
    private Product truffleCake;
    private ShopDeliverySlot slot;

    @BeforeEach
    void setUp() {
        shop17 = new Shop();
        shop17.setId(17L);
        shop17.setBusinessName("Sweet Delight Bakery");
        shop17.setAddress("Matru Smruti Nagar, Khat Road, Bhandara");
        shop17.setCity("Bhandara");
        shop17.setStatus(ShopStatus.ACTIVE);
        shop17.setIsOwnerEnabled(true);
        shop17.setIsMarketplaceRestricted(false);

        truffleCake = new Product();
        truffleCake.setId(999L);
        truffleCake.setShop(shop17);
        truffleCake.setName("Artisan Truffle Cake");
        truffleCake.setPrice(BigDecimal.valueOf(10.00));
        truffleCake.setAvailability(true);
        truffleCake.setStatus("ACTIVE");

        slot = new ShopDeliverySlot();
        slot.setId(646L);
        slot.setShop(shop17);
        slot.setDayOfWeek("ALL");
        slot.setStartTime(LocalTime.of(10, 0));
        slot.setEndTime(LocalTime.of(14, 0));
        slot.setIsActive(true);
        slot.setMaxOrders(10);

        com.cakeplatform.api.modules.subscription.Subscription activeSub = new com.cakeplatform.api.modules.subscription.Subscription();
        activeSub.setId(1L);
        activeSub.setStatus(com.cakeplatform.api.modules.subscription.SubscriptionStatus.ACTIVE);
        activeSub.setExpiryDate(java.time.LocalDateTime.now().plusDays(30));
        lenient().when(subscriptionRepository.findFirstByShopIdOrderByCreatedAtDesc(anyLong()))
                 .thenReturn(Optional.of(activeSub));
    }

    private GuestOrderRequest createOrderRequest(String fulfillmentMethod, BigDecimal expectedTotal, BigDecimal expectedFee) {
        GuestOrderRequest request = new GuestOrderRequest();
        request.setCustomerName("Rahul Sharma");
        request.setCustomerEmail("rahul@example.com");
        request.setCustomerPhone("9876543210");
        request.setDeliveryDate(LocalDate.now().plusDays(1));
        request.setDeliverySlotId(646L);
        request.setPaymentMethod("COD");
        request.setFulfillmentMethod(fulfillmentMethod);
        request.setExpectedTotal(expectedTotal);
        request.setExpectedDeliveryFee(expectedFee);

        StorefrontOrderItem item = new StorefrontOrderItem();
        item.setProductId(999L);
        item.setQuantity(1);
        request.setItems(List.of(item));

        return request;
    }

    @Test
    @DisplayName("1. Paid home delivery: Sweet Delight Bakery (Shop 17) default ₹50 fee applied for subtotal ₹10")
    void testPaidHomeDelivery_DefaultFeeApplied() {
        when(shopRepository.findById(17L)).thenReturn(Optional.of(shop17));
        when(deliverySlotRepository.findByIdAndShopIdWithLock(646L, 17L)).thenReturn(Optional.of(slot));
        when(productRepository.findByIdAndShopId(999L, 17L)).thenReturn(Optional.of(truffleCake));
        when(shopDeliveryConfigRepository.findByShopId(17L)).thenReturn(Optional.empty()); // No custom config row yet
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));

        GuestOrderRequest request = createOrderRequest("HOME_DELIVERY", BigDecimal.valueOf(60.00), BigDecimal.valueOf(50.00));
        request.setDeliveryAddress("Matru Smruti Nagar, Khat Road");

        Order order = customerStorefrontService.placeGuestOrder(17L, request);

        assertNotNull(order);
        assertEquals("HOME_DELIVERY", order.getFulfillmentMethod());
        assertEquals(BigDecimal.valueOf(10.00), order.getSubtotal());
        assertEquals(BigDecimal.valueOf(50.00), order.getDeliveryCharge());
        assertEquals(BigDecimal.valueOf(60.00), order.getTotalAmount());
        assertEquals("Matru Smruti Nagar, Khat Road", order.getDeliveryAddress());
    }

    @Test
    @DisplayName("2. Free home delivery: owner configured zero delivery fee")
    void testFreeHomeDelivery_OwnerZeroFee() {
        ShopDeliveryConfig freeConfig = ShopDeliveryConfig.builder()
                .shop(shop17)
                .deliveryEnabled(true)
                .deliveryChargeType("FIXED")
                .fixedChargeAmount(BigDecimal.ZERO)
                .build();

        when(shopRepository.findById(17L)).thenReturn(Optional.of(shop17));
        when(deliverySlotRepository.findByIdAndShopIdWithLock(646L, 17L)).thenReturn(Optional.of(slot));
        when(productRepository.findByIdAndShopId(999L, 17L)).thenReturn(Optional.of(truffleCake));
        when(shopDeliveryConfigRepository.findByShopId(17L)).thenReturn(Optional.of(freeConfig));
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));

        GuestOrderRequest request = createOrderRequest("HOME_DELIVERY", BigDecimal.valueOf(10.00), BigDecimal.ZERO);
        request.setDeliveryAddress("Main Road, Bhandara");

        Order order = customerStorefrontService.placeGuestOrder(17L, request);

        assertNotNull(order);
        assertEquals(BigDecimal.valueOf(10.00), order.getSubtotal());
        assertEquals(BigDecimal.ZERO, order.getDeliveryCharge());
        assertEquals(BigDecimal.valueOf(10.00), order.getTotalAmount());
    }

    @Test
    @DisplayName("3. Free home delivery: subtotal meets free delivery threshold")
    void testFreeHomeDelivery_ThresholdMet() {
        ShopDeliveryConfig thresholdConfig = ShopDeliveryConfig.builder()
                .shop(shop17)
                .deliveryEnabled(true)
                .deliveryChargeType("FIXED")
                .fixedChargeAmount(BigDecimal.valueOf(50.00))
                .minOrderForFreeDelivery(BigDecimal.valueOf(100.00))
                .build();

        Product premiumHamper = new Product();
        premiumHamper.setId(888L);
        premiumHamper.setShop(shop17);
        premiumHamper.setName("Celebration Hamper");
        premiumHamper.setPrice(BigDecimal.valueOf(150.00));
        premiumHamper.setAvailability(true);
        premiumHamper.setStatus("ACTIVE");

        when(shopRepository.findById(17L)).thenReturn(Optional.of(shop17));
        when(deliverySlotRepository.findByIdAndShopIdWithLock(646L, 17L)).thenReturn(Optional.of(slot));
        when(productRepository.findByIdAndShopId(888L, 17L)).thenReturn(Optional.of(premiumHamper));
        when(shopDeliveryConfigRepository.findByShopId(17L)).thenReturn(Optional.of(thresholdConfig));
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));

        GuestOrderRequest request = new GuestOrderRequest();
        request.setCustomerName("Pooja");
        request.setCustomerEmail("pooja@example.com");
        request.setCustomerPhone("9123456780");
        request.setDeliveryDate(LocalDate.now().plusDays(1));
        request.setDeliverySlotId(646L);
        request.setPaymentMethod("COD");
        request.setFulfillmentMethod("HOME_DELIVERY");
        request.setDeliveryAddress("Civil Lines, Bhandara");
        StorefrontOrderItem item = new StorefrontOrderItem();
        item.setProductId(888L);
        item.setQuantity(1);
        request.setItems(List.of(item));

        Order order = customerStorefrontService.placeGuestOrder(17L, request);

        assertEquals(BigDecimal.valueOf(150.00), order.getSubtotal());
        assertEquals(BigDecimal.ZERO, order.getDeliveryCharge());
        assertEquals(BigDecimal.valueOf(150.00), order.getTotalAmount());
    }

    @Test
    @DisplayName("4. Self-pickup: delivery fee MUST be ₹0 even when owner configured positive ₹50 fee")
    void testSelfPickup_DeliveryFeeIsZeroRegardlessOfConfig() {
        ShopDeliveryConfig fixedConfig = ShopDeliveryConfig.builder()
                .shop(shop17)
                .deliveryEnabled(true)
                .deliveryChargeType("FIXED")
                .fixedChargeAmount(BigDecimal.valueOf(50.00))
                .build();

        when(shopRepository.findById(17L)).thenReturn(Optional.of(shop17));
        when(deliverySlotRepository.findByIdAndShopIdWithLock(646L, 17L)).thenReturn(Optional.of(slot));
        when(productRepository.findByIdAndShopId(999L, 17L)).thenReturn(Optional.of(truffleCake));
        when(shopDeliveryConfigRepository.findByShopId(17L)).thenReturn(Optional.of(fixedConfig));
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));

        // Customer selects self-pickup and doesn't specify an address
        GuestOrderRequest request = createOrderRequest("SELF_PICKUP", BigDecimal.valueOf(10.00), BigDecimal.ZERO);
        request.setDeliveryAddress(null);

        Order order = customerStorefrontService.placeGuestOrder(17L, request);

        assertNotNull(order);
        assertEquals("SELF_PICKUP", order.getFulfillmentMethod());
        assertEquals(BigDecimal.valueOf(10.00), order.getSubtotal());
        assertEquals(BigDecimal.ZERO, order.getDeliveryCharge());
        assertEquals(BigDecimal.valueOf(10.00), order.getTotalAmount());
        assertTrue(order.getDeliveryAddress().contains("Bakery Store Pickup: Sweet Delight Bakery"));
    }

    @Test
    @DisplayName("5. Disabled delivery: home delivery rejected with clear message")
    void testDisabledDelivery_HomeDeliveryRejected() {
        ShopDeliveryConfig disabledConfig = ShopDeliveryConfig.builder()
                .shop(shop17)
                .deliveryEnabled(false)
                .deliveryChargeType("FIXED")
                .fixedChargeAmount(BigDecimal.valueOf(50.00))
                .build();

        when(shopRepository.findById(17L)).thenReturn(Optional.of(shop17));
        when(deliverySlotRepository.findByIdAndShopIdWithLock(646L, 17L)).thenReturn(Optional.of(slot));
        when(shopDeliveryConfigRepository.findByShopId(17L)).thenReturn(Optional.of(disabledConfig));

        GuestOrderRequest request = createOrderRequest("HOME_DELIVERY", null, null);
        request.setDeliveryAddress("Civil Lines, Bhandara");

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                customerStorefrontService.placeGuestOrder(17L, request)
        );

        assertTrue(ex.getMessage().contains("Home delivery is currently disabled"));
    }

    @Test
    @DisplayName("6. Disabled delivery: quote marks canDeliver false and recommends self-pickup")
    void testDisabledDelivery_QuoteRejection() {
        ShopDeliveryConfig disabledConfig = ShopDeliveryConfig.builder()
                .shop(shop17)
                .deliveryEnabled(false)
                .deliveryChargeType("FIXED")
                .fixedChargeAmount(BigDecimal.valueOf(50.00))
                .build();

        when(shopRepository.findById(17L)).thenReturn(Optional.of(shop17));
        when(productRepository.findByIdAndShopId(999L, 17L)).thenReturn(Optional.of(truffleCake));
        when(shopDeliveryConfigRepository.findByShopId(17L)).thenReturn(Optional.of(disabledConfig));

        StorefrontOrderItem item = new StorefrontOrderItem();
        item.setProductId(999L);
        item.setQuantity(1);

        StorefrontQuoteRequest quoteRequest = StorefrontQuoteRequest.builder()
                .items(List.of(item))
                .fulfillmentMethod("HOME_DELIVERY")
                .build();

        StorefrontQuoteResponse quote = customerStorefrontService.calculateQuote(17L, quoteRequest);

        assertNotNull(quote);
        assertFalse(quote.getCanDeliver());
        assertFalse(quote.getDeliveryEnabled());
        assertNotNull(quote.getRejectionReason());
        assertTrue(quote.getRejectionReason().contains("choose self-pickup"));
    }

    @Test
    @DisplayName("7. Price revalidation & mismatch protection: manipulated client total is rejected")
    void testPriceMismatch_RejectedWhenClientExpectedTotalDiffers() {
        ShopDeliveryConfig fixedConfig = ShopDeliveryConfig.builder()
                .shop(shop17)
                .deliveryEnabled(true)
                .deliveryChargeType("FIXED")
                .fixedChargeAmount(BigDecimal.valueOf(50.00))
                .build();

        when(shopRepository.findById(17L)).thenReturn(Optional.of(shop17));
        when(deliverySlotRepository.findByIdAndShopIdWithLock(646L, 17L)).thenReturn(Optional.of(slot));
        when(productRepository.findByIdAndShopId(999L, 17L)).thenReturn(Optional.of(truffleCake));
        when(shopDeliveryConfigRepository.findByShopId(17L)).thenReturn(Optional.of(fixedConfig));

        // Client claims total was ₹10 (expecting free delivery) while authoritative total is ₹60
        GuestOrderRequest request = createOrderRequest("HOME_DELIVERY", BigDecimal.valueOf(10.00), BigDecimal.ZERO);
        request.setDeliveryAddress("Matru Smruti Nagar");

        PriceMismatchException ex = assertThrows(PriceMismatchException.class, () ->
                customerStorefrontService.placeGuestOrder(17L, request)
        );

        assertEquals("PRICE_MISMATCH", ex.getErrorCode());
        assertEquals(BigDecimal.valueOf(10.00), ex.getExpectedTotal());
        assertEquals(BigDecimal.valueOf(60.00), ex.getAuthoritativeTotal());
        assertEquals(BigDecimal.valueOf(50.00), ex.getAuthoritativeDeliveryFee());
    }

    @Test
    @DisplayName("8. Price revalidation: order placed with authoritative pricing when customer confirms change")
    void testPriceMismatch_AcceptedWhenCustomerConfirms() {
        ShopDeliveryConfig fixedConfig = ShopDeliveryConfig.builder()
                .shop(shop17)
                .deliveryEnabled(true)
                .deliveryChargeType("FIXED")
                .fixedChargeAmount(BigDecimal.valueOf(50.00))
                .build();

        when(shopRepository.findById(17L)).thenReturn(Optional.of(shop17));
        when(deliverySlotRepository.findByIdAndShopIdWithLock(646L, 17L)).thenReturn(Optional.of(slot));
        when(productRepository.findByIdAndShopId(999L, 17L)).thenReturn(Optional.of(truffleCake));
        when(shopDeliveryConfigRepository.findByShopId(17L)).thenReturn(Optional.of(fixedConfig));
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));

        GuestOrderRequest request = createOrderRequest("HOME_DELIVERY", BigDecimal.valueOf(10.00), BigDecimal.ZERO);
        request.setDeliveryAddress("Matru Smruti Nagar");
        request.setConfirmPriceChange(true); // Customer confirmed price change dialog!

        Order order = customerStorefrontService.placeGuestOrder(17L, request);

        assertNotNull(order);
        assertEquals(BigDecimal.valueOf(60.00), order.getTotalAmount());
        assertEquals(BigDecimal.valueOf(50.00), order.getDeliveryCharge());
    }

    @Test
    @DisplayName("9. Storefront shop details returns authoritative default delivery config when DB row is missing")
    void testGetShopDetails_ReturnsAuthoritativeDefaultDeliveryConfig() {
        when(shopRepository.findById(17L)).thenReturn(Optional.of(shop17));
        when(shopDeliveryConfigRepository.findByShopId(17L)).thenReturn(Optional.empty());

        StorefrontShopResponse response = customerStorefrontService.getShopDetails(17L);

        assertNotNull(response);
        assertNotNull(response.getDeliveryConfig(), "Delivery config must never be null");
        assertTrue(response.getDeliveryConfig().getDeliveryEnabled());
        assertEquals("FIXED", response.getDeliveryConfig().getDeliveryChargeType());
        assertEquals(BigDecimal.valueOf(50.00), response.getDeliveryConfig().getFixedChargeAmount());
        assertEquals(BigDecimal.valueOf(1000.00), response.getDeliveryConfig().getMinOrderForFreeDelivery());
    }

    @Test
    @DisplayName("10. Quote endpoint and order placement agree on subtotal, delivery fee, discount, and total")
    void testQuoteAndOrderPlacementAgreement() {
        ShopDeliveryConfig fixedConfig = ShopDeliveryConfig.builder()
                .shop(shop17)
                .deliveryEnabled(true)
                .deliveryChargeType("FIXED")
                .fixedChargeAmount(BigDecimal.valueOf(40.00))
                .minOrderForFreeDelivery(BigDecimal.valueOf(500.00))
                .build();

        when(shopRepository.findById(17L)).thenReturn(Optional.of(shop17));
        when(productRepository.findByIdAndShopId(999L, 17L)).thenReturn(Optional.of(truffleCake));
        when(shopDeliveryConfigRepository.findByShopId(17L)).thenReturn(Optional.of(fixedConfig));
        when(deliverySlotRepository.findByIdAndShopIdWithLock(646L, 17L)).thenReturn(Optional.of(slot));
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));

        StorefrontOrderItem item = new StorefrontOrderItem();
        item.setProductId(999L);
        item.setQuantity(2); // 2 * ₹10 = ₹20

        StorefrontQuoteRequest quoteRequest = StorefrontQuoteRequest.builder()
                .items(List.of(item))
                .fulfillmentMethod("HOME_DELIVERY")
                .build();

        StorefrontQuoteResponse quote = customerStorefrontService.calculateQuote(17L, quoteRequest);

        assertEquals(BigDecimal.valueOf(20.00), quote.getSubtotal());
        assertEquals(BigDecimal.valueOf(40.00), quote.getDeliveryFee());
        assertEquals(BigDecimal.valueOf(60.00), quote.getFinalTotal());

        // Now place order with expected total from quote
        GuestOrderRequest orderRequest = new GuestOrderRequest();
        orderRequest.setCustomerName("Aman");
        orderRequest.setCustomerEmail("aman@example.com");
        orderRequest.setCustomerPhone("9876543210");
        orderRequest.setDeliveryDate(LocalDate.now().plusDays(1));
        orderRequest.setDeliverySlotId(646L);
        orderRequest.setPaymentMethod("COD");
        orderRequest.setFulfillmentMethod("HOME_DELIVERY");
        orderRequest.setDeliveryAddress("Sector 4");
        orderRequest.setExpectedTotal(quote.getFinalTotal());
        orderRequest.setExpectedDeliveryFee(quote.getDeliveryFee());
        orderRequest.setItems(List.of(item));

        Order order = customerStorefrontService.placeGuestOrder(17L, orderRequest);

        assertEquals(quote.getSubtotal(), order.getSubtotal());
        assertEquals(quote.getDeliveryFee(), order.getDeliveryCharge());
        assertEquals(quote.getFinalTotal(), order.getTotalAmount());
    }
}
