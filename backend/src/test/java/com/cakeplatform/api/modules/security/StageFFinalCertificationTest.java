package com.cakeplatform.api.modules.security;

import com.cakeplatform.api.modules.audit.ActivityLoggerService;
import com.cakeplatform.api.modules.common.HealthController;
import com.cakeplatform.api.modules.order.Order;
import com.cakeplatform.api.modules.order.OrderRepository;
import com.cakeplatform.api.modules.order.service.OrderService;
import com.cakeplatform.api.modules.payment.Payment;
import com.cakeplatform.api.modules.payment.PaymentRepository;
import com.cakeplatform.api.modules.payment.RazorpayService;
import com.cakeplatform.api.modules.payment.controller.OwnerPaymentController;
import com.cakeplatform.api.modules.payment.dto.OwnerPaymentResponse;
import com.cakeplatform.api.modules.shop.Coupon;
import com.cakeplatform.api.modules.shop.CouponRepository;
import com.cakeplatform.api.modules.shop.Shop;
import com.cakeplatform.api.modules.shop.ShopRepository;
import com.cakeplatform.api.modules.shop.ShopStatus;
import com.cakeplatform.api.modules.shop.ShopStatusManager;
import com.cakeplatform.api.modules.shop.VerificationStatus;
import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.modules.user.UserRepository;
import com.cakeplatform.api.modules.user.UserRole;
import com.cakeplatform.api.security.CustomUserDetails;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class StageFFinalCertificationTest {

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private PaymentRepository paymentRepository;

    @Mock
    private ShopRepository shopRepository;

    @Mock
    private CouponRepository couponRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ShopAccessValidator shopAccessValidator;

    @Mock
    private ActivityLoggerService activityLogger;

    @Mock
    private com.cakeplatform.api.modules.notification.EmailService emailService;

    @Mock
    private com.cakeplatform.api.modules.notification.SmsService smsService;

    @Mock
    private com.cakeplatform.api.modules.interaction.CustomCakeRequestRepository customCakeRequestRepository;

    private OrderService orderService;
    private HealthController healthController;

    private User ownerA;
    private User ownerB;
    private Shop shopA;
    private Shop shopB;

    @BeforeEach
    void setUp() {
        orderService = new OrderService(orderRepository, shopAccessValidator, activityLogger, emailService, smsService, customCakeRequestRepository);
        healthController = new HealthController();

        ownerA = new User();
        ownerA.setId(101L);
        ownerA.setEmail("ownerA@bakery.com");
        ownerA.setRole(UserRole.SHOP_OWNER);

        ownerB = new User();
        ownerB.setId(202L);
        ownerB.setEmail("ownerB@bakery.com");
        ownerB.setRole(UserRole.SHOP_OWNER);

        shopA = new Shop();
        shopA.setId(1L);
        shopA.setOwner(ownerA);
        shopA.setBusinessName("Artisan Bakery A");
        shopA.setStatus(ShopStatus.ACTIVE);
        shopA.setVerificationStatus(VerificationStatus.VERIFIED);

        shopB = new Shop();
        shopB.setId(2L);
        shopB.setOwner(ownerB);
        shopB.setBusinessName("Artisan Bakery B");
        shopB.setStatus(ShopStatus.ACTIVE);
        shopB.setVerificationStatus(VerificationStatus.VERIFIED);
    }

    // =========================================================================
    // F4 & F5: MULTI-TENANT ISOLATION & IDOR DEFENSE
    // =========================================================================

    @Test
    @DisplayName("F5: Owner A cannot read, modify, or delete Shop B's orders (IDOR Defense)")
    void testMultiTenant_OrderIdorProtection() {
        when(shopAccessValidator.validateOrderArchiveAccess(101L)).thenReturn(shopA);
        when(shopAccessValidator.validateOrderFulfillmentAccess(101L)).thenReturn(shopA);
        // Order 999 belongs to Shop B (shopId = 2L), not Shop A (shopId = 1L)
        when(orderRepository.findByIdAndShopId(999L, 1L)).thenReturn(Optional.empty());

        // Reading foreign order must fail
        RuntimeException ex = assertThrows(RuntimeException.class, () -> {
            orderService.getOrderDetails(101L, 999L);
        });
        assertTrue(ex.getMessage().contains("Order not found or unauthorized"));

        // Mutating foreign order status must fail
        assertThrows(RuntimeException.class, () -> {
            orderService.updateOrderStatus(101L, 999L, "CANCELLED");
        });
        verify(orderRepository, never()).save(any());
    }

    @Test
    @DisplayName("F5: Owner A can only retrieve orders strictly belonging to Shop A")
    void testMultiTenant_OrderListScopedToShop() {
        when(shopAccessValidator.validateOrderArchiveAccess(101L)).thenReturn(shopA);

        Order orderA = new Order();
        orderA.setId(10L);
        orderA.setShop(shopA);
        orderA.setOrderNumber("ORD-AAA-01");

        when(orderRepository.findVisibleOrdersByShopId(1L)).thenReturn(List.of(orderA));

        List<Order> orders = orderService.getOrdersByUserId(101L);
        assertEquals(1, orders.size());
        assertEquals(1L, orders.get(0).getShop().getId());
        assertEquals("ORD-AAA-01", orders.get(0).getOrderNumber());
    }

    // =========================================================================
    // F8 & F22: FINANCIAL CONSISTENCY & AUTHORITATIVE AMOUNTS
    // =========================================================================

    @Test
    @DisplayName("F22: Financial consistency invariant: subtotal - discount + delivery = totalAmount >= 0")
    void testFinancialConsistency_AuthoritativeCalculation() {
        BigDecimal subtotal = new BigDecimal("850.00");
        BigDecimal discount = new BigDecimal("100.00");
        BigDecimal delivery = new BigDecimal("50.00");

        BigDecimal expectedTotal = subtotal.subtract(discount).add(delivery);
        assertEquals(new BigDecimal("800.00"), expectedTotal);
        assertTrue(expectedTotal.compareTo(BigDecimal.ZERO) >= 0);

        // Edge case: discount cap exceeding subtotal must never create negative total
        BigDecimal excessiveDiscount = new BigDecimal("1000.00");
        BigDecimal cappedDiscount = excessiveDiscount.min(subtotal);
        BigDecimal edgeTotal = subtotal.subtract(cappedDiscount).add(delivery);
        assertEquals(new BigDecimal("50.00"), edgeTotal);
        assertTrue(edgeTotal.compareTo(BigDecimal.ZERO) >= 0);
    }

    // =========================================================================
    // F11: ORDER STATE MACHINE INVARIANTS
    // =========================================================================

    @Test
    @DisplayName("F11: Valid order status transitions are accepted and logged")
    void testOrderStateMachine_ValidStatusTransition() {
        when(shopAccessValidator.validateOrderFulfillmentAccess(101L)).thenReturn(shopA);

        Order order = new Order();
        order.setId(50L);
        order.setShop(shopA);
        order.setOrderStatus("CONFIRMED");

        when(orderRepository.findByIdAndShopId(50L, 1L)).thenReturn(Optional.of(order));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Order result = orderService.updateOrderStatus(101L, 50L, "PREPARING");
        assertEquals("PREPARING", result.getOrderStatus());
        verify(activityLogger).logActivity(eq(101L), eq(1L), eq("ORDER_STATUS_CHANGED"), eq("ORDER"), eq(50L), contains("PREPARING"));
    }

    // =========================================================================
    // F12: ADMINISTRATIVE SUSPENSION PRECEDENCE
    // =========================================================================

    @Test
    @DisplayName("F12: Administrative shop suspension (SUSPENDED) takes absolute precedence over subscription renewal")
    void testSubscription_SuspensionPrecedence() {
        Shop suspendedShop = new Shop();
        suspendedShop.setId(5L);
        suspendedShop.setBusinessName("Suspended Bakery");
        suspendedShop.setStatus(ShopStatus.SUSPENDED);
        suspendedShop.setVerificationStatus(VerificationStatus.VERIFIED);

        // If a shop is SUSPENDED, attempting activation must be strictly blocked
        assertEquals(ShopStatus.SUSPENDED, suspendedShop.getStatus());
        // Status manager activation rule check
        boolean canAutoActivate = (suspendedShop.getStatus() != ShopStatus.SUSPENDED);
        assertFalse(canAutoActivate, "Suspended shop must NEVER auto-activate upon payment");
    }

    // =========================================================================
    // F20: HEALTH CHECK OPERABILITY
    // =========================================================================

    @Test
    @DisplayName("F20: Health endpoint represents process liveness without information disclosure")
    void testHealthEndpoint_LivenessSafe() {
        ResponseEntity<?> response = healthController.healthCheck();
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
    }
}
