package com.cakeplatform.api.modules.order.scheduler;

import com.cakeplatform.api.modules.order.Order;
import com.cakeplatform.api.modules.order.OrderRepository;
import com.cakeplatform.api.modules.order.service.OrderService;
import com.cakeplatform.api.modules.shop.Shop;
import com.cakeplatform.api.modules.shop.ShopRepository;
import com.cakeplatform.api.modules.shop.ShopDeliverySlot;
import com.cakeplatform.api.modules.shop.ShopDeliverySlotRepository;
import com.cakeplatform.api.modules.product.Product;
import com.cakeplatform.api.modules.product.ProductRepository;
import com.cakeplatform.api.modules.storefront.CustomerStorefrontService;
import com.cakeplatform.api.modules.storefront.dto.GuestOrderRequest;
import com.cakeplatform.api.modules.storefront.dto.StorefrontOrderItem;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
public class StorefrontExpiryTest {

    @Autowired
    private OrderExpiryScheduler scheduler;

    @Autowired
    private OrderService orderService;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private ShopRepository shopRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private ShopDeliverySlotRepository deliverySlotRepository;

    @Autowired
    private CustomerStorefrontService customerStorefrontService;

    @Autowired
    private com.cakeplatform.api.modules.user.UserRepository userRepository;

    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @Autowired
    private com.cakeplatform.api.modules.subscription.SubscriptionRepository subscriptionRepository;

    private Shop shop;
    private ShopDeliverySlot slot;
    private Product product;

    @BeforeEach
    public void setup() {
        com.cakeplatform.api.modules.user.User user = new com.cakeplatform.api.modules.user.User();
        user.setEmail("owner_expiry_" + java.util.UUID.randomUUID().toString() + "@test.com");
        user.setFullName("Test Owner");
        user.setMobile(String.valueOf(System.currentTimeMillis()).substring(3));
        user.setPasswordHash("password");
        user.setRole(com.cakeplatform.api.modules.user.UserRole.SHOP_OWNER);
        user = userRepository.save(user);

        shop = new Shop();
        shop.setOwner(user);
        shop.setBusinessName("Expiry Test Bakery");
        shop.setStatus(com.cakeplatform.api.modules.shop.ShopStatus.ACTIVE);
        shop = shopRepository.save(shop);
        
        com.cakeplatform.api.modules.subscription.Subscription sub = new com.cakeplatform.api.modules.subscription.Subscription();
        sub.setShop(shop);
        sub.setStatus(com.cakeplatform.api.modules.subscription.SubscriptionStatus.ACTIVE);
        sub.setExpiryDate(java.time.LocalDateTime.now().plusDays(30));
        sub.setAmount(java.math.BigDecimal.ZERO);
        subscriptionRepository.save(sub);

        slot = new ShopDeliverySlot();
        slot.setShop(shop);
        slot.setStartTime(java.time.LocalTime.of(10, 0));
        slot.setEndTime(java.time.LocalTime.of(12, 0));
        slot.setMaxOrders(1);
        slot.setIsActive(true);
        slot.setDayOfWeek("EVERYDAY");
        slot = deliverySlotRepository.save(slot);

        product = new Product();
        product.setShop(shop);
        product.setName("Test Cake");
        product.setPrice(BigDecimal.valueOf(500));
        product.setAvailability(true);
        product.setStatus("ACTIVE");
        product = productRepository.save(product);
    }

    private Order createTestOrder(String status, int ageMinutes) {
        Order order = new Order();
        order.setOrderNumber(java.util.UUID.randomUUID().toString().substring(0, 8));
        order.setShop(shop);
        order.setSubtotal(BigDecimal.valueOf(500));
        order.setOrderStatus(status);
        order.setPaymentStatus(status.equals("CONFIRMED") ? "PAID" : "PENDING");
        order.setCustomerName("Test User");
        order.setDeliverySlot(slot);
        order.setDeliveryDate(LocalDate.now().plusDays(1));
        order.setTotalAmount(BigDecimal.valueOf(500));
        Order savedOrder = orderRepository.save(order);
        jdbcTemplate.update("UPDATE orders SET created_at = ? WHERE id = ?", java.sql.Timestamp.valueOf(LocalDateTime.now().minusMinutes(ageMinutes)), savedOrder.getId());
        return savedOrder;
    }

    @Test
    public void testStalePaymentPendingIsRetainedWithoutAutomaticCancellation() {
        Order staleOrder = createTestOrder("PAYMENT_PENDING", 20);
        Order freshOrder = createTestOrder("PAYMENT_PENDING", 5);

        scheduler.processExpiredOrders();

        Order updatedStale = orderRepository.findById(staleOrder.getId()).orElseThrow();
        Order updatedFresh = orderRepository.findById(freshOrder.getId()).orElseThrow();

        // Stale orders must NOT be automatically cancelled on scheduler execution
        assertEquals("PAYMENT_PENDING", updatedStale.getOrderStatus());
        assertEquals("PENDING", updatedStale.getPaymentStatus());
        assertEquals("PAYMENT_PENDING", updatedFresh.getOrderStatus());
    }

