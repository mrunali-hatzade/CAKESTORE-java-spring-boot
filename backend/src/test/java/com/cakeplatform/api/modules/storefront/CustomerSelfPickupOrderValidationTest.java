package com.cakeplatform.api.modules.storefront;

import com.cakeplatform.api.exception.DeliverySlotFullException;
import com.cakeplatform.api.modules.notification.NotificationService;
import com.cakeplatform.api.modules.order.Order;
import com.cakeplatform.api.modules.order.OrderRepository;
import com.cakeplatform.api.modules.product.Product;
import com.cakeplatform.api.modules.product.ProductRepository;
import com.cakeplatform.api.modules.shop.Shop;
import com.cakeplatform.api.modules.shop.ShopDeliveryConfig;
import com.cakeplatform.api.modules.shop.ShopDeliveryConfigRepository;
import com.cakeplatform.api.modules.shop.ShopDeliverySlot;
import com.cakeplatform.api.modules.shop.ShopDeliverySlotRepository;
import com.cakeplatform.api.modules.shop.ShopRepository;
import com.cakeplatform.api.modules.shop.ShopStatus;
import com.cakeplatform.api.modules.storefront.dto.GuestOrderRequest;
import com.cakeplatform.api.modules.storefront.dto.StorefrontOrderItem;
import com.cakeplatform.api.modules.subscription.Subscription;
import com.cakeplatform.api.modules.subscription.SubscriptionRepository;
import com.cakeplatform.api.modules.subscription.SubscriptionStatus;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class CustomerSelfPickupOrderValidationTest {

    @Mock
    private ShopRepository shopRepository;

    @Mock
    private ProductRepository productRepository;

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private com.cakeplatform.api.modules.shop.CouponRepository couponRepository;

    @Mock
    private NotificationService notificationService;

    @Mock
    private ShopDeliverySlotRepository deliverySlotRepository;

    @Mock
    private SubscriptionRepository subscriptionRepository;

    @Mock
    private ShopDeliveryConfigRepository shopDeliveryConfigRepository;

    @InjectMocks
    private CustomerStorefrontService storefrontService;

    private Shop shop1;
    private Shop shop2;
    private Product activeProduct;
    private ShopDeliverySlot activeSlotShop1;
    private ShopDeliverySlot inactiveSlotShop1;
    private ShopDeliverySlot activeSlotShop2;
    private Validator beanValidator;

    @BeforeEach
    void setUp() {
        ValidatorFactory factory = Validation.buildDefaultValidatorFactory();
        beanValidator = factory.getValidator();

        shop1 = new Shop();
        shop1.setId(1L);
        shop1.setBusinessName("Akurdi Artisan Bakes");
        shop1.setStatus(ShopStatus.ACTIVE);

        shop2 = new Shop();
        shop2.setId(2L);
        shop2.setBusinessName("Ravet Cake Studio");
        shop2.setStatus(ShopStatus.ACTIVE);

        activeSlotShop1 = new ShopDeliverySlot();
        activeSlotShop1.setId(10L);
        activeSlotShop1.setShop(shop1);
        activeSlotShop1.setDayOfWeek("ALL");
        activeSlotShop1.setStartTime(LocalTime.of(10, 0));
        activeSlotShop1.setEndTime(LocalTime.of(13, 0));
        activeSlotShop1.setMaxOrders(5);
        activeSlotShop1.setIsActive(true);

        inactiveSlotShop1 = new ShopDeliverySlot();
        inactiveSlotShop1.setId(11L);
        inactiveSlotShop1.setShop(shop1);
        inactiveSlotShop1.setDayOfWeek("ALL");
        inactiveSlotShop1.setIsActive(false);

        activeSlotShop2 = new ShopDeliverySlot();
        activeSlotShop2.setId(20L);
        activeSlotShop2.setShop(shop2);
        activeSlotShop2.setDayOfWeek("ALL");
        activeSlotShop2.setIsActive(true);

        activeProduct = new Product();
        activeProduct.setId(101L);
        activeProduct.setName("Belgian Chocolate Truffle");
        activeProduct.setPrice(BigDecimal.valueOf(650.00));
        activeProduct.setAvailability(true);
        activeProduct.setStatus("ACTIVE");

        Subscription activeSub = new Subscription();
        activeSub.setId(1L);
        activeSub.setStatus(SubscriptionStatus.ACTIVE);
        activeSub.setExpiryDate(LocalDateTime.now().plusDays(30));
        lenient().when(subscriptionRepository.findFirstByShopIdOrderByCreatedAtDesc(1L))
                .thenReturn(Optional.of(activeSub));

        ShopDeliveryConfig deliveryConfig = ShopDeliveryConfig.builder()
                .shop(shop1)
                .deliveryEnabled(true)
                .deliveryChargeType("FIXED")
                .fixedChargeAmount(BigDecimal.valueOf(50.00))
                .minOrderForFreeDelivery(BigDecimal.valueOf(599.00))
                .build();
        lenient().when(shopDeliveryConfigRepository.findByShopId(1L))
                .thenReturn(Optional.of(deliveryConfig));

        lenient().when(shopRepository.findById(1L)).thenReturn(Optional.of(shop1));
        lenient().when(productRepository.findByIdAndShopId(101L, 1L)).thenReturn(Optional.of(activeProduct));
        lenient().when(orderRepository.save(any(Order.class))).thenAnswer(i -> {
            Order o = i.getArgument(0);
            o.setId(5001L);
            return o;
        });
    }

    private GuestOrderRequest createBaseRequest() {
        GuestOrderRequest request = new GuestOrderRequest();
        request.setCustomerName("Test Customer");
        request.setCustomerEmail("customer@example.com");
        request.setCustomerPhone("9876543210");
        request.setDeliveryDate(LocalDate.now().plusDays(1));
        StorefrontOrderItem item = new StorefrontOrderItem();
        item.setProductId(101L);
        item.setQuantity(1);
        request.setItems(List.of(item));
        return request;
    }

    @Test
    @DisplayName("1. SELF_PICKUP with null deliverySlotId succeeds through slot validation")
    void testSelfPickup_WithNullDeliverySlotId_Succeeds() {
        GuestOrderRequest request = createBaseRequest();
        request.setFulfillmentMethod("SELF_PICKUP");
        request.setDeliverySlotId(null);
        request.setPaymentMethod("COD");

        Order order = storefrontService.placeGuestOrder(1L, request);

        assertNotNull(order);
        assertEquals("SELF_PICKUP", order.getFulfillmentMethod());
        assertNull(order.getDeliverySlot(), "Self pickup order must have null delivery slot");
        assertEquals("NEW", order.getOrderStatus());
        assertEquals("PENDING", order.getPaymentStatus());
    }

    @Test
    @DisplayName("2. SELF_PICKUP does not reserve delivery-slot capacity or query slots")
    void testSelfPickup_DoesNotReserveDeliverySlotCapacity() {
        GuestOrderRequest request = createBaseRequest();
        request.setFulfillmentMethod("SELF_PICKUP");
        request.setDeliverySlotId(null);
        request.setPaymentMethod("COD");

        storefrontService.placeGuestOrder(1L, request);

        // Verify slot repository row-lock and capacity counts were NEVER queried
        verify(deliverySlotRepository, never()).findByIdAndShopIdWithLock(any(), any());
        verify(orderRepository, never()).countActiveOrdersForSlotAndDate(any(), any());
    }

    @Test
    @DisplayName("3. SELF_PICKUP still validates required pickup date")
    void testSelfPickup_ValidatesRequiredPickupDate() {
        GuestOrderRequest requestNullDate = createBaseRequest();
        requestNullDate.setFulfillmentMethod("SELF_PICKUP");
        requestNullDate.setDeliveryDate(null);
        requestNullDate.setPaymentMethod("COD");

        IllegalArgumentException exNull = assertThrows(IllegalArgumentException.class,
                () -> storefrontService.placeGuestOrder(1L, requestNullDate));
        assertEquals("Delivery date is required", exNull.getMessage());

        GuestOrderRequest requestPastDate = createBaseRequest();
        requestPastDate.setFulfillmentMethod("SELF_PICKUP");
        requestPastDate.setDeliveryDate(LocalDate.now().minusDays(1));
        requestPastDate.setPaymentMethod("COD");

        IllegalArgumentException exPast = assertThrows(IllegalArgumentException.class,
                () -> storefrontService.placeGuestOrder(1L, requestPastDate));
        assertEquals("Delivery date cannot be in the past", exPast.getMessage());
    }

    @Test
    @DisplayName("4. SELF_PICKUP delivery fee remains zero")
    void testSelfPickup_DeliveryFeeRemainsZero() {
        GuestOrderRequest request = createBaseRequest();
        request.setFulfillmentMethod("SELF_PICKUP");
        request.setDeliverySlotId(null);
        request.setPaymentMethod("COD");

        Order order = storefrontService.placeGuestOrder(1L, request);

        assertNotNull(order);
        assertEquals(0, BigDecimal.ZERO.compareTo(order.getDeliveryCharge()), "Self pickup delivery charge must be 0");
        assertEquals(0, BigDecimal.valueOf(650.00).compareTo(order.getTotalAmount()), "Total must equal subtotal with 0 delivery charge");
    }

    @Test
    @DisplayName("5. HOME_DELIVERY with null deliverySlotId is rejected")
    void testHomeDelivery_WithNullDeliverySlotId_IsRejected() {
        GuestOrderRequest request = createBaseRequest();
        request.setFulfillmentMethod("HOME_DELIVERY");
        request.setDeliveryAddress("Flat 101, Akurdi, Pune");
        request.setDeliverySlotId(null);
        request.setPaymentMethod("COD");

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> storefrontService.placeGuestOrder(1L, request));
        assertEquals("Delivery slot is required for home delivery", ex.getMessage());
    }

    @Test
    @DisplayName("6. HOME_DELIVERY with nonexistent slot is rejected")
    void testHomeDelivery_WithNonexistentSlot_IsRejected() {
        GuestOrderRequest request = createBaseRequest();
        request.setFulfillmentMethod("HOME_DELIVERY");
        request.setDeliveryAddress("Flat 101, Akurdi, Pune");
        request.setDeliverySlotId(999L);
        request.setPaymentMethod("COD");

        when(deliverySlotRepository.findByIdAndShopIdWithLock(999L, 1L)).thenReturn(Optional.empty());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> storefrontService.placeGuestOrder(1L, request));
        assertEquals("Delivery slot not found or does not belong to this shop", ex.getMessage());
    }

    @Test
    @DisplayName("7. HOME_DELIVERY with another bakery's slot is rejected")
    void testHomeDelivery_WithAnotherBakerySlot_IsRejected() {
        GuestOrderRequest request = createBaseRequest();
        request.setFulfillmentMethod("HOME_DELIVERY");
        request.setDeliveryAddress("Flat 101, Akurdi, Pune");
        request.setDeliverySlotId(20L); // Belongs to Shop 2
        request.setPaymentMethod("COD");

        // When queried for shop 1, repository returns empty
        when(deliverySlotRepository.findByIdAndShopIdWithLock(20L, 1L)).thenReturn(Optional.empty());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> storefrontService.placeGuestOrder(1L, request));
        assertEquals("Delivery slot not found or does not belong to this shop", ex.getMessage());
    }

    @Test
    @DisplayName("8. HOME_DELIVERY with inactive slot is rejected")
    void testHomeDelivery_WithInactiveSlot_IsRejected() {
        GuestOrderRequest request = createBaseRequest();
        request.setFulfillmentMethod("HOME_DELIVERY");
        request.setDeliveryAddress("Flat 101, Akurdi, Pune");
        request.setDeliverySlotId(11L);
        request.setPaymentMethod("COD");

        when(deliverySlotRepository.findByIdAndShopIdWithLock(11L, 1L)).thenReturn(Optional.of(inactiveSlotShop1));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> storefrontService.placeGuestOrder(1L, request));
        assertEquals("Selected delivery slot is currently inactive", ex.getMessage());
    }

    @Test
    @DisplayName("9. HOME_DELIVERY capacity protection remains intact")
    void testHomeDelivery_CapacityProtection_ThrowsWhenSlotFull() {
        GuestOrderRequest request = createBaseRequest();
        request.setFulfillmentMethod("HOME_DELIVERY");
        request.setDeliveryAddress("Flat 101, Akurdi, Pune");
        request.setDeliverySlotId(10L);
        request.setPaymentMethod("COD");

        when(deliverySlotRepository.findByIdAndShopIdWithLock(10L, 1L)).thenReturn(Optional.of(activeSlotShop1));
        // Simulate slot at capacity (5 active orders >= maxOrders 5)
        when(orderRepository.countActiveOrdersForSlotAndDate(eq(10L), eq(request.getDeliveryDate()))).thenReturn(5L);

        DeliverySlotFullException ex = assertThrows(DeliverySlotFullException.class,
                () -> storefrontService.placeGuestOrder(1L, request));
        assertTrue(ex.getMessage().contains("fully booked"));
    }

    @Test
    @DisplayName("10. Existing COD and Razorpay payment behavior remains unchanged")
    void testPaymentMethods_CodAndOnlinePayment_Preserved() {
        // Test COD
        GuestOrderRequest codRequest = createBaseRequest();
        codRequest.setFulfillmentMethod("SELF_PICKUP");
        codRequest.setDeliverySlotId(null);
        codRequest.setPaymentMethod("COD");

        Order codOrder = storefrontService.placeGuestOrder(1L, codRequest);
        assertEquals("NEW", codOrder.getOrderStatus(), "COD orders start in NEW status");
        assertEquals("PENDING", codOrder.getPaymentStatus());

        // Test ONLINE_PAYMENT (Razorpay)
        GuestOrderRequest onlineRequest = createBaseRequest();
        onlineRequest.setFulfillmentMethod("SELF_PICKUP");
        onlineRequest.setDeliverySlotId(null);
        onlineRequest.setPaymentMethod("ONLINE_PAYMENT");

        Order onlineOrder = storefrontService.placeGuestOrder(1L, onlineRequest);
        assertEquals("PAYMENT_PENDING", onlineOrder.getOrderStatus(), "Online payment orders start in PAYMENT_PENDING status");
        assertEquals("PENDING", onlineOrder.getPaymentStatus());
    }

    @Test
    @DisplayName("11. Bean Validation: SELF_PICKUP allows null deliverySlotId, HOME_DELIVERY fails with deliverySlotId violation")
    void testBeanValidation_ConditionalDeliverySlot() {
        // Valid SELF_PICKUP without deliverySlotId
        GuestOrderRequest selfPickupReq = createBaseRequest();
        selfPickupReq.setFulfillmentMethod("SELF_PICKUP");
        selfPickupReq.setDeliverySlotId(null);
        selfPickupReq.setPaymentMethod("COD");

        Set<ConstraintViolation<GuestOrderRequest>> selfPickupViolations = beanValidator.validate(selfPickupReq);
        boolean hasSlotViolationSelfPickup = selfPickupViolations.stream()
                .anyMatch(v -> v.getPropertyPath().toString().contains("deliverySlotId"));
        assertFalse(hasSlotViolationSelfPickup, "SELF_PICKUP must not produce deliverySlotId violations");

        // Invalid HOME_DELIVERY without deliverySlotId
        GuestOrderRequest homeDeliveryReq = createBaseRequest();
        homeDeliveryReq.setFulfillmentMethod("HOME_DELIVERY");
        homeDeliveryReq.setDeliverySlotId(null);
        homeDeliveryReq.setPaymentMethod("COD");

        Set<ConstraintViolation<GuestOrderRequest>> homeDeliveryViolations = beanValidator.validate(homeDeliveryReq);
        boolean hasSlotViolationHomeDelivery = homeDeliveryViolations.stream()
                .anyMatch(v -> v.getPropertyPath().toString().contains("deliverySlotId"));
        assertTrue(hasSlotViolationHomeDelivery, "HOME_DELIVERY without slot must produce deliverySlotId violation");
    }
}

