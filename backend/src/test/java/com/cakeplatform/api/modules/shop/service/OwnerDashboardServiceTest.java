package com.cakeplatform.api.modules.shop.service;

import com.cakeplatform.api.modules.interaction.CustomCakeRequest;
import com.cakeplatform.api.modules.interaction.CustomCakeRequestRepository;
import com.cakeplatform.api.modules.order.Order;
import com.cakeplatform.api.modules.order.OrderRepository;
import com.cakeplatform.api.modules.product.ProductRepository;
import com.cakeplatform.api.modules.shop.Shop;
import com.cakeplatform.api.modules.shop.ShopRepository;
import com.cakeplatform.api.modules.shop.dto.OwnerDashboardStatsResponse;
import com.cakeplatform.api.modules.subscription.SubscriptionRepository;
import com.cakeplatform.api.modules.subscription.Subscription;
import com.cakeplatform.api.modules.subscription.SubscriptionStatus;
import com.cakeplatform.api.modules.security.ShopAccessValidator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OwnerDashboardServiceTest {

    @Mock private ShopRepository shopRepository;
    @Mock private ProductRepository productRepository;
    @Mock private OrderRepository orderRepository;
    @Mock private SubscriptionRepository subscriptionRepository;
    @Mock private CustomCakeRequestRepository customCakeRequestRepository;
    @Mock private ShopAccessValidator shopAccessValidator;

    @InjectMocks
    private OwnerDashboardService ownerDashboardService;

    private Shop shop;
    private Order paidOrderToday;
    private Order codOrderToday;
    private Order cancelledOrderToday;
    private Order pastOrder;

    @BeforeEach
    void setUp() {
        shop = new Shop();
        shop.setId(100L);
        shop.setStatus(com.cakeplatform.api.modules.shop.ShopStatus.ACTIVE);

        LocalDateTime now = LocalDateTime.now(ZoneId.of("Asia/Kolkata"));
        LocalDate todayDate = now.toLocalDate();

        paidOrderToday = new Order();
        paidOrderToday.setId(1L);
        paidOrderToday.setOrderStatus("COMPLETED");
        paidOrderToday.setPaymentStatus("PAID");
        paidOrderToday.setPaymentMethod("ONLINE");
        paidOrderToday.setTotalAmount(new BigDecimal("1000"));
        paidOrderToday.setCreatedAt(now);
        paidOrderToday.setDeliveryDate(todayDate);

        codOrderToday = new Order();
        codOrderToday.setId(2L);
        codOrderToday.setOrderStatus("NEW");
        codOrderToday.setPaymentStatus("PENDING");
        codOrderToday.setPaymentMethod("COD");
        codOrderToday.setTotalAmount(new BigDecimal("500"));
        codOrderToday.setCreatedAt(now);
        codOrderToday.setDeliveryDate(todayDate);

        cancelledOrderToday = new Order();
        cancelledOrderToday.setId(3L);
        cancelledOrderToday.setOrderStatus("CANCELLED");
        cancelledOrderToday.setPaymentStatus("FAILED");
        cancelledOrderToday.setPaymentMethod("ONLINE");
        cancelledOrderToday.setTotalAmount(new BigDecimal("2000"));
        cancelledOrderToday.setCreatedAt(now);
        cancelledOrderToday.setDeliveryDate(todayDate);
    }

    @Test
    void testDashboardStatsCalculatesAuthoritativeDataCorrectly() {
        when(shopAccessValidator.validateDashboardAccess(1L)).thenReturn(shop);
        when(productRepository.countByShopId(shop.getId())).thenReturn(10L);
        when(productRepository.countByShopIdAndStatusAndAvailability(shop.getId(), "ACTIVE", true)).thenReturn(8L);
        

        when(orderRepository.sumRevenueForShopByDateRange(eq(shop.getId()), any(), any())).thenReturn(new BigDecimal("1500"));
        when(orderRepository.countPendingConfirmationOrdersForShop(shop.getId())).thenReturn(1L);
        when(orderRepository.sumPendingCodForShop(shop.getId())).thenReturn(java.util.Collections.singletonList(new Object[]{new BigDecimal("500"), 1L}));
        when(orderRepository.countDeliveriesForShopByDateRange(eq(shop.getId()), any(), any())).thenReturn(1L);
        when(orderRepository.countUnscheduledDeliveriesForShopByDateRange(eq(shop.getId()), any(), any())).thenReturn(2L);
        // Mock subscription data
        Subscription subscription = new Subscription();
        subscription.setStatus(SubscriptionStatus.ACTIVE);
        when(subscriptionRepository.findByShopId(shop.getId())).thenReturn(java.util.Collections.singletonList(subscription));

        // Mock pending custom enquiries
        when(customCakeRequestRepository.countByShopIdAndStatus(shop.getId(), "PENDING")).thenReturn(2L);

        OwnerDashboardStatsResponse stats = ownerDashboardService.getDashboardStats(1L);

        // Assert Product Isolation
        assertEquals(10L, stats.getTotalProducts());
        assertEquals(8L, stats.getActiveProducts());

        // Assert Today's Revenue (should only include PAID or COD, excluding CANCELLED)
        // paidOrderToday (1000) + codOrderToday (500) = 1500
        assertEquals(0, new BigDecimal("1500").compareTo(stats.getTodayRevenue()));

        // Assert COD Logic
        assertEquals(1, stats.getPendingCodOrders());
        assertEquals(0, new BigDecimal("500").compareTo(stats.getPendingCodAmount()));

        // Assert Action Items (1 Pending COD + 1 Pending Conf Order + 2 Inactive Catalog)
        // Original action items count (pending COD + pending confirmation + inactive catalog)
        // Updated expectations with pending custom enquiries and today deliveries
        assertEquals(SubscriptionStatus.ACTIVE.name(), stats.getSubscriptionStatus());
        assertEquals(2L, stats.getPendingCustomEnquiries());
        assertEquals(1L, stats.getPendingConfirmationOrders());
        assertEquals(1L, stats.getTodayDeliveries());
        // Updated total action items count (1 pending COD + 1 pending confirmation + 2 unscheduled deliveries + 2 pending custom + 2 inactive catalog = 8)
        assertEquals(8, stats.getTotalActionItems());

        // Assert Unscheduled Deliveries
        assertEquals(2, stats.getUnscheduledTodayDeliveries());
    }
}





