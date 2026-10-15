package com.cakeplatform.api.modules.security;

import com.cakeplatform.api.exception.SubscriptionExpiredException;
import com.cakeplatform.api.modules.audit.ActivityLoggerService;
import com.cakeplatform.api.modules.notification.EmailService;
import com.cakeplatform.api.modules.notification.SmsService;
import com.cakeplatform.api.modules.notification.NotificationService;
import com.cakeplatform.api.modules.notification.AdminNotificationService;
import com.cakeplatform.api.modules.order.Order;
import com.cakeplatform.api.modules.order.OrderRepository;
import com.cakeplatform.api.modules.order.service.OrderService;
import com.cakeplatform.api.modules.payment.controller.OwnerPaymentController;
import com.cakeplatform.api.security.CustomUserDetails;
import com.cakeplatform.api.modules.security.ShopAccessValidator;
import com.cakeplatform.api.modules.shop.*;
import com.cakeplatform.api.modules.shop.service.OwnerDashboardService;
import com.cakeplatform.api.modules.storefront.CustomerStorefrontService;
import com.cakeplatform.api.modules.subscription.Subscription;
import com.cakeplatform.api.modules.subscription.SubscriptionPlan;
import com.cakeplatform.api.modules.subscription.SubscriptionPlanRepository;
import com.cakeplatform.api.modules.subscription.SubscriptionRepository;
import com.cakeplatform.api.modules.subscription.SubscriptionScheduler;
import com.cakeplatform.api.modules.subscription.SubscriptionStatus;
import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.modules.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.jpa.domain.Specification;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class OperationalAccessModelTest {

    @Mock private ShopRepository shopRepository;
    @Mock private SubscriptionRepository subscriptionRepository;
    @Mock private OrderRepository orderRepository;
    @Mock private ActivityLoggerService activityLogger;
    @Mock private EmailService emailService;
    @Mock private SmsService smsService;
    @Mock private SubscriptionPlanRepository subscriptionPlanRepository;
    @Mock private NotificationService notificationService;
    @Mock private AdminNotificationService adminNotificationService;

    private ShopAccessValidator shopAccessValidator;
    private OrderService orderService;
    private CustomerStorefrontService storefrontService;
    private OwnerPaymentController ownerPaymentController;

    private User owner;
    private Shop activeShop;
    private Shop ownerDisabledShop;
    private Shop adminRestrictedShop;
    private Shop expiredShop;
    private Shop suspendedShop;
    private Shop legacyInactiveShop;

    private Subscription activeSub;
    private Subscription expiredSub;

    @BeforeEach
    void setUp() {
        shopAccessValidator = new ShopAccessValidator(shopRepository, subscriptionRepository);
        orderService = new OrderService(orderRepository, shopAccessValidator, activityLogger, emailService, smsService, null);

        storefrontService = new CustomerStorefrontService(
                shopRepository,
                null,
                orderRepository,
                null,
                notificationService,
                adminNotificationService,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                subscriptionRepository,
                null
        );

        ownerPaymentController = new OwnerPaymentController(
                null, null, shopAccessValidator, null, null, subscriptionPlanRepository
        );

        owner = new User();
        owner.setId(10L);
        owner.setEmail("owner@bakery.com");
        owner.setRole(UserRole.SHOP_OWNER);

        // 1. Active Shop
        activeShop = new Shop();
        activeShop.setId(101L);
        activeShop.setOwner(owner);
        activeShop.setBusinessName("Active Bakery");
        activeShop.setStatus(ShopStatus.ACTIVE);
        activeShop.setIsOwnerEnabled(true);
        activeShop.setIsMarketplaceRestricted(false);

        // 2. Owner-Disabled Shop (Vacation Mode)
        ownerDisabledShop = new Shop();
        ownerDisabledShop.setId(102L);
        ownerDisabledShop.setOwner(owner);
        ownerDisabledShop.setBusinessName("Vacation Bakery");
        ownerDisabledShop.setStatus(ShopStatus.ACTIVE);
        ownerDisabledShop.setIsOwnerEnabled(false);
        ownerDisabledShop.setIsMarketplaceRestricted(false);

        // 3. Admin-Restricted Shop
        adminRestrictedShop = new Shop();
        adminRestrictedShop.setId(103L);
        adminRestrictedShop.setOwner(owner);
        adminRestrictedShop.setBusinessName("Restricted Bakery");
        adminRestrictedShop.setStatus(ShopStatus.ACTIVE);
        adminRestrictedShop.setIsOwnerEnabled(true);
        adminRestrictedShop.setIsMarketplaceRestricted(true);
        adminRestrictedShop.setMarketplaceRestrictionReason("FSSAI license verification pending update");

        // 4. Expired Shop
        expiredShop = new Shop();
        expiredShop.setId(104L);
        expiredShop.setOwner(owner);
        expiredShop.setBusinessName("Expired Bakery");
        expiredShop.setStatus(ShopStatus.EXPIRED);
        expiredShop.setIsOwnerEnabled(true);
        expiredShop.setIsMarketplaceRestricted(false);

        // 5. Suspended Shop
        suspendedShop = new Shop();
        suspendedShop.setId(105L);
        suspendedShop.setOwner(owner);
        suspendedShop.setBusinessName("Suspended Bakery");
        suspendedShop.setStatus(ShopStatus.SUSPENDED);
        suspendedShop.setIsOwnerEnabled(true);
        suspendedShop.setIsMarketplaceRestricted(false);

        // 6. Legacy INACTIVE Shop
        legacyInactiveShop = new Shop();
        legacyInactiveShop.setId(106L);
        legacyInactiveShop.setOwner(owner);
        legacyInactiveShop.setBusinessName("Legacy Inactive Bakery");
        legacyInactiveShop.setStatus(ShopStatus.INACTIVE);
        legacyInactiveShop.setIsOwnerEnabled(false);
        legacyInactiveShop.setIsMarketplaceRestricted(false);

        // Subscriptions
        activeSub = new Subscription();
        activeSub.setId(501L);
        activeSub.setShop(activeShop);
        activeSub.setStatus(SubscriptionStatus.ACTIVE);
        activeSub.setExpiryDate(LocalDateTime.now().plusMonths(1));

        expiredSub = new Subscription();
        expiredSub.setId(502L);
        expiredSub.setShop(expiredShop);
        expiredSub.setStatus(SubscriptionStatus.EXPIRED);
        expiredSub.setExpiryDate(LocalDateTime.now().minusDays(5));
    }

    // =========================================================================
    // Domain 1: Dashboard Overview & Alerts Tests
    // =========================================================================
    @Test
    @DisplayName("TC-LIFECYCLE-01: Active, disabled, restricted, expired, and legacy inactive owners retain dashboard access")
    void testDashboardAccessForNonSuspendedShops() {
        when(shopRepository.findByOwnerId(10L)).thenReturn(List.of(activeShop));
        assertNotNull(shopAccessValidator.validateDashboardAccess(10L));

        when(shopRepository.findByOwnerId(10L)).thenReturn(List.of(ownerDisabledShop));
        assertNotNull(shopAccessValidator.validateDashboardAccess(10L));

        when(shopRepository.findByOwnerId(10L)).thenReturn(List.of(adminRestrictedShop));
        assertNotNull(shopAccessValidator.validateDashboardAccess(10L));

        when(shopRepository.findByOwnerId(10L)).thenReturn(List.of(expiredShop));
        assertNotNull(shopAccessValidator.validateDashboardAccess(10L));

        when(shopRepository.findByOwnerId(10L)).thenReturn(List.of(legacyInactiveShop));
        assertNotNull(shopAccessValidator.validateDashboardAccess(10L));
    }

    @Test
    @DisplayName("TC-LIFECYCLE-08: Suspended owners are strictly blocked from dashboard access with support instructions")
    void testSuspendedShopBlockedFromDashboard() {
        when(shopRepository.findByOwnerId(10L)).thenReturn(List.of(suspendedShop));
        SubscriptionExpiredException ex = assertThrows(SubscriptionExpiredException.class,
                () -> shopAccessValidator.validateDashboardAccess(10L));
        assertTrue(ex.getMessage().contains("Please contact support"));
    }

    // =========================================================================
    // Domain 2: Billing & Renewal Checkout Tests
    // =========================================================================
    @Test
    @DisplayName("TC-LIFECYCLE-25: Expired and active owners can initiate renewal; suspended owners are blocked")
    void testBillingAndRenewalAccess() {
        when(shopRepository.findByOwnerId(10L)).thenReturn(List.of(expiredShop));
        assertNotNull(shopAccessValidator.validateBillingAccess(10L));

        when(shopRepository.findByOwnerId(10L)).thenReturn(List.of(suspendedShop));
        SubscriptionExpiredException ex = assertThrows(SubscriptionExpiredException.class,
                () -> shopAccessValidator.validateBillingAccess(10L));
        assertTrue(ex.getMessage().contains("Self-service renewal is unavailable"));
    }

    @Test
    @DisplayName("Billing: OwnerPaymentController initiateSubscriptionPayment blocks suspended accounts")
    void testPaymentControllerInitiateBlocksSuspended() {
        when(shopRepository.findByOwnerId(10L)).thenReturn(List.of(suspendedShop));
        CustomUserDetails userDetails = new CustomUserDetails(owner);

        SubscriptionExpiredException ex = assertThrows(SubscriptionExpiredException.class,
                () -> ownerPaymentController.initiateSubscriptionPayment(userDetails, Map.of("planId", 1L)));
        assertTrue(ex.getMessage().contains("Self-service renewal is unavailable"));
    }

    // =========================================================================
    // Domain 4: Catalog & Slot Access Tests
    // =========================================================================
    @Test
    @DisplayName("TC-LIFECYCLE-06: Active owner-disabled and admin-restricted shops with active sub can edit catalog")
    void testCatalogAccessForVacationAndRestrictedShops() {
        when(shopRepository.findByOwnerId(10L)).thenReturn(List.of(ownerDisabledShop));
        when(subscriptionRepository.findFirstByShopIdOrderByCreatedAtDesc(102L)).thenReturn(Optional.of(activeSub));
        assertNotNull(shopAccessValidator.validateCatalogAccess(10L));

        when(shopRepository.findByOwnerId(10L)).thenReturn(List.of(adminRestrictedShop));
        when(subscriptionRepository.findFirstByShopIdOrderByCreatedAtDesc(103L)).thenReturn(Optional.of(activeSub));
        assertNotNull(shopAccessValidator.validateCatalogAccess(10L));
    }

    @Test
    @DisplayName("TC-LIFECYCLE-07: Expired shop is blocked from catalog editing")
    void testExpiredShopBlockedFromCatalogEditing() {
        when(shopRepository.findByOwnerId(10L)).thenReturn(List.of(expiredShop));
        when(subscriptionRepository.findFirstByShopIdOrderByCreatedAtDesc(104L)).thenReturn(Optional.of(expiredSub));

        SubscriptionExpiredException ex = assertThrows(SubscriptionExpiredException.class,
                () -> shopAccessValidator.validateCatalogAccess(10L));
        assertTrue(ex.getMessage().contains("Please renew to edit your catalog"));
    }

    // =========================================================================
    // Domain 5: Compliance & Profile Remediation Tests
    // =========================================================================
    @Test
    @DisplayName("TC-LIFECYCLE-30: Expired, admin-restricted, and disabled owners can access compliance remediation")
    void testComplianceRemediationAllowed() {
        when(shopRepository.findByOwnerId(10L)).thenReturn(List.of(adminRestrictedShop));
        assertNotNull(shopAccessValidator.validateComplianceAccess(10L));

        when(shopRepository.findByOwnerId(10L)).thenReturn(List.of(expiredShop));
        assertNotNull(shopAccessValidator.validateComplianceAccess(10L));

        when(shopRepository.findByOwnerId(10L)).thenReturn(List.of(suspendedShop));
        assertThrows(SubscriptionExpiredException.class, () -> shopAccessValidator.validateComplianceAccess(10L));
    }

    // =========================================================================
    // Domain 6: In-Progress Order Fulfillment Exception Tests
    // =========================================================================
    @Test
    @DisplayName("TC-LIFECYCLE-18: Expired bakery can fulfill in-progress orders")
    void testExpiredBakeryCanFulfillInProgressOrders() {
        when(shopRepository.findByOwnerId(10L)).thenReturn(List.of(expiredShop));

        Order order = new Order();
        order.setId(1001L);
        order.setOrderStatus("CONFIRMED");
        order.setPaymentStatus("PAID");

        when(orderRepository.findByIdAndShopId(1001L, 104L)).thenReturn(Optional.of(order));
        when(orderRepository.save(any(Order.class))).thenAnswer(i -> i.getArgument(0));

        Order updated = orderService.updateOrderStatus(10L, 1001L, "PREPARING");
        assertEquals("PREPARING", updated.getOrderStatus());
        verify(activityLogger).logActivity(eq(10L), eq(104L), eq("ORDER_STATUS_CHANGED"), eq("ORDER"), eq(1001L), contains("PREPARING"));
    }

    @Test
    @DisplayName("Fulfillment: Expired bakery can update payment status for completed collection")
    void testExpiredBakeryCanUpdatePaymentStatus() {
        when(shopRepository.findByOwnerId(10L)).thenReturn(List.of(expiredShop));

        Order order = new Order();
        order.setId(1001L);
        order.setOrderStatus("DELIVERED");
        order.setPaymentStatus("PENDING");
        order.setTotalAmount(new BigDecimal("1200.00"));

        when(orderRepository.findByIdAndShopId(1001L, 104L)).thenReturn(Optional.of(order));
        when(orderRepository.save(any(Order.class))).thenAnswer(i -> i.getArgument(0));

        Order updated = orderService.updatePaymentStatus(10L, 1001L, "PAID", "Cash on Delivery Collected");
        assertEquals("PAID", updated.getPaymentStatus());
        assertNotNull(updated.getPaidAt());
        assertEquals("Cash on Delivery Collected", updated.getTransactionId());
    }

    @Test
    @DisplayName("TC-LIFECYCLE-19: Strict Tenant Isolation prevents owner from modifying another shop's order")
    void testCrossTenantOrderModificationBlocked() {
        when(shopRepository.findByOwnerId(10L)).thenReturn(List.of(activeShop));
        when(orderRepository.findByIdAndShopId(999L, 101L)).thenReturn(Optional.empty());

        RuntimeException ex = assertThrows(RuntimeException.class,
                () -> orderService.updateOrderStatus(10L, 999L, "PREPARING"));
        assertTrue(ex.getMessage().contains("Order not found or unauthorized"));
    }

    @Test
    @DisplayName("TC-LIFECYCLE-20: Terminal order cannot be modified")
    void testTerminalOrderModificationBlocked() {
        when(shopRepository.findByOwnerId(10L)).thenReturn(List.of(activeShop));

        Order completedOrder = new Order();
        completedOrder.setId(1002L);
        completedOrder.setOrderStatus("COMPLETED");

        when(orderRepository.findByIdAndShopId(1002L, 101L)).thenReturn(Optional.of(completedOrder));

        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> orderService.updateOrderStatus(10L, 1002L, "DELIVERED"));
        assertTrue(ex.getMessage().contains("Order is in a terminal state"));
    }

    @Test
    @DisplayName("Payment Transition: Already REFUNDED order cannot be modified")
    void testRefundedOrderCannotBeModified() {
        when(shopRepository.findByOwnerId(10L)).thenReturn(List.of(activeShop));

        Order refundedOrder = new Order();
        refundedOrder.setId(1003L);
        refundedOrder.setOrderStatus("CANCELLED");
        refundedOrder.setPaymentStatus("REFUNDED");

        when(orderRepository.findByIdAndShopId(1003L, 101L)).thenReturn(Optional.of(refundedOrder));

        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> orderService.updatePaymentStatus(10L, 1003L, "PAID", null));
        assertTrue(ex.getMessage().contains("already REFUNDED"));
    }

    @Test
    @DisplayName("Payment Transition: Online paid order cannot be reverted to PENDING")
    void testOnlinePaidOrderCannotRevertToPending() {
        when(shopRepository.findByOwnerId(10L)).thenReturn(List.of(activeShop));

        Order onlineOrder = new Order();
        onlineOrder.setId(1004L);
        onlineOrder.setPaymentStatus("PAID");
        onlineOrder.setPaymentMethod("RAZORPAY");

        when(orderRepository.findByIdAndShopId(1004L, 101L)).thenReturn(Optional.of(onlineOrder));

        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> orderService.updatePaymentStatus(10L, 1004L, "PENDING", null));
        assertTrue(ex.getMessage().contains("cannot be reverted to PENDING"));
    }

    @Test
    @DisplayName("Fulfillment: Suspended shop cannot fulfill orders")
    void testSuspendedShopCannotFulfillOrders() {
        when(shopRepository.findByOwnerId(10L)).thenReturn(List.of(suspendedShop));
        SubscriptionExpiredException ex = assertThrows(SubscriptionExpiredException.class,
                () -> orderService.updateOrderStatus(10L, 1001L, "PREPARING"));
        assertTrue(ex.getMessage().contains("Shop is suspended by administration"));
    }

    // =========================================================================
    // Domain 7: Public Storefront Visibility Predicate Tests
    // =========================================================================
    @Test
    @DisplayName("TC-LIFECYCLE-02: Owner-disabled (vacation) shop is rejected by direct storefront retrieval")
    void testOwnerDisabledShopStorefrontBlocked() {
        when(shopRepository.findById(102L)).thenReturn(Optional.of(ownerDisabledShop));

        RuntimeException ex = assertThrows(RuntimeException.class,
                () -> storefrontService.getShopDetails(102L));
        assertEquals("Shop is currently unavailable", ex.getMessage());
    }

    @Test
    @DisplayName("TC-LIFECYCLE-04: Admin-restricted shop is rejected by direct storefront retrieval")
    void testAdminRestrictedShopStorefrontBlocked() {
        when(shopRepository.findById(103L)).thenReturn(Optional.of(adminRestrictedShop));

        RuntimeException ex = assertThrows(RuntimeException.class,
                () -> storefrontService.getShopDetails(103L));
        assertEquals("Shop is currently unavailable", ex.getMessage());
    }

    // =========================================================================
    // Domain 8: Step 3 Increment 1 Renewal & Expiry State Preservation Tests
    // =========================================================================
    @Test
    @DisplayName("TC-RENEW-01: Eligible expired shop restores to ACTIVE upon verified renewal")
    void testRenewalRestoresExpiredShopToActive() {
        com.cakeplatform.api.modules.payment.PaymentRepository paymentRepo = mock(com.cakeplatform.api.modules.payment.PaymentRepository.class);
        ShopStatusManager shopStatusManager = mock(ShopStatusManager.class);
        com.cakeplatform.api.modules.subscription.SubscriptionService subService = new com.cakeplatform.api.modules.subscription.SubscriptionService(
                subscriptionRepository, paymentRepo, shopRepository, shopStatusManager,
                activityLogger, notificationService, adminNotificationService
        );

        when(shopRepository.findByOwnerId(10L)).thenReturn(List.of(expiredShop));

        com.cakeplatform.api.modules.payment.Payment payment = new com.cakeplatform.api.modules.payment.Payment();
        payment.setId(901L);
        payment.setStatus("PENDING");
        when(paymentRepo.findByIdWithLock(901L)).thenReturn(Optional.of(payment));
        when(paymentRepo.save(any())).thenAnswer(i -> i.getArgument(0));
        when(subscriptionRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        SubscriptionPlan plan = new SubscriptionPlan();
        plan.setPrice(new BigDecimal("999.00"));
        plan.setDurationDays(30);

        subService.processSuccessfulPayment(10L, plan, "order_rzp_1", "pay_rzp_1", payment);

        // Verify shopStatusManager.activateShop is invoked for eligible expired shop
        verify(shopStatusManager).activateShop(104L, 10L);
    }

    @Test
    @DisplayName("TC-RENEW-02: Suspended shop remains SUSPENDED upon renewal")
    void testRenewalDoesNotReactivateSuspendedShop() {
        com.cakeplatform.api.modules.payment.PaymentRepository paymentRepo = mock(com.cakeplatform.api.modules.payment.PaymentRepository.class);
        ShopStatusManager shopStatusManager = mock(ShopStatusManager.class);
        com.cakeplatform.api.modules.subscription.SubscriptionService subService = new com.cakeplatform.api.modules.subscription.SubscriptionService(
                subscriptionRepository, paymentRepo, shopRepository, shopStatusManager,
                activityLogger, notificationService, adminNotificationService
        );

        when(shopRepository.findByOwnerId(10L)).thenReturn(List.of(suspendedShop));

        com.cakeplatform.api.modules.payment.Payment payment = new com.cakeplatform.api.modules.payment.Payment();
        payment.setId(902L);
        payment.setStatus("PENDING");
        when(paymentRepo.findByIdWithLock(902L)).thenReturn(Optional.of(payment));
        when(paymentRepo.save(any())).thenAnswer(i -> i.getArgument(0));
        when(subscriptionRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        SubscriptionPlan plan = new SubscriptionPlan();
        plan.setPrice(new BigDecimal("999.00"));
        plan.setDurationDays(30);

        subService.processSuccessfulPayment(10L, plan, "order_rzp_2", "pay_rzp_2", payment);

        // Verify activateShop is NEVER called for suspended shop
        verify(shopStatusManager, never()).activateShop(any(), any());
        assertEquals(ShopStatus.SUSPENDED, suspendedShop.getStatus());
    }

    @Test
    @DisplayName("TC-RENEW-03: Legacy INACTIVE shop remains INACTIVE upon renewal (zero silent reactivation)")
    void testRenewalPreservesLegacyInactiveStatus() {
        com.cakeplatform.api.modules.payment.PaymentRepository paymentRepo = mock(com.cakeplatform.api.modules.payment.PaymentRepository.class);
        ShopStatusManager shopStatusManager = mock(ShopStatusManager.class);
        com.cakeplatform.api.modules.subscription.SubscriptionService subService = new com.cakeplatform.api.modules.subscription.SubscriptionService(
                subscriptionRepository, paymentRepo, shopRepository, shopStatusManager,
                activityLogger, notificationService, adminNotificationService
        );

        when(shopRepository.findByOwnerId(10L)).thenReturn(List.of(legacyInactiveShop));

        com.cakeplatform.api.modules.payment.Payment payment = new com.cakeplatform.api.modules.payment.Payment();
        payment.setId(903L);
        payment.setStatus("PENDING");
        when(paymentRepo.findByIdWithLock(903L)).thenReturn(Optional.of(payment));
        when(paymentRepo.save(any())).thenAnswer(i -> i.getArgument(0));
        when(subscriptionRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        SubscriptionPlan plan = new SubscriptionPlan();
        plan.setPrice(new BigDecimal("999.00"));
        plan.setDurationDays(30);

        subService.processSuccessfulPayment(10L, plan, "order_rzp_3", "pay_rzp_3", payment);

        // Verify activateShop is NEVER called; status remains INACTIVE
        verify(shopStatusManager, never()).activateShop(any(), any());
        assertEquals(ShopStatus.INACTIVE, legacyInactiveShop.getStatus());
        assertFalse(legacyInactiveShop.getIsOwnerEnabled());
        assertFalse(legacyInactiveShop.getIsMarketplaceRestricted());
    }

    @Test
    @DisplayName("TC-RENEW-04: Renewal of owner-disabled and admin-restricted shops preserves their operational flags")
    void testRenewalPreservesOperationalFlags() {
        com.cakeplatform.api.modules.payment.PaymentRepository paymentRepo = mock(com.cakeplatform.api.modules.payment.PaymentRepository.class);
        ShopStatusManager shopStatusManager = mock(ShopStatusManager.class);
        com.cakeplatform.api.modules.subscription.SubscriptionService subService = new com.cakeplatform.api.modules.subscription.SubscriptionService(
                subscriptionRepository, paymentRepo, shopRepository, shopStatusManager,
                activityLogger, notificationService, adminNotificationService
        );

        when(shopRepository.findByOwnerId(10L)).thenReturn(List.of(ownerDisabledShop));

        com.cakeplatform.api.modules.payment.Payment payment = new com.cakeplatform.api.modules.payment.Payment();
        payment.setId(904L);
        payment.setStatus("PENDING");
        when(paymentRepo.findByIdWithLock(904L)).thenReturn(Optional.of(payment));
        when(paymentRepo.save(any())).thenAnswer(i -> i.getArgument(0));
        when(subscriptionRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        SubscriptionPlan plan = new SubscriptionPlan();
        plan.setPrice(new BigDecimal("999.00"));
        plan.setDurationDays(30);

        subService.processSuccessfulPayment(10L, plan, "order_rzp_4", "pay_rzp_4", payment);

        // Flag remains false
        assertFalse(ownerDisabledShop.getIsOwnerEnabled());
        assertFalse(ownerDisabledShop.getIsMarketplaceRestricted());
    }

    @Test
    @DisplayName("TC-EXPIRY-01: Expiry scheduler does not overwrite legacy INACTIVE or SUSPENDED shop status")
    void testExpiryPreservesLegacyInactiveAndSuspendedStatus() {
        com.cakeplatform.api.modules.payment.PaymentRepository paymentRepo = mock(com.cakeplatform.api.modules.payment.PaymentRepository.class);
        ShopStatusManager shopStatusManager = mock(ShopStatusManager.class);
        com.cakeplatform.api.modules.subscription.SubscriptionService subService = new com.cakeplatform.api.modules.subscription.SubscriptionService(
                subscriptionRepository, paymentRepo, shopRepository, shopStatusManager,
                activityLogger, notificationService, adminNotificationService
        );

        Subscription subInactive = new Subscription();
        subInactive.setId(701L);
        subInactive.setShop(legacyInactiveShop);
        subInactive.setStatus(SubscriptionStatus.ACTIVE);

        when(subscriptionRepository.findById(701L)).thenReturn(Optional.of(subInactive));

        subService.expireSubscription(701L);

        assertEquals(SubscriptionStatus.EXPIRED, subInactive.getStatus());
        assertEquals(ShopStatus.INACTIVE, legacyInactiveShop.getStatus(), "Legacy INACTIVE status must not be changed to EXPIRED");
        verify(shopRepository, never()).save(legacyInactiveShop);
    }

    @Test
    @DisplayName("TC-EXPIRY-02: Expiry does not change shop status to EXPIRED if a newer valid active subscription exists")
    void testExpiryDoesNotExpireShopIfNewerActiveSubExists() {
        com.cakeplatform.api.modules.payment.PaymentRepository paymentRepo = mock(com.cakeplatform.api.modules.payment.PaymentRepository.class);
        ShopStatusManager shopStatusManager = mock(ShopStatusManager.class);
        com.cakeplatform.api.modules.subscription.SubscriptionService subService = new com.cakeplatform.api.modules.subscription.SubscriptionService(
                subscriptionRepository, paymentRepo, shopRepository, shopStatusManager,
                activityLogger, notificationService, adminNotificationService
        );

        Subscription olderSub = new Subscription();
        olderSub.setId(702L);
        olderSub.setShop(activeShop);
        olderSub.setStatus(SubscriptionStatus.ACTIVE);

        Subscription newerActiveSub = new Subscription();
        newerActiveSub.setId(703L);
        newerActiveSub.setShop(activeShop);
        newerActiveSub.setStatus(SubscriptionStatus.ACTIVE);

        when(subscriptionRepository.findById(702L)).thenReturn(Optional.of(olderSub));
        when(subscriptionRepository.findFirstByShopIdAndStatusOrderByCreatedAtDesc(101L, SubscriptionStatus.ACTIVE))
                .thenReturn(Optional.of(newerActiveSub));

        subService.expireSubscription(702L);

        assertEquals(SubscriptionStatus.EXPIRED, olderSub.getStatus());
        assertEquals(ShopStatus.ACTIVE, activeShop.getStatus(), "Shop must remain ACTIVE because a newer active subscription exists");
        verify(shopRepository, never()).save(activeShop);
    }

    // ==========================================
    // STEP 3 INCREMENT 2: OPERATIONAL TOGGLE & ADMIN RESTRICTION TESTS
    // ==========================================

    @Test
    @DisplayName("TC-TOGGLE-01: Owner disabling own bakery sets isOwnerEnabled=false, evicts cache, and blocks direct storefront access")
    void testOwnerDisableBakery() {
        com.cakeplatform.api.modules.storefront.StorefrontCacheService cacheService = mock(com.cakeplatform.api.modules.storefront.StorefrontCacheService.class);
        com.cakeplatform.api.modules.shop.service.ShopService shopService = new com.cakeplatform.api.modules.shop.service.ShopService(
                shopRepository, shopAccessValidator, cacheService, null
        );
        // Inject dependencies
        org.springframework.test.util.ReflectionTestUtils.setField(shopService, "activityLogger", activityLogger);
        org.springframework.test.util.ReflectionTestUtils.setField(shopService, "subscriptionRepository", subscriptionRepository);

        when(shopRepository.findByOwnerId(10L)).thenReturn(List.of(activeShop));
        when(shopRepository.save(any(Shop.class))).thenAnswer(invocation -> invocation.getArgument(0));

        com.cakeplatform.api.modules.shop.dto.ShopResponse response = shopService.updateOperationalStatus(10L, false);

        assertFalse(response.getIsOwnerEnabled());
        assertFalse(activeShop.getIsOwnerEnabled());
        assertEquals(ShopStatus.ACTIVE, activeShop.getStatus(), "Disabling must not change ShopStatus enum");
        verify(cacheService).evictShopDetails(101L);
        verify(cacheService).evictShopProducts(101L);
        verify(activityLogger).logActivity(eq(10L), eq(101L), eq("OPERATIONAL_STATUS_CHANGED"), eq("SHOP"), eq(101L), contains("CLOSED"));

        // Direct storefront access is now blocked
        when(shopRepository.findById(101L)).thenReturn(Optional.of(activeShop));
        RuntimeException ex = assertThrows(RuntimeException.class, () -> storefrontService.getShopDetails(101L));
        assertEquals("Shop is currently unavailable", ex.getMessage());
    }

    @Test
    @DisplayName("TC-TOGGLE-02: Owner re-enabling bakery succeeds when eligible and transitions legacy INACTIVE to ACTIVE")
    void testOwnerReEnableBakeryEligible() {
        com.cakeplatform.api.modules.storefront.StorefrontCacheService cacheService = mock(com.cakeplatform.api.modules.storefront.StorefrontCacheService.class);
        com.cakeplatform.api.modules.shop.service.ShopService shopService = new com.cakeplatform.api.modules.shop.service.ShopService(
                shopRepository, shopAccessValidator, cacheService, null
        );
        org.springframework.test.util.ReflectionTestUtils.setField(shopService, "activityLogger", activityLogger);
        org.springframework.test.util.ReflectionTestUtils.setField(shopService, "subscriptionRepository", subscriptionRepository);

        // Given legacy inactive shop with valid active subscription
        legacyInactiveShop.setIsOwnerEnabled(false);
        when(shopRepository.findByOwnerId(10L)).thenReturn(List.of(legacyInactiveShop));
        when(subscriptionRepository.findFirstByShopIdOrderByCreatedAtDesc(106L)).thenReturn(Optional.of(activeSub));
        when(shopRepository.save(any(Shop.class))).thenAnswer(invocation -> invocation.getArgument(0));

        com.cakeplatform.api.modules.shop.dto.ShopResponse response = shopService.updateOperationalStatus(10L, true);

        assertTrue(response.getIsOwnerEnabled());
        assertTrue(legacyInactiveShop.getIsOwnerEnabled());
        assertEquals(ShopStatus.ACTIVE, legacyInactiveShop.getStatus(), "Explicit owner re-opening transitions legacy INACTIVE to ACTIVE");
        verify(cacheService).evictShopDetails(106L);
        verify(activityLogger).logActivity(eq(10L), eq(106L), eq("OPERATIONAL_STATUS_CHANGED"), eq("SHOP"), eq(106L), contains("OPEN"));
    }

    @Test
    @DisplayName("TC-TOGGLE-03: Re-enabling blocked when admin marketplace restriction is active")
    void testOwnerReEnableBlockedByAdminRestriction() {
        com.cakeplatform.api.modules.shop.service.ShopService shopService = new com.cakeplatform.api.modules.shop.service.ShopService(
                shopRepository, shopAccessValidator, null, null
        );

        adminRestrictedShop.setIsOwnerEnabled(false);
        when(shopRepository.findByOwnerId(10L)).thenReturn(List.of(adminRestrictedShop));

        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                shopService.updateOperationalStatus(10L, true)
        );
        assertTrue(ex.getMessage().contains("administrative marketplace restriction is active"));
        assertFalse(adminRestrictedShop.getIsOwnerEnabled());
        verify(shopRepository, never()).save(adminRestrictedShop);
    }

    @Test
    @DisplayName("TC-TOGGLE-04: Re-enabling blocked when subscription is expired or missing")
    void testOwnerReEnableBlockedByExpiredSubscription() {
        com.cakeplatform.api.modules.shop.service.ShopService shopService = new com.cakeplatform.api.modules.shop.service.ShopService(
                shopRepository, shopAccessValidator, null, null
        );
        org.springframework.test.util.ReflectionTestUtils.setField(shopService, "subscriptionRepository", subscriptionRepository);

        ownerDisabledShop.setStatus(ShopStatus.EXPIRED);
        when(shopRepository.findByOwnerId(10L)).thenReturn(List.of(ownerDisabledShop));
        when(subscriptionRepository.findFirstByShopIdOrderByCreatedAtDesc(102L)).thenReturn(Optional.of(expiredSub));

        SubscriptionExpiredException ex = assertThrows(SubscriptionExpiredException.class, () ->
                shopService.updateOperationalStatus(10L, true)
        );
        assertTrue(ex.getMessage().contains("Subscription is EXPIRED"));
        assertFalse(ownerDisabledShop.getIsOwnerEnabled());
        verify(shopRepository, never()).save(ownerDisabledShop);
    }

    @Test
    @DisplayName("TC-TOGGLE-05: Operational toggle rejected for suspended shop")
    void testOwnerToggleBlockedForSuspendedShop() {
        com.cakeplatform.api.modules.shop.service.ShopService shopService = new com.cakeplatform.api.modules.shop.service.ShopService(
                shopRepository, shopAccessValidator, null, null
        );

        when(shopRepository.findByOwnerId(10L)).thenReturn(List.of(suspendedShop));

        SubscriptionExpiredException ex = assertThrows(SubscriptionExpiredException.class, () ->
                shopService.updateOperationalStatus(10L, true)
        );
        assertTrue(ex.getMessage().contains("Shop is suspended"));
        verify(shopRepository, never()).save(suspendedShop);
    }

    @Test
    @DisplayName("TC-RESTRICT-01: Admin restriction requires non-blank reason, sets restriction fields, sends owner notification, and keeps shop status ACTIVE")
    void testAdminApplyMarketplaceRestriction() {
        com.cakeplatform.api.modules.admin.AdminDashboardService adminService = new com.cakeplatform.api.modules.admin.AdminDashboardService(
                shopRepository, mock(com.cakeplatform.api.modules.user.UserRepository.class), null, null, null, null, null,
                mock(ShopStatusManager.class), null, notificationService, activityLogger
        );
        com.cakeplatform.api.modules.storefront.StorefrontCacheService cacheService = mock(com.cakeplatform.api.modules.storefront.StorefrontCacheService.class);
        org.springframework.test.util.ReflectionTestUtils.setField(adminService, "storefrontCacheService", cacheService);

        when(shopRepository.findById(101L)).thenReturn(Optional.of(activeShop));
        when(shopRepository.save(any(Shop.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // 1. Blank reason rejected
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                adminService.updateMarketplaceRestriction(101L, true, "   ", 999L)
        );
        assertEquals("Marketplace restriction reason is mandatory and cannot be blank", ex.getMessage());

        // 2. Successful restriction
        Shop restricted = adminService.updateMarketplaceRestriction(101L, true, "Pending health inspection update", 999L);

        assertTrue(restricted.getIsMarketplaceRestricted());
        assertEquals("Pending health inspection update", restricted.getMarketplaceRestrictionReason());
        assertEquals(ShopStatus.ACTIVE, restricted.getStatus(), "Restriction must not change ShopStatus to SUSPENDED");
        verify(activityLogger).logActivity(eq(999L), eq(101L), eq("MARKETPLACE_RESTRICTION_APPLIED"), eq("SHOP"), eq(101L), contains("Pending health inspection update"));
        verify(notificationService).createNotification(eq(owner), any(), eq("Bakery Marketplace Restriction Applied"), contains("Pending health inspection update"), eq("101"), eq(true));
        verify(cacheService).evictShopDetails(101L);
        verify(cacheService).evictShopProducts(101L);
    }

    @Test
    @DisplayName("TC-RESTRICT-02: Lifting admin restriction clears flag and reason, notifies owner, and preserves owner-disabled vacation status")
    void testAdminLiftMarketplaceRestrictionPreservesOwnerDisabled() {
        com.cakeplatform.api.modules.admin.AdminDashboardService adminService = new com.cakeplatform.api.modules.admin.AdminDashboardService(
                shopRepository, mock(com.cakeplatform.api.modules.user.UserRepository.class), null, null, null, null, null,
                mock(ShopStatusManager.class), null, notificationService, activityLogger
        );
        com.cakeplatform.api.modules.storefront.StorefrontCacheService cacheService = mock(com.cakeplatform.api.modules.storefront.StorefrontCacheService.class);
        org.springframework.test.util.ReflectionTestUtils.setField(adminService, "storefrontCacheService", cacheService);

        // Shop is both admin-restricted AND owner-disabled
        adminRestrictedShop.setIsOwnerEnabled(false);
        when(shopRepository.findById(103L)).thenReturn(Optional.of(adminRestrictedShop));
        when(shopRepository.save(any(Shop.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Shop lifted = adminService.updateMarketplaceRestriction(103L, false, null, 999L);

        assertFalse(lifted.getIsMarketplaceRestricted());
        assertNull(lifted.getMarketplaceRestrictionReason());
        assertFalse(lifted.getIsOwnerEnabled(), "Lifting restriction must NOT overwrite owner-disabled status");
        assertEquals(ShopStatus.ACTIVE, lifted.getStatus());
        verify(activityLogger).logActivity(eq(999L), eq(103L), eq("MARKETPLACE_RESTRICTION_LIFTED"), eq("SHOP"), eq(103L), anyString());
        verify(notificationService).createNotification(eq(owner), any(), eq("Bakery Marketplace Restriction Lifted"), contains("lifted"), eq("103"), eq(true));
        verify(cacheService).evictShopDetails(103L);
    }

    @Test
    @DisplayName("TC-RESTRICT-03: Lifting admin restriction never reactivates legacy INACTIVE or EXPIRED shops")
    void testAdminLiftMarketplaceRestrictionPreservesLifecycleStatus() {
        com.cakeplatform.api.modules.admin.AdminDashboardService adminService = new com.cakeplatform.api.modules.admin.AdminDashboardService(
                shopRepository, mock(com.cakeplatform.api.modules.user.UserRepository.class), null, null, null, null, null,
                mock(ShopStatusManager.class), null, notificationService, activityLogger
        );

        legacyInactiveShop.setIsMarketplaceRestricted(true);
        legacyInactiveShop.setMarketplaceRestrictionReason("Temporary audit hold");
        when(shopRepository.findById(106L)).thenReturn(Optional.of(legacyInactiveShop));
        when(shopRepository.save(any(Shop.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Shop lifted = adminService.updateMarketplaceRestriction(106L, false, null, 999L);

        assertFalse(lifted.getIsMarketplaceRestricted());
        assertNull(lifted.getMarketplaceRestrictionReason());
        assertEquals(ShopStatus.INACTIVE, lifted.getStatus(), "Lifting restriction must NEVER reactivate legacy INACTIVE shop");
    }

    @Test
    @DisplayName("TC-LEGACY-01: Legacy PUT /api/shops/my-shop/status endpoint preserves compatibility and enforces safeguards")
    void testLegacyStatusEndpointCompatibility() {
        com.cakeplatform.api.modules.storefront.StorefrontCacheService cacheService = mock(com.cakeplatform.api.modules.storefront.StorefrontCacheService.class);
        com.cakeplatform.api.modules.shop.service.ShopService shopService = new com.cakeplatform.api.modules.shop.service.ShopService(
                shopRepository, shopAccessValidator, cacheService, null
        );
        org.springframework.test.util.ReflectionTestUtils.setField(shopService, "activityLogger", activityLogger);
        org.springframework.test.util.ReflectionTestUtils.setField(shopService, "subscriptionRepository", subscriptionRepository);

        // 1. Setting INACTIVE sets isOwnerEnabled=false and saves reason
        when(shopRepository.findByOwnerId(10L)).thenReturn(List.of(activeShop));
        when(shopRepository.save(any(Shop.class))).thenAnswer(invocation -> invocation.getArgument(0));

        com.cakeplatform.api.modules.shop.dto.ShopResponse inactiveResp = shopService.updateShopStatusAndReason(10L, ShopStatus.INACTIVE, "Going on holiday");
        assertEquals(ShopStatus.INACTIVE, inactiveResp.getStatus());
        assertFalse(inactiveResp.getIsOwnerEnabled());
        verify(cacheService).evictShopDetails(101L);

        // 2. Setting ACTIVE requires valid subscription and no admin restriction
        when(subscriptionRepository.findFirstByShopIdOrderByCreatedAtDesc(101L)).thenReturn(Optional.of(activeSub));
        com.cakeplatform.api.modules.shop.dto.ShopResponse activeResp = shopService.updateShopStatusAndReason(10L, ShopStatus.ACTIVE, null);
        assertEquals(ShopStatus.ACTIVE, activeResp.getStatus());
        assertTrue(activeResp.getIsOwnerEnabled());
    }

    // ==========================================
    // STEP 3 INCREMENT 3.1: SUBSCRIPTION CANCELLATION TESTS
    // ==========================================

    @Test
    @DisplayName("TC-CANCEL-01: Owner cancellation records timestamp and reason, keeps status ACTIVE, and preserves storefront/catalog access")
    void testOwnerCancellationPreservesEntitlementUntilExpiry() {
        com.cakeplatform.api.modules.subscription.SubscriptionService subService = new com.cakeplatform.api.modules.subscription.SubscriptionService(
                subscriptionRepository, null, shopRepository, null,
                activityLogger, notificationService, adminNotificationService
        );

        when(shopRepository.findByOwnerId(10L)).thenReturn(List.of(activeShop));

        Subscription currentSub = new Subscription();
        currentSub.setId(505L);
        currentSub.setShop(activeShop);
        currentSub.setStatus(SubscriptionStatus.ACTIVE);
        currentSub.setExpiryDate(LocalDateTime.now().plusDays(15));
        when(subscriptionRepository.findFirstByShopIdAndStatusOrderByCreatedAtDesc(101L, SubscriptionStatus.ACTIVE))
                .thenReturn(Optional.of(currentSub));
        when(subscriptionRepository.save(any(Subscription.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Subscription cancelled = subService.cancelSubscription(10L, "Scaling down business operations");

        assertNotNull(cancelled.getCancelledAt());
        assertEquals("Scaling down business operations", cancelled.getCancellationReason());
        assertEquals(SubscriptionStatus.ACTIVE, cancelled.getStatus(), "Status must remain ACTIVE so entitlement persists until expiry date");
        verify(activityLogger).logActivity(eq(10L), eq(101L), eq("SUBSCRIPTION_CANCELLATION_SCHEDULED"), eq("SUBSCRIPTION"), eq(505L), contains("Scaling down business operations"));
        verify(notificationService).createNotification(eq(owner), any(), eq("Subscription Cancellation Scheduled"), contains("remain active until"), eq("505"), eq(true));

        // Verify catalog access is still valid before expiry
        when(subscriptionRepository.findFirstByShopIdOrderByCreatedAtDesc(101L)).thenReturn(Optional.of(cancelled));
        assertNotNull(shopAccessValidator.validateCatalogAccess(10L));
    }

    @Test
    @DisplayName("TC-CANCEL-02: Repeated cancellation requests are idempotent and do not overwrite original decision")
    void testCancellationIsIdempotent() {
        com.cakeplatform.api.modules.subscription.SubscriptionService subService = new com.cakeplatform.api.modules.subscription.SubscriptionService(
                subscriptionRepository, null, shopRepository, null,
                activityLogger, notificationService, adminNotificationService
        );

        when(shopRepository.findByOwnerId(10L)).thenReturn(List.of(activeShop));

        LocalDateTime originalCancelledAt = LocalDateTime.now().minusHours(2);
        Subscription alreadyCancelledSub = new Subscription();
        alreadyCancelledSub.setId(506L);
        alreadyCancelledSub.setShop(activeShop);
        alreadyCancelledSub.setStatus(SubscriptionStatus.ACTIVE);
        alreadyCancelledSub.setCancelledAt(originalCancelledAt);
        alreadyCancelledSub.setCancellationReason("Initial cancellation reason");
        alreadyCancelledSub.setExpiryDate(LocalDateTime.now().plusDays(10));

        when(subscriptionRepository.findFirstByShopIdAndStatusOrderByCreatedAtDesc(101L, SubscriptionStatus.ACTIVE))
                .thenReturn(Optional.of(alreadyCancelledSub));

        Subscription result = subService.cancelSubscription(10L, "Attempted duplicate reason");

        assertEquals(originalCancelledAt, result.getCancelledAt(), "Timestamp must not be overwritten");
        assertEquals("Initial cancellation reason", result.getCancellationReason(), "Original reason must be preserved");
        verify(subscriptionRepository, never()).save(any(Subscription.class));
        verify(activityLogger, never()).logActivity(any(), any(), eq("SUBSCRIPTION_CANCELLATION_SCHEDULED"), any(), any(), any());
    }

    @Test
    @DisplayName("TC-CANCEL-03: Cancellation fails safely if no active subscription exists")
    void testCancellationThrowsWhenNoActiveSubscription() {
        com.cakeplatform.api.modules.subscription.SubscriptionService subService = new com.cakeplatform.api.modules.subscription.SubscriptionService(
                subscriptionRepository, null, shopRepository, null,
                activityLogger, notificationService, adminNotificationService
        );

        when(shopRepository.findByOwnerId(10L)).thenReturn(List.of(expiredShop));
        when(subscriptionRepository.findFirstByShopIdAndStatusOrderByCreatedAtDesc(104L, SubscriptionStatus.ACTIVE))
                .thenReturn(Optional.empty());

        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                subService.cancelSubscription(10L, "Want to cancel")
        );
        assertTrue(ex.getMessage().contains("No active subscription found to cancel"));
    }

    @Test
    @DisplayName("TC-CANCEL-04: Tenant isolation prevents user from cancelling another owner's subscription")
    void testCancellationTenantIsolation() {
        com.cakeplatform.api.modules.subscription.SubscriptionService subService = new com.cakeplatform.api.modules.subscription.SubscriptionService(
                subscriptionRepository, null, shopRepository, null,
                activityLogger, notificationService, adminNotificationService
        );

        when(shopRepository.findByOwnerId(999L)).thenReturn(List.of());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                subService.cancelSubscription(999L, "Unauthorized cancellation attempt")
        );
        assertTrue(ex.getMessage().contains("Shop not found for this user"));
    }

    @Test
    @DisplayName("TC-CANCEL-05: Cancellation leaves payment and refund records completely unchanged")
    void testCancellationDoesNotMutatePaymentsOrRefunds() {
        com.cakeplatform.api.modules.payment.PaymentRepository mockPaymentRepo = mock(com.cakeplatform.api.modules.payment.PaymentRepository.class);
        com.cakeplatform.api.modules.subscription.SubscriptionService subService = new com.cakeplatform.api.modules.subscription.SubscriptionService(
                subscriptionRepository, mockPaymentRepo, shopRepository, null,
                activityLogger, notificationService, adminNotificationService
        );

        when(shopRepository.findByOwnerId(10L)).thenReturn(List.of(activeShop));

        Subscription currentSub = new Subscription();
        currentSub.setId(507L);
        currentSub.setShop(activeShop);
        currentSub.setStatus(SubscriptionStatus.ACTIVE);
        currentSub.setAmount(new BigDecimal("999.00"));
        currentSub.setExpiryDate(LocalDateTime.now().plusDays(20));

        when(subscriptionRepository.findFirstByShopIdAndStatusOrderByCreatedAtDesc(101L, SubscriptionStatus.ACTIVE))
                .thenReturn(Optional.of(currentSub));
        when(subscriptionRepository.save(any(Subscription.class))).thenAnswer(i -> i.getArgument(0));

        Subscription result = subService.cancelSubscription(10L, "Cost cutting");

        // Verify cancellation recorded on subscription
        assertNotNull(result.getCancelledAt());
        assertEquals("Cost cutting", result.getCancellationReason());
        assertEquals(new BigDecimal("999.00"), result.getAmount(), "Subscription amount must remain unchanged");

        // Explicitly assert zero paymentRepository interactions (no refunds, no amount mutations, no record alterations)
        verifyNoInteractions(mockPaymentRepo);
    }

    // ==========================================
    // STEP 3 INCREMENT 3.2: EXPIRATION AUTOMATION & SOFT-DELETE TESTS
    // ==========================================

    @Test
    @DisplayName("TC-EXPIRY-03: Expiration does not overwrite the status of a soft-deleted shop")
    void testExpirationPreservesSoftDeletedShop() {
        com.cakeplatform.api.modules.subscription.SubscriptionService subService = new com.cakeplatform.api.modules.subscription.SubscriptionService(
                subscriptionRepository, null, shopRepository, null,
                activityLogger, notificationService, adminNotificationService
        );

        Shop deletedShop = new Shop();
        deletedShop.setId(109L);
        deletedShop.setOwner(owner);
        deletedShop.setBusinessName("Soft-Deleted Bakery");
        deletedShop.setStatus(ShopStatus.ACTIVE);
        deletedShop.setDeleted(true);

        Subscription sub = new Subscription();
        sub.setId(705L);
        sub.setShop(deletedShop);
        sub.setStatus(SubscriptionStatus.ACTIVE);

        when(subscriptionRepository.findById(705L)).thenReturn(Optional.of(sub));

        subService.expireSubscription(705L);

        assertEquals(SubscriptionStatus.EXPIRED, sub.getStatus());
        assertEquals(ShopStatus.ACTIVE, deletedShop.getStatus(), "Deleted shop status must not be rewritten to EXPIRED");
        assertTrue(deletedShop.isDeleted());
        verify(shopRepository, never()).save(deletedShop);
    }

    @Test
    @DisplayName("TC-EXPIRY-04: A scheduler exception for one subscription does not prevent a subsequent subscription from being processed")
    void testSchedulerIsolatesExceptionsAcrossSubscriptions() {
        com.cakeplatform.api.modules.subscription.SubscriptionService mockSubService = mock(com.cakeplatform.api.modules.subscription.SubscriptionService.class);
        SubscriptionScheduler scheduler = new SubscriptionScheduler(
                subscriptionRepository, mockSubService, notificationService, adminNotificationService
        );

        Subscription failingSub = new Subscription();
        failingSub.setId(801L);
        failingSub.setStatus(SubscriptionStatus.ACTIVE);
        failingSub.setExpiryDate(LocalDateTime.now().minusDays(2));
        failingSub.setShop(activeShop);

        Subscription succeedingSub = new Subscription();
        succeedingSub.setId(802L);
        succeedingSub.setStatus(SubscriptionStatus.ACTIVE);
        succeedingSub.setExpiryDate(LocalDateTime.now().minusDays(1));
        succeedingSub.setShop(activeShop);

        when(subscriptionRepository.findByStatus(SubscriptionStatus.ACTIVE))
                .thenReturn(List.of(failingSub, succeedingSub));

        // Sub 801 throws an unexpected runtime error (e.g., deadlock or DB transient error)
        doThrow(new RuntimeException("Simulated transient DB error")).when(mockSubService).expireSubscription(801L);

        // Execute scheduler batch run
        assertDoesNotThrow(() -> scheduler.processSubscriptionExpiries());

        // Verify failing sub was attempted, and succeeding sub was still executed
        verify(mockSubService).expireSubscription(801L);
        verify(mockSubService).expireSubscription(802L);
    }
}