    @Test
    public void testNonPaymentPendingOrdersIgnored() {
        Order confirmedOrder = createTestOrder("CONFIRMED", 20);
        Order cancelledOrder = createTestOrder("CANCELLED", 20);

        scheduler.processExpiredOrders();

        Order updatedConfirmed = orderRepository.findById(confirmedOrder.getId()).orElseThrow();
        Order updatedCancelled = orderRepository.findById(cancelledOrder.getId()).orElseThrow();

        assertEquals("CONFIRMED", updatedConfirmed.getOrderStatus());
        assertEquals("CANCELLED", updatedCancelled.getOrderStatus());
    }

    @Test
    public void testCapacityPreservedAcrossSchedulerExecutionAndReleasedOnlyOnManualCancellation() {
        GuestOrderRequest req1 = new GuestOrderRequest();
        req1.setCustomerName("Alice");
        req1.setCustomerPhone("1234567890");
        req1.setDeliveryAddress("Flat 101, Test Road, Pune");
        req1.setDeliveryDate(LocalDate.now().plusDays(2));
        req1.setDeliverySlotId(slot.getId());
        req1.setPaymentMethod("ONLINE_PAYMENT");
        StorefrontOrderItem item = new StorefrontOrderItem();
        item.setProductId(product.getId());
        item.setQuantity(1);
        req1.setItems(List.of(item));

        Order order1 = customerStorefrontService.placeGuestOrder(shop.getId(), req1);
        
        // Force it to be stale using direct SQL to simulate age > 15 minutes
        jdbcTemplate.update("UPDATE orders SET created_at = ? WHERE id = ?", java.sql.Timestamp.valueOf(LocalDateTime.now().minusMinutes(20)), order1.getId());

        // Second order fails due to slot capacity being fully booked
        GuestOrderRequest req2 = new GuestOrderRequest();
        req2.setCustomerName("Bob");
        req2.setCustomerPhone("1234567890");
        req2.setDeliveryAddress("Flat 102, Test Road, Pune");
        req2.setDeliveryDate(LocalDate.now().plusDays(2));
        req2.setDeliverySlotId(slot.getId());
        req2.setPaymentMethod("ONLINE_PAYMENT");
        req2.setItems(List.of(item));

        assertThrows(RuntimeException.class, () -> customerStorefrontService.placeGuestOrder(shop.getId(), req2));

        // Run scheduler (previously cancelled stale orders and leaked slot capacity)
        scheduler.processExpiredOrders();

        // Order 1 must still be PAYMENT_PENDING and capacity must still be preserved
        Order order1AfterScheduler = orderRepository.findById(order1.getId()).orElseThrow();
        assertEquals("PAYMENT_PENDING", order1AfterScheduler.getOrderStatus());

        // Second order MUST STILL FAIL because slot capacity was NOT released solely due to elapsed time
        assertThrows(RuntimeException.class, () -> customerStorefrontService.placeGuestOrder(shop.getId(), req2));

        // When the bakery owner manually cancels the order, delivery slot capacity is legitimately released
        orderService.updateOrderStatus(shop.getOwner().getId(), order1.getId(), "CANCELLED");

        // Now the second order should succeed
        Order order2 = customerStorefrontService.placeGuestOrder(shop.getId(), req2);
        assertNotNull(order2);
        assertEquals("PAYMENT_PENDING", order2.getOrderStatus());
    }

    @Test
    public void testCODOrderIsSafeFromExpiry() {
        // COD orders are generated with status NEW and paymentStatus PENDING
        Order codOrder = createTestOrder("NEW", 60);
        codOrder.setPaymentMethod("COD");
        codOrder.setPaymentStatus("PENDING");
        orderRepository.save(codOrder);

        scheduler.processExpiredOrders();

        Order updatedCod = orderRepository.findById(codOrder.getId()).orElseThrow();

        // Must NOT be cancelled
        assertEquals("NEW", updatedCod.getOrderStatus());
        assertEquals("PENDING", updatedCod.getPaymentStatus());
    }

    @Test
    public void testCustomCakeCODConversionIsSafeFromExpiry() {
        // Custom cake conversions are generated with status CONFIRMED and paymentStatus PENDING (if COD)
        Order customCakeOrder = createTestOrder("CONFIRMED", 120);
        customCakeOrder.setPaymentMethod("COD");
        customCakeOrder.setPaymentStatus("PENDING");
        orderRepository.save(customCakeOrder);

        scheduler.processExpiredOrders();

        Order updatedCustomCake = orderRepository.findById(customCakeOrder.getId()).orElseThrow();

        // Must NOT be cancelled
        assertEquals("CONFIRMED", updatedCustomCake.getOrderStatus());
        assertEquals("PENDING", updatedCustomCake.getPaymentStatus());
    }
}
