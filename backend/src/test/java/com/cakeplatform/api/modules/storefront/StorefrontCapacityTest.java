package com.cakeplatform.api.modules.storefront;

import com.cakeplatform.api.modules.order.Order;
import com.cakeplatform.api.modules.order.OrderRepository;
import com.cakeplatform.api.modules.shop.Shop;
import com.cakeplatform.api.modules.shop.ShopRepository;
import com.cakeplatform.api.modules.product.Product;
import com.cakeplatform.api.modules.product.ProductRepository;
import com.cakeplatform.api.modules.shop.ShopDeliverySlot;
import com.cakeplatform.api.modules.shop.ShopDeliverySlotRepository;
import com.cakeplatform.api.modules.storefront.dto.GuestOrderRequest;
import com.cakeplatform.api.modules.storefront.dto.StorefrontOrderItem;
import com.cakeplatform.api.modules.order.service.OrderService;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.test.context.ActiveProfiles;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
public class StorefrontCapacityTest {

    @Autowired
    private CustomerStorefrontService customerStorefrontService;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private ShopRepository shopRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private ShopDeliverySlotRepository deliverySlotRepository;

    @Autowired
    private OrderService orderService;

    private Shop shop;
    private ShopDeliverySlot slot;
    private Product product;

    @Autowired
    private com.cakeplatform.api.modules.user.UserRepository userRepository;

    @Autowired
    private com.cakeplatform.api.modules.subscription.SubscriptionRepository subscriptionRepository;

    @BeforeEach
    public void setup() {
        com.cakeplatform.api.modules.user.User user = new com.cakeplatform.api.modules.user.User();
        user.setEmail("owner_" + java.util.UUID.randomUUID().toString() + "@test.com");
        user.setFullName("Test Owner");
        user.setMobile(String.valueOf(System.currentTimeMillis()).substring(3)); // 10 digits approx
        user.setPasswordHash("password");
        user.setRole(com.cakeplatform.api.modules.user.UserRole.SHOP_OWNER);
        user = userRepository.save(user);

        shop = new Shop();
        shop.setOwner(user);
        shop.setBusinessName("Test Bakery");
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

    @Test
    public void testPaymentPendingConsumesCapacity() {
        GuestOrderRequest req1 = new GuestOrderRequest();
        req1.setCustomerName("Alice");
        req1.setDeliveryAddress("Flat 101, Test Road, Pune");
        req1.setDeliveryDate(LocalDate.now().plusDays(1));
        req1.setDeliverySlotId(slot.getId());
        req1.setPaymentMethod("ONLINE_PAYMENT");
        StorefrontOrderItem item = new StorefrontOrderItem();
        item.setProductId(product.getId());
        item.setQuantity(1);
        item.setQuantity(1);
        req1.setItems(List.of(item));

        Order order1 = customerStorefrontService.placeGuestOrder(shop.getId(), req1);
        assertEquals("PAYMENT_PENDING", order1.getOrderStatus());

        GuestOrderRequest req2 = new GuestOrderRequest();
        req2.setCustomerName("Bob");
        req2.setDeliveryAddress("Flat 102, Test Road, Pune");
        req2.setDeliveryDate(LocalDate.now().plusDays(1));
        req2.setDeliverySlotId(slot.getId());
        req2.setPaymentMethod("ONLINE_PAYMENT");
        StorefrontOrderItem item2 = new StorefrontOrderItem();
        item2.setProductId(product.getId());
        item2.setQuantity(1);
        req2.setItems(List.of(item2));

        Exception exception = assertThrows(RuntimeException.class, () -> {
            customerStorefrontService.placeGuestOrder(shop.getId(), req2);
        });

        assertTrue(exception.getMessage().contains("fully booked") || exception instanceof com.cakeplatform.api.exception.DeliverySlotFullException);
    }

    @Test
    public void testConcurrentCheckoutAttemptsCannotOverbook() throws InterruptedException {
        int threadCount = 3;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch latch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(threadCount);
        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger failCount = new AtomicInteger(0);

        for (int i = 0; i < threadCount; i++) {
            final int index = i;
            executor.submit(() -> {
                try {
                    latch.await();
                    GuestOrderRequest req = new GuestOrderRequest();
                    req.setCustomerName("User " + index);
                    req.setCustomerPhone("1234567890");
                    req.setDeliveryAddress("Flat " + index + ", Test Road, Pune");
                    req.setDeliveryDate(LocalDate.now().plusDays(1));
                    req.setDeliverySlotId(slot.getId());
                    req.setPaymentMethod("ONLINE_PAYMENT");
                    StorefrontOrderItem item = new StorefrontOrderItem();
                    item.setProductId(product.getId());
                    item.setQuantity(1);
                    req.setItems(List.of(item));

                    customerStorefrontService.placeGuestOrder(shop.getId(), req);
                    successCount.incrementAndGet();
                } catch (Exception e) {
                    failCount.incrementAndGet();
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        latch.countDown();
        doneLatch.await();

        assertEquals(1, successCount.get(), "Only one order should succeed due to slot lock and capacity check");
        assertEquals(threadCount - 1, failCount.get(), "Other orders should fail with capacity full exception");
    }

    @Test
    public void testCancelledOrderReleasesCapacity() {
        GuestOrderRequest req1 = new GuestOrderRequest();
        req1.setCustomerName("Alice");
        req1.setCustomerPhone("1234567890");
        req1.setDeliveryAddress("Flat 101, Test Road, Pune");
        req1.setDeliveryDate(LocalDate.now().plusDays(1));
        req1.setDeliverySlotId(slot.getId());
        req1.setPaymentMethod("ONLINE_PAYMENT");
        StorefrontOrderItem item = new StorefrontOrderItem();
        item.setProductId(product.getId());
        item.setQuantity(1);
        req1.setItems(List.of(item));

        Order order1 = customerStorefrontService.placeGuestOrder(shop.getId(), req1);
        assertEquals("PAYMENT_PENDING", order1.getOrderStatus());

        // Cancel order using orderRepository to simulate cancellation
        order1.setOrderStatus("CANCELLED");
        orderRepository.save(order1);

        GuestOrderRequest req2 = new GuestOrderRequest();
        req2.setCustomerName("Bob");
        req2.setCustomerPhone("1234567890");
        req2.setDeliveryAddress("Flat 102, Test Road, Pune");
        req2.setDeliveryDate(LocalDate.now().plusDays(1));
        req2.setDeliverySlotId(slot.getId());
        req2.setPaymentMethod("ONLINE_PAYMENT");
        StorefrontOrderItem item2 = new StorefrontOrderItem();
        item2.setProductId(product.getId());
        item2.setQuantity(1);
        req2.setItems(List.of(item2));

        Order order2 = customerStorefrontService.placeGuestOrder(shop.getId(), req2);
        assertEquals("PAYMENT_PENDING", order2.getOrderStatus());
    }
}
