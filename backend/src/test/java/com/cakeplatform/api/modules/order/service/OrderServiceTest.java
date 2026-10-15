package com.cakeplatform.api.modules.order.service;

import com.cakeplatform.api.modules.audit.ActivityLoggerService;
import com.cakeplatform.api.modules.interaction.CustomCakeRequestRepository;
import com.cakeplatform.api.modules.notification.EmailService;
import com.cakeplatform.api.modules.notification.SmsService;
import com.cakeplatform.api.modules.order.Order;
import com.cakeplatform.api.modules.order.OrderRepository;
import com.cakeplatform.api.modules.security.ShopAccessValidator;
import com.cakeplatform.api.modules.shop.Shop;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock
    private OrderRepository orderRepository;
    @Mock
    private ShopAccessValidator shopAccessValidator;
    @Mock
    private ActivityLoggerService activityLogger;
    @Mock
    private EmailService emailService;
    @Mock
    private SmsService smsService;
    @Mock
    private CustomCakeRequestRepository customCakeRequestRepository;

    @InjectMocks
    private OrderService orderService;

    private Shop shop;
    private Order order;
    private final Long OWNER_ID = 1L;
    private final Long SHOP_ID = 10L;
    private final Long ORDER_ID = 100L;

    @BeforeEach
    void setUp() {
        shop = new Shop();
        shop.setId(SHOP_ID);
        shop.setBusinessName("Test Bakery");

        order = new Order();
        order.setId(ORDER_ID);
        order.setOrderNumber("ORD-123");
        order.setShop(shop);
        order.setCustomerName("Test Customer");
        order.setCustomerEmail("customer@test.com");
        order.setCustomerPhone("1234567890");
        order.setOrderStatus("NEW");
        order.setPaymentStatus("PENDING");
    }

    @AfterEach
    void tearDown() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    // --- 1. Order Status Transitions ---

    @Test
    @DisplayName("Valid transition updates status and saves order")
    void testValidTransition() {
        when(shopAccessValidator.validateOrderFulfillmentAccess(OWNER_ID)).thenReturn(shop);
        when(orderRepository.findByIdAndShopId(ORDER_ID, SHOP_ID)).thenReturn(Optional.of(order));
        when(orderRepository.save(any(Order.class))).thenAnswer(i -> i.getArgument(0));

        Order result = orderService.updateOrderStatus(OWNER_ID, ORDER_ID, "PREPARING");

        assertEquals("PREPARING", result.getOrderStatus());
        verify(orderRepository).save(order);
        verify(activityLogger).logActivity(eq(OWNER_ID), eq(SHOP_ID), eq("ORDER_STATUS_CHANGED"), eq("ORDER"), eq(ORDER_ID), contains("PREPARING"));
    }

    @Test
    @DisplayName("Invalid transition throws exception and does not save")
    void testInvalidTransition() {
        order.setOrderStatus("DELIVERED");
        when(shopAccessValidator.validateOrderFulfillmentAccess(OWNER_ID)).thenReturn(shop);
        when(orderRepository.findByIdAndShopId(ORDER_ID, SHOP_ID)).thenReturn(Optional.of(order));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> 
            orderService.updateOrderStatus(OWNER_ID, ORDER_ID, "PREPARING")
        );

        assertTrue(ex.getMessage().contains("Invalid status transition"));
        verify(orderRepository, never()).save(any());
        verify(emailService, never()).sendEmail(anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("Terminal states cannot be modified")
    void testTerminalStateCannotTransition() {
        order.setOrderStatus("COMPLETED");
        when(shopAccessValidator.validateOrderFulfillmentAccess(OWNER_ID)).thenReturn(shop);
        when(orderRepository.findByIdAndShopId(ORDER_ID, SHOP_ID)).thenReturn(Optional.of(order));

        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> 
            orderService.updateOrderStatus(OWNER_ID, ORDER_ID, "CANCELLED")
        );

        assertTrue(ex.getMessage().contains("terminal state"));
        verify(orderRepository, never()).save(any());
    }

    // --- 2. Payment Status Updates ---

    @Test
    @DisplayName("Update payment to PAID sets paidAt and transaction ID")
    void testUpdatePaymentToPaid() {
        when(shopAccessValidator.validateOrderFulfillmentAccess(OWNER_ID)).thenReturn(shop);
        when(orderRepository.findByIdAndShopId(ORDER_ID, SHOP_ID)).thenReturn(Optional.of(order));
        when(orderRepository.save(any(Order.class))).thenAnswer(i -> i.getArgument(0));

        Order result = orderService.updatePaymentStatus(OWNER_ID, ORDER_ID, "PAID", "NOTE_123");

        assertEquals("PAID", result.getPaymentStatus());
        assertNotNull(result.getPaidAt());
        assertEquals("NOTE_123", result.getTransactionId());
        verify(orderRepository).save(order);
    }

    @Test
    @DisplayName("Online PAID payment cannot revert to PENDING")
    void testOnlinePaymentCannotRevertToPending() {
        order.setPaymentStatus("PAID");
        order.setPaymentMethod("RAZORPAY");
        when(shopAccessValidator.validateOrderFulfillmentAccess(OWNER_ID)).thenReturn(shop);
        when(orderRepository.findByIdAndShopId(ORDER_ID, SHOP_ID)).thenReturn(Optional.of(order));

        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> 
            orderService.updatePaymentStatus(OWNER_ID, ORDER_ID, "PENDING", null)
        );

        assertTrue(ex.getMessage().contains("cannot be reverted to PENDING"));
        verify(orderRepository, never()).save(any());
    }

    @Test
    @DisplayName("Updating payment to REFUNDED dispatches truthful manual refund email and SMS")
    void testUpdatePaymentToRefunded_TruthfulNotifications() {
        order.setOrderStatus("CANCELLED");
        order.setPaymentStatus("PAID");
        order.setTotalAmount(new java.math.BigDecimal("750.00"));
        when(shopAccessValidator.validateOrderFulfillmentAccess(OWNER_ID)).thenReturn(shop);
        when(orderRepository.findByIdAndShopId(ORDER_ID, SHOP_ID)).thenReturn(Optional.of(order));
        when(orderRepository.save(any(Order.class))).thenAnswer(i -> i.getArgument(0));

        Order result = orderService.updatePaymentStatus(OWNER_ID, ORDER_ID, "REFUNDED", "REFUND_ISSUED");

        assertEquals("REFUNDED", result.getPaymentStatus());
        verify(orderRepository).save(order);

        // Verify truthful manual-refund email wording
        verify(emailService).sendEmail(
                eq("customer@test.com"),
                eq("Manual Refund Recorded: Order #ORD-123 at Test Bakery"),
                contains("A manual refund of ₹750.00 for your cancelled order #ORD-123 at Test Bakery has been recorded by the bakery. If you have questions regarding your refund settlement, please contact the bakery directly.")
        );

        // Verify truthful manual-refund SMS wording
        verify(smsService).sendSms(
                eq("1234567890"),
                eq("Manual refund recorded: ₹750.00 for order #ORD-123 at Test Bakery. Contact the bakery for settlement details.")
        );
    }

    @Test
    @DisplayName("Already REFUNDED order throws exception and prevents duplicate refund or status changes")
    void testAlreadyRefundedOrderCannotBeChanged() {
        order.setPaymentStatus("REFUNDED");
        when(shopAccessValidator.validateOrderFulfillmentAccess(OWNER_ID)).thenReturn(shop);
        when(orderRepository.findByIdAndShopId(ORDER_ID, SHOP_ID)).thenReturn(Optional.of(order));

        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
            orderService.updatePaymentStatus(OWNER_ID, ORDER_ID, "PAID", "ATTEMPT_REOPEN")
        );

        assertTrue(ex.getMessage().contains("already REFUNDED and cannot be changed"));
        verify(orderRepository, never()).save(any());
        verify(emailService, never()).sendEmail(anyString(), anyString(), anyString());
        verify(smsService, never()).sendSms(anyString(), anyString());
    }

    // --- 3. Tenant Isolation ---

    @Test
    @DisplayName("Accessing an order not belonging to owner's shop throws exception")
    void testTenantIsolation() {
        when(shopAccessValidator.validateOrderArchiveAccess(OWNER_ID)).thenReturn(shop);
        when(orderRepository.findByIdAndShopId(ORDER_ID, SHOP_ID)).thenReturn(Optional.empty());

        RuntimeException ex = assertThrows(RuntimeException.class, () -> 
            orderService.getOrderDetails(OWNER_ID, ORDER_ID)
        );

        assertEquals("Order not found or unauthorized", ex.getMessage());
    }

    // --- 4. Transaction and Notification Safety ---

    @Test
    @DisplayName("Notifications are registered but not sent until transaction commits")
    void testNotificationTransactionSafety_Commit() {
        // Activate Spring transaction sync
        TransactionSynchronizationManager.initSynchronization();

        when(shopAccessValidator.validateOrderFulfillmentAccess(OWNER_ID)).thenReturn(shop);
        when(orderRepository.findByIdAndShopId(ORDER_ID, SHOP_ID)).thenReturn(Optional.of(order));
        when(orderRepository.save(any(Order.class))).thenAnswer(i -> i.getArgument(0));

        orderService.updateOrderStatus(OWNER_ID, ORDER_ID, "PREPARING");

        // Assert no notification sent yet
        verify(emailService, never()).sendEmail(anyString(), anyString(), anyString());

        // Get the registered sync and simulate commit
        List<TransactionSynchronization> syncs = TransactionSynchronizationManager.getSynchronizations();
        assertEquals(1, syncs.size());
        
        syncs.get(0).afterCommit();

        // Now notification should be sent
        verify(emailService).sendEmail(eq("customer@test.com"), anyString(), anyString());
    }

    @Test
    @DisplayName("Notifications are discarded when transaction rolls back")
    void testNotificationTransactionSafety_Rollback() {
        TransactionSynchronizationManager.initSynchronization();

        when(shopAccessValidator.validateOrderFulfillmentAccess(OWNER_ID)).thenReturn(shop);
        when(orderRepository.findByIdAndShopId(ORDER_ID, SHOP_ID)).thenReturn(Optional.of(order));
        when(orderRepository.save(any(Order.class))).thenAnswer(i -> i.getArgument(0));

        orderService.updateOrderStatus(OWNER_ID, ORDER_ID, "PREPARING");

        // Simulate rollback - just clear syncs without calling afterCommit
        TransactionSynchronizationManager.clearSynchronization();

        verify(emailService, never()).sendEmail(anyString(), anyString(), anyString());
    }
}
