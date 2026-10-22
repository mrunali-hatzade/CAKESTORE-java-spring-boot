package com.cakeplatform.api.modules.order.service;

import com.cakeplatform.api.modules.interaction.CustomCakeRequest;
import com.cakeplatform.api.modules.interaction.CustomCakeRequestRepository;
import com.cakeplatform.api.modules.interaction.dto.ConvertToOrderRequest;
import com.cakeplatform.api.modules.interaction.service.OwnerInteractionService;
import com.cakeplatform.api.modules.order.Order;
import com.cakeplatform.api.modules.order.OrderRepository;
import com.cakeplatform.api.modules.shop.Shop;
import com.cakeplatform.api.modules.shop.ShopRepository;
import com.cakeplatform.api.modules.shop.ShopStatus;
import com.cakeplatform.api.modules.subscription.Subscription;
import com.cakeplatform.api.modules.subscription.SubscriptionRepository;
import com.cakeplatform.api.modules.subscription.SubscriptionStatus;
import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.modules.user.UserRepository;
import com.cakeplatform.api.modules.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest
@ActiveProfiles("test")
public class CustomCakeOrderLifecycleSyncTest {

    @Autowired
    private OrderService orderService;

    @Autowired
    private OwnerInteractionService ownerInteractionService;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private CustomCakeRequestRepository customCakeRequestRepository;

    @Autowired
    private ShopRepository shopRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SubscriptionRepository subscriptionRepository;

    private User testOwner;
    private Shop testShop;
    private CustomCakeRequest testCakeRequest;

    @BeforeEach
    void setUp() {
        // Clean up
        customCakeRequestRepository.deleteAll();
        orderRepository.deleteAll();
        shopRepository.deleteAll();
        userRepository.deleteAll();

        // Create owner
        testOwner = new User();
        testOwner.setFullName("Test Owner");
        testOwner.setEmail("owner_cakesync_" + System.currentTimeMillis() + "@example.com");
        testOwner.setPasswordHash("password123");
        testOwner.setMobile("99" + (System.currentTimeMillis() % 100000000L));
        testOwner.setRole(UserRole.SHOP_OWNER);
        testOwner = userRepository.save(testOwner);

        // Create shop
        testShop = new Shop();
        testShop.setOwner(testOwner);
        testShop.setBusinessName("Sync Test Bakery");
        testShop.setStatus(ShopStatus.ACTIVE);
        testShop = shopRepository.save(testShop);

        Subscription subscription = new Subscription();
        subscription.setShop(testShop);
        subscription.setStatus(SubscriptionStatus.ACTIVE);
        subscription.setAmount(BigDecimal.valueOf(100));
        subscription.setStartDate(LocalDateTime.now().minusDays(1));
        subscription.setExpiryDate(LocalDateTime.now().plusMonths(1));
        subscriptionRepository.save(subscription);

        // Create custom cake request
        testCakeRequest = new CustomCakeRequest();
        testCakeRequest.setShop(testShop);
        testCakeRequest.setCustomerName("Test Customer");
        testCakeRequest.setCustomerEmail("customer@example.com");
        testCakeRequest.setStatus("REVIEWED");
        testCakeRequest.setBudget(BigDecimal.valueOf(2000));
        testCakeRequest.setOwnerResponse("Looks good");
        testCakeRequest = customCakeRequestRepository.save(testCakeRequest);
    }

    @Test
    void shouldSyncCancelledOrderToCustomCakeRequest() {
        // Given
        ConvertToOrderRequest convertReq = new ConvertToOrderRequest();
        convertReq.setAgreedPrice(BigDecimal.valueOf(2000));
        convertReq.setPaymentMethod("COD");

        ownerInteractionService.convertToOrder(testOwner.getId(), testCakeRequest.getId(), convertReq);

        CustomCakeRequest updatedCakeReq = customCakeRequestRepository.findById(testCakeRequest.getId()).orElseThrow();
        assertThat(updatedCakeReq.getStatus()).isEqualTo("ACCEPTED");
        assertThat(updatedCakeReq.getConvertedOrderId()).isNotNull();

        Long orderId = updatedCakeReq.getConvertedOrderId();
        Order order = orderRepository.findById(orderId).orElseThrow();
        assertThat(order.getOrderStatus()).isEqualTo("CONFIRMED");

        // When
        orderService.updateOrderStatus(testOwner.getId(), orderId, "CANCELLED");

        // Then
        CustomCakeRequest syncedCakeReq = customCakeRequestRepository.findById(testCakeRequest.getId()).orElseThrow();
        assertThat(syncedCakeReq.getStatus()).isEqualTo("REVIEWED");
        assertThat(syncedCakeReq.getConvertedOrderId()).isNull();
        assertThat(syncedCakeReq.getConvertedOrderNumber()).isNull();

        Order cancelledOrder = orderRepository.findById(orderId).orElseThrow();
        assertThat(cancelledOrder.getOrderStatus()).isEqualTo("CANCELLED");
    }

    @Test
    void shouldRetainPaymentPendingOrderWithoutPrematureCancellationOnExpiry() {
        // Given
        ConvertToOrderRequest convertReq = new ConvertToOrderRequest();
        convertReq.setAgreedPrice(BigDecimal.valueOf(2000));
        convertReq.setPaymentMethod("ONLINE_PAYMENT");

        ownerInteractionService.convertToOrder(testOwner.getId(), testCakeRequest.getId(), convertReq);

        CustomCakeRequest updatedCakeReq = customCakeRequestRepository.findById(testCakeRequest.getId()).orElseThrow();
        Long orderId = updatedCakeReq.getConvertedOrderId();
        Order order = orderRepository.findById(orderId).orElseThrow();
        
        // Custom cake conversion currently sets status to CONFIRMED. For test 2, we simulate an order 
        // that became PAYMENT_PENDING (e.g. if online checkout flow applies)
        order.setOrderStatus("PAYMENT_PENDING");
        orderRepository.save(order);

        // When
        orderService.cancelStalePaymentPendingOrders(LocalDateTime.now().plusMinutes(15));

        // Then: Order must remain in PAYMENT_PENDING to protect customer payment and delivery slot
        Order retainedOrder = orderRepository.findById(orderId).orElseThrow();
        assertThat(retainedOrder.getOrderStatus()).isEqualTo("PAYMENT_PENDING");

        CustomCakeRequest syncedCakeReq = customCakeRequestRepository.findById(testCakeRequest.getId()).orElseThrow();
        assertThat(syncedCakeReq.getStatus()).isEqualTo("ACCEPTED");
        assertThat(syncedCakeReq.getConvertedOrderId()).isEqualTo(orderId);
    }

    @Test
    void shouldNotSyncIfAtomicExpiryCancellationLosesRace() {
        // Given
        ConvertToOrderRequest convertReq = new ConvertToOrderRequest();
        convertReq.setAgreedPrice(BigDecimal.valueOf(2000));
        convertReq.setPaymentMethod("ONLINE_PAYMENT");
        ownerInteractionService.convertToOrder(testOwner.getId(), testCakeRequest.getId(), convertReq);

        CustomCakeRequest updatedCakeReq = customCakeRequestRepository.findById(testCakeRequest.getId()).orElseThrow();
        Long orderId = updatedCakeReq.getConvertedOrderId();
        Order order = orderRepository.findById(orderId).orElseThrow();
        
        // Order is NO LONGER PAYMENT_PENDING, it is CONFIRMED
        order.setOrderStatus("CONFIRMED");
        orderRepository.save(order);

        // When
        orderService.cancelStalePaymentPendingOrders(LocalDateTime.now().plusMinutes(15));

        // Then (0 rows affected in cancelIfPaymentPending)
        CustomCakeRequest syncedCakeReq = customCakeRequestRepository.findById(testCakeRequest.getId()).orElseThrow();
        assertThat(syncedCakeReq.getStatus()).isEqualTo("ACCEPTED"); // Not modified
        assertThat(syncedCakeReq.getConvertedOrderId()).isNotNull();
    }

    @Test
    void shouldNotFailIfOrderHasNoCustomCake() {
        // Given
        Order standaloneOrder = new Order();
        standaloneOrder.setShop(testShop);
        standaloneOrder.setCustomerName("Standard Customer");
        standaloneOrder.setOrderStatus("NEW");
        standaloneOrder.setOrderNumber("ORD-STANDALONE");
        standaloneOrder.setSubtotal(BigDecimal.valueOf(500));
        standaloneOrder.setTotalAmount(BigDecimal.valueOf(500));
        standaloneOrder.setPaymentStatus("PENDING");
        standaloneOrder = orderRepository.save(standaloneOrder);

        // When
        orderService.updateOrderStatus(testOwner.getId(), standaloneOrder.getId(), "CANCELLED");

        // Then
        Order cancelledOrder = orderRepository.findById(standaloneOrder.getId()).orElseThrow();
        assertThat(cancelledOrder.getOrderStatus()).isEqualTo("CANCELLED");
        // No exception thrown
    }

    @Test
    void shouldBeIdempotentOnSubsequentCancellation() {
        // Given
        ConvertToOrderRequest convertReq = new ConvertToOrderRequest();
        convertReq.setAgreedPrice(BigDecimal.valueOf(2000));
        convertReq.setPaymentMethod("COD");
        ownerInteractionService.convertToOrder(testOwner.getId(), testCakeRequest.getId(), convertReq);

        CustomCakeRequest updatedCakeReq = customCakeRequestRepository.findById(testCakeRequest.getId()).orElseThrow();
        Long orderId = updatedCakeReq.getConvertedOrderId();

        // When 1
        orderService.updateOrderStatus(testOwner.getId(), orderId, "CANCELLED");

        // Then 1
        CustomCakeRequest synced1 = customCakeRequestRepository.findById(testCakeRequest.getId()).orElseThrow();
        assertThat(synced1.getStatus()).isEqualTo("REVIEWED");

        // When 2 (Simulating somehow Order status is requested again)
        // updateOrderStatus throws IllegalStateException if already CANCELLED.
        assertThrows(IllegalStateException.class, () -> {
            orderService.updateOrderStatus(testOwner.getId(), orderId, "CANCELLED");
        });

        // Even though it throws, let's just make sure the Custom Cake request remains REVIEWED
        CustomCakeRequest synced2 = customCakeRequestRepository.findById(testCakeRequest.getId()).orElseThrow();
        assertThat(synced2.getStatus()).isEqualTo("REVIEWED");
        assertThat(synced2.getConvertedOrderId()).isNull();
    }

    @Test
    void shouldPreserveTenantIsolationOnSync() {
        // Given
        User ownerB = new User();
        ownerB.setFullName("Owner B");
        ownerB.setEmail("ownerb_cakesync_" + System.currentTimeMillis() + "@example.com");
        ownerB.setPasswordHash("password123");
        ownerB.setMobile("88" + (System.currentTimeMillis() % 100000000L));
        ownerB.setRole(UserRole.SHOP_OWNER);
        ownerB = userRepository.save(ownerB);

        Shop shopB = new Shop();
        shopB.setOwner(ownerB);
        shopB.setBusinessName("Shop B");
        shopB.setStatus(ShopStatus.ACTIVE);
        shopB = shopRepository.save(shopB);

        Subscription subB = new Subscription();
        subB.setShop(shopB);
        subB.setStatus(SubscriptionStatus.ACTIVE);
        subB.setAmount(BigDecimal.valueOf(100));
        subB.setStartDate(LocalDateTime.now().minusDays(1));
        subB.setExpiryDate(LocalDateTime.now().plusMonths(1));
        subscriptionRepository.save(subB);

        Order orderB = new Order();
        orderB.setShop(shopB);
        orderB.setCustomerName("Customer B");
        orderB.setOrderStatus("NEW");
        orderB.setOrderNumber("ORD-SHOP-B");
        orderB.setSubtotal(BigDecimal.valueOf(500));
        orderB.setTotalAmount(BigDecimal.valueOf(500));
        orderB.setPaymentStatus("PENDING");
        orderB = orderRepository.save(orderB);

        // Maliciously link Shop A's cake request to Shop B's order
        testCakeRequest.setConvertedOrderId(orderB.getId());
        customCakeRequestRepository.save(testCakeRequest);

        // When
        orderService.updateOrderStatus(ownerB.getId(), orderB.getId(), "CANCELLED");

        // Then (Order cancelled, but Shop A's cake request is untouched)
        Order cancelledOrder = orderRepository.findById(orderB.getId()).orElseThrow();
        assertThat(cancelledOrder.getOrderStatus()).isEqualTo("CANCELLED");

        CustomCakeRequest unaffectedReq = customCakeRequestRepository.findById(testCakeRequest.getId()).orElseThrow();
        assertThat(unaffectedReq.getConvertedOrderId()).isEqualTo(orderB.getId()); // Still holds the link because tenant mismatch prevented clearing
    }

    @Test
    void shouldAllowConversionAgainAfterCancellation() {
        // Given
        ConvertToOrderRequest convertReq = new ConvertToOrderRequest();
        convertReq.setAgreedPrice(BigDecimal.valueOf(2000));
        convertReq.setPaymentMethod("COD");

        ownerInteractionService.convertToOrder(testOwner.getId(), testCakeRequest.getId(), convertReq);
        CustomCakeRequest updatedCakeReq = customCakeRequestRepository.findById(testCakeRequest.getId()).orElseThrow();
        Long firstOrderId = updatedCakeReq.getConvertedOrderId();

        // Cancel the order
        orderService.updateOrderStatus(testOwner.getId(), firstOrderId, "CANCELLED");

        // Verify request is REVIEWED
        CustomCakeRequest syncedCakeReq = customCakeRequestRepository.findById(testCakeRequest.getId()).orElseThrow();
        assertThat(syncedCakeReq.getStatus()).isEqualTo("REVIEWED");

        // When (convert again)
        ConvertToOrderRequest convertReq2 = new ConvertToOrderRequest();
        convertReq2.setAgreedPrice(BigDecimal.valueOf(2500));
        convertReq2.setPaymentMethod("COD");
        ownerInteractionService.convertToOrder(testOwner.getId(), testCakeRequest.getId(), convertReq2);

        // Then
        CustomCakeRequest finalReq = customCakeRequestRepository.findById(testCakeRequest.getId()).orElseThrow();
        assertThat(finalReq.getStatus()).isEqualTo("ACCEPTED");
        assertThat(finalReq.getConvertedOrderId()).isNotNull();
        assertThat(finalReq.getConvertedOrderId()).isNotEqualTo(firstOrderId);
    }
}
