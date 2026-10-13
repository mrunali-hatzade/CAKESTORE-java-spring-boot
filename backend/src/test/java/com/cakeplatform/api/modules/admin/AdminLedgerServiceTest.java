package com.cakeplatform.api.modules.admin;

import com.cakeplatform.api.modules.admin.dto.AdminOrderDetailResponse;
import com.cakeplatform.api.modules.admin.dto.AdminOrderSummaryResponse;
import com.cakeplatform.api.modules.admin.dto.AdminPaymentDetailResponse;
import com.cakeplatform.api.modules.admin.dto.AdminPaymentSummaryResponse;
import com.cakeplatform.api.modules.order.Order;
import com.cakeplatform.api.modules.order.OrderItem;
import com.cakeplatform.api.modules.order.OrderRepository;
import com.cakeplatform.api.modules.payment.Payment;
import com.cakeplatform.api.modules.payment.PaymentRepository;
import com.cakeplatform.api.modules.shop.Shop;
import com.cakeplatform.api.modules.subscription.Subscription;
import com.cakeplatform.api.modules.subscription.SubscriptionPlan;
import com.cakeplatform.api.modules.subscription.SubscriptionStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminLedgerServiceTest {

    @Mock
    private PaymentRepository paymentRepository;

    @Mock
    private OrderRepository orderRepository;

    @InjectMocks
    private AdminPaymentService adminPaymentService;

    @InjectMocks
    private AdminOrderService adminOrderService;

    private Shop shopA;
    private Shop shopB;

    @BeforeEach
    void setUp() {
        shopA = new Shop();
        shopA.setId(10L);
        shopA.setBusinessName("Bakery Alpha");
        shopA.setPhone("+91 9876543210");
        shopA.setEmail("alpha@test.com");

        shopB = new Shop();
        shopB.setId(20L);
        shopB.setBusinessName("Bakery Beta");
        shopB.setPhone("+91 9123456789");
        shopB.setEmail("beta@test.com");
    }

    @Test
    @DisplayName("1. Associated subscription payment -> classified as SUBSCRIPTION")
    void testClassify_SubscriptionPayment() {
        SubscriptionPlan plan = new SubscriptionPlan();
        plan.setId(1L);
        plan.setName("Pro Baker Annual");

        Subscription sub = new Subscription();
        sub.setId(100L);
        sub.setPlan(plan);
        sub.setStatus(SubscriptionStatus.ACTIVE);

        Payment payment = new Payment();
        payment.setId(1L);
        payment.setShop(shopA);
        payment.setSubscription(sub);
        payment.setAmount(new BigDecimal("4999.00"));
        payment.setStatus("COMPLETED");

        AdminPaymentSummaryResponse summary = adminPaymentService.toPaymentSummaryResponse(payment);

        assertEquals("SUBSCRIPTION", summary.getTransactionType());
        assertEquals("PLATFORM_REVENUE", summary.getFinancialClassification());
        assertEquals("SUBSCRIPTION_LINKED", summary.getAssociationState());
        assertEquals("Pro Baker Annual", summary.getPlanName());
        assertNull(summary.getRelatedOrderNumber());
        assertNull(summary.getRelatedOrderId());
    }

    @Test
    @DisplayName("2. Associated direct plan payment -> classified as SUBSCRIPTION")
    void testClassify_PlanPayment() {
        SubscriptionPlan plan = new SubscriptionPlan();
        plan.setId(2L);
        plan.setName("Starter Monthly");

        Payment payment = new Payment();
        payment.setId(2L);
        payment.setShop(shopA);
        payment.setPlan(plan);
        payment.setSubscription(null);
        payment.setAmount(new BigDecimal("999.00"));
        payment.setStatus("COMPLETED");

        AdminPaymentSummaryResponse summary = adminPaymentService.toPaymentSummaryResponse(payment);

        assertEquals("SUBSCRIPTION", summary.getTransactionType());
        assertEquals("PLATFORM_REVENUE", summary.getFinancialClassification());
        assertEquals("SUBSCRIPTION_LINKED", summary.getAssociationState());
        assertEquals("Starter Monthly", summary.getPlanName());
        assertNull(summary.getRelatedOrderNumber());
    }

    @Test
    @DisplayName("3. Payment matched to order in same bakery via providerPaymentId -> classified as RETAIL_ORDER")
    void testClassify_RetailOrder_SameShop_ProviderPaymentId() {
        Payment payment = new Payment();
        payment.setId(3L);
        payment.setShop(shopA);
        payment.setProviderPaymentId("pay_12345");
        payment.setAmount(new BigDecimal("1200.00"));
        payment.setStatus("COMPLETED");

        Order order = new Order();
        order.setId(501L);
        order.setOrderNumber("ORD-ALPHA-1");
        order.setShop(shopA); // Same shop!
        order.setTransactionId("pay_12345");

        when(orderRepository.findByTransactionId("pay_12345")).thenReturn(Optional.of(order));

        AdminPaymentSummaryResponse summary = adminPaymentService.toPaymentSummaryResponse(payment);

        assertEquals("RETAIL_ORDER", summary.getTransactionType());
        assertEquals("NETWORK_GMV_ZERO_COMMISSION", summary.getFinancialClassification());
        assertEquals("ORDER_MATCHED", summary.getAssociationState());
        assertEquals("ORD-ALPHA-1", summary.getRelatedOrderNumber());
        assertEquals(501L, summary.getRelatedOrderId());
    }

    @Test
    @DisplayName("4. Payment matched to order in same bakery via providerOrderId -> classified as RETAIL_ORDER")
    void testClassify_RetailOrder_SameShop_ProviderOrderId() {
        Payment payment = new Payment();
        payment.setId(4L);
        payment.setShop(shopA);
        payment.setProviderOrderId("order_rzp_67890");
        payment.setAmount(new BigDecimal("1500.00"));
        payment.setStatus("COMPLETED");

        Order order = new Order();
        order.setId(502L);
        order.setOrderNumber("ORD-ALPHA-2");
        order.setShop(shopA);
        order.setRazorpayOrderId("order_rzp_67890");

        when(orderRepository.findByRazorpayOrderId("order_rzp_67890")).thenReturn(Optional.of(order));

        AdminPaymentSummaryResponse summary = adminPaymentService.toPaymentSummaryResponse(payment);

        assertEquals("RETAIL_ORDER", summary.getTransactionType());
        assertEquals("NETWORK_GMV_ZERO_COMMISSION", summary.getFinancialClassification());
        assertEquals("ORDER_MATCHED", summary.getAssociationState());
        assertEquals("ORD-ALPHA-2", summary.getRelatedOrderNumber());
        assertEquals(502L, summary.getRelatedOrderId());
    }

    @Test
    @DisplayName("5. Payment matched to order via ORDER: fallback in same bakery -> classified as RETAIL_ORDER")
    void testClassify_RetailOrder_SameShop_OrderFallback() {
        Payment payment = new Payment();
        payment.setId(5L);
        payment.setShop(shopA);
        payment.setFailureReason("ORDER:ORD-ALPHA-3");
        payment.setAmount(new BigDecimal("850.00"));
        payment.setStatus("COMPLETED");

        Order order = new Order();
        order.setId(503L);
        order.setOrderNumber("ORD-ALPHA-3");
        order.setShop(shopA);

        when(orderRepository.findByOrderNumber("ORD-ALPHA-3")).thenReturn(Optional.of(order));

        AdminPaymentSummaryResponse summary = adminPaymentService.toPaymentSummaryResponse(payment);

        assertEquals("RETAIL_ORDER", summary.getTransactionType());
        assertEquals("NETWORK_GMV_ZERO_COMMISSION", summary.getFinancialClassification());
        assertEquals("ORDER_MATCHED", summary.getAssociationState());
        assertEquals("ORD-ALPHA-3", summary.getRelatedOrderNumber());
        assertEquals(503L, summary.getRelatedOrderId());
    }

    @Test
    @DisplayName("6. Unmatched payment -> classified as UNKNOWN / UNLINKED_GATEWAY_RECORD")
    void testClassify_UnmatchedPayment_BecomesUnknown() {
        Payment payment = new Payment();
        payment.setId(6L);
        payment.setShop(shopA);
        payment.setProviderPaymentId("pay_unlinked_999");
        payment.setAmount(new BigDecimal("500.00"));
        payment.setStatus("COMPLETED");

        when(orderRepository.findByTransactionId("pay_unlinked_999")).thenReturn(Optional.empty());

        AdminPaymentSummaryResponse summary = adminPaymentService.toPaymentSummaryResponse(payment);

        assertEquals("UNKNOWN", summary.getTransactionType());
        assertEquals("UNLINKED_TRANSACTION", summary.getFinancialClassification());
        assertEquals("UNLINKED_GATEWAY_RECORD", summary.getAssociationState());
        assertNull(summary.getRelatedOrderNumber());
        assertNull(summary.getRelatedOrderId());
    }

    @Test
    @DisplayName("7. Tenant mismatch via providerPaymentId -> rejected and classified as UNKNOWN")
    void testTenantMismatch_ProviderPaymentId_Rejected() {
        Payment payment = new Payment();
        payment.setId(7L);
        payment.setShop(shopA); // Belongs to Shop A
        payment.setProviderPaymentId("pay_shared_111");

        Order order = new Order();
        order.setId(999L);
        order.setOrderNumber("ORD-BETA-CROSS");
        order.setShop(shopB); // Belongs to Shop B! Different bakery!
        order.setTransactionId("pay_shared_111");

        when(orderRepository.findByTransactionId("pay_shared_111")).thenReturn(Optional.of(order));

        AdminPaymentSummaryResponse summary = adminPaymentService.toPaymentSummaryResponse(payment);

        // MUST be rejected!
        assertEquals("UNKNOWN", summary.getTransactionType());
        assertEquals("UNLINKED_TRANSACTION", summary.getFinancialClassification());
        assertEquals("UNLINKED_GATEWAY_RECORD", summary.getAssociationState());
        assertNull(summary.getRelatedOrderNumber());
        assertNull(summary.getRelatedOrderId());
    }

    @Test
    @DisplayName("8. Tenant mismatch via providerOrderId -> rejected and classified as UNKNOWN")
    void testTenantMismatch_ProviderOrderId_Rejected() {
        Payment payment = new Payment();
        payment.setId(8L);
        payment.setShop(shopA); // Shop A
        payment.setProviderOrderId("order_shared_222");

        Order order = new Order();
        order.setId(888L);
        order.setOrderNumber("ORD-BETA-CROSS2");
        order.setShop(shopB); // Shop B
        order.setRazorpayOrderId("order_shared_222");

        when(orderRepository.findByRazorpayOrderId("order_shared_222")).thenReturn(Optional.of(order));

        AdminPaymentSummaryResponse summary = adminPaymentService.toPaymentSummaryResponse(payment);

        assertEquals("UNKNOWN", summary.getTransactionType());
        assertEquals("UNLINKED_TRANSACTION", summary.getFinancialClassification());
        assertEquals("UNLINKED_GATEWAY_RECORD", summary.getAssociationState());
        assertNull(summary.getRelatedOrderNumber());
    }

    @Test
    @DisplayName("9. Tenant mismatch via ORDER: fallback -> rejected and classified as UNKNOWN")
    void testTenantMismatch_OrderFallback_Rejected() {
        Payment payment = new Payment();
        payment.setId(9L);
        payment.setShop(shopA); // Shop A
        payment.setFailureReason("ORDER:ORD-BETA-333");

        Order order = new Order();
        order.setId(777L);
        order.setOrderNumber("ORD-BETA-333");
        order.setShop(shopB); // Shop B!

        when(orderRepository.findByOrderNumber("ORD-BETA-333")).thenReturn(Optional.of(order));

        AdminPaymentSummaryResponse summary = adminPaymentService.toPaymentSummaryResponse(payment);

        assertEquals("UNKNOWN", summary.getTransactionType());
        assertEquals("UNLINKED_TRANSACTION", summary.getFinancialClassification());
        assertEquals("UNLINKED_GATEWAY_RECORD", summary.getAssociationState());
        assertNull(summary.getRelatedOrderNumber());
    }

    @Test
    @DisplayName("10. Malformed ORDER: fallback or null references -> safe handling")
    void testMalformedFallback_SafeHandling() {
        Payment payment = new Payment();
        payment.setId(10L);
        payment.setShop(shopA);
        payment.setFailureReason("ORDER:   "); // Blank after prefix

        AdminPaymentSummaryResponse summary = adminPaymentService.toPaymentSummaryResponse(payment);

        assertEquals("UNKNOWN", summary.getTransactionType());
        assertEquals("UNLINKED_GATEWAY_RECORD", summary.getAssociationState());

        // Null failure reason
        payment.setFailureReason(null);
        AdminPaymentSummaryResponse summary2 = adminPaymentService.toPaymentSummaryResponse(payment);
        assertEquals("UNKNOWN", summary2.getTransactionType());

        // Irrelevant failure reason
        payment.setFailureReason("Payment cancelled by customer during checkout");
        AdminPaymentSummaryResponse summary3 = adminPaymentService.toPaymentSummaryResponse(payment);
        assertEquals("UNKNOWN", summary3.getTransactionType());
    }

    @Test
    @DisplayName("11. Privacy masking for phone and email edge cases")
    void testPrivacyMaskingEdgeCases() {
        // Null and blank
        assertNull(AdminOrderSummaryResponse.maskPhone(null));
        assertNull(AdminOrderSummaryResponse.maskPhone(""));
        assertNull(AdminOrderSummaryResponse.maskPhone("   "));
        assertNull(AdminOrderSummaryResponse.maskEmail(null));
        assertNull(AdminOrderSummaryResponse.maskEmail(""));

        // Short phone
        assertEquals("****", AdminOrderSummaryResponse.maskPhone("1234"));
        assertEquals("12***45", AdminOrderSummaryResponse.maskPhone("12345"));
        assertEquals("12***67", AdminOrderSummaryResponse.maskPhone("1234567"));

        // Standard 10-digit
        assertEquals("98******3210", AdminOrderSummaryResponse.maskPhone("9876543210"));

        // International E.164
        assertEquals("+91******3210", AdminOrderSummaryResponse.maskPhone("+919876543210"));
        assertEquals("+91******3210", AdminOrderSummaryResponse.maskPhone("+91 9876543210"));

        // Email variations
        assertEquals("r***@gmail.com", AdminOrderSummaryResponse.maskEmail("rohan@gmail.com"));
        assertEquals("***@domain.com", AdminOrderSummaryResponse.maskEmail("a@domain.com"));
        assertEquals("***plain", AdminOrderSummaryResponse.maskEmail("plain"));
        assertEquals("***@domain.com", AdminOrderSummaryResponse.maskEmail("@domain.com"));
    }

    @Test
    @DisplayName("12. Detail DTO snapshots for subscription and order")
    void testDetailDtoSnapshots() {
        // Subscription payment detail
        SubscriptionPlan plan = new SubscriptionPlan();
        plan.setName("Pro Baker");
        Subscription sub = new Subscription();
        sub.setId(101L);
        sub.setPlan(plan);
        sub.setStatus(SubscriptionStatus.ACTIVE);

        Payment paymentSub = new Payment();
        paymentSub.setId(11L);
        paymentSub.setShop(shopA);
        paymentSub.setSubscription(sub);
        paymentSub.setAmount(new BigDecimal("4999.00"));
        paymentSub.setStatus("COMPLETED");

        AdminPaymentDetailResponse detailSub = adminPaymentService.toPaymentDetailResponse(paymentSub);
        assertEquals("SUBSCRIPTION", detailSub.getTransactionType());
        assertNotNull(detailSub.getSubscriptionDetails());
        assertEquals("Pro Baker", detailSub.getSubscriptionDetails().getPlanName());
        assertNull(detailSub.getOrderDetails());

        // Order payment detail
        Payment paymentOrder = new Payment();
        paymentOrder.setId(12L);
        paymentOrder.setShop(shopA);
        paymentOrder.setProviderPaymentId("pay_match_12");
        paymentOrder.setAmount(new BigDecimal("1200.00"));
        paymentOrder.setStatus("COMPLETED");

        Order order = new Order();
        order.setId(601L);
        order.setOrderNumber("ORD-MATCH-12");
        order.setShop(shopA);
        order.setOrderStatus("CONFIRMED");
        order.setPaymentStatus("PAID");
        order.setTotalAmount(new BigDecimal("1200.00"));
        order.setTransactionId("pay_match_12");

        when(orderRepository.findByTransactionId("pay_match_12")).thenReturn(Optional.of(order));

        AdminPaymentDetailResponse detailOrder = adminPaymentService.toPaymentDetailResponse(paymentOrder);
        assertEquals("RETAIL_ORDER", detailOrder.getTransactionType());
        assertNotNull(detailOrder.getOrderDetails());
        assertEquals("ORD-MATCH-12", detailOrder.getOrderDetails().getOrderNumber());
        assertNull(detailOrder.getSubscriptionDetails());
    }

    @Test
    @DisplayName("13. AdminOrderService bounding page size to max 50")
    void testOrderPaginationBounded() {
        when(orderRepository.findAdminCrossShopOrders(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new PageImpl<>(List.of()));

        // Call with size 100
        adminOrderService.getCrossShopOrders(0, 100, null, null, null, null, null, null);

        // Verify that Pageable was capped at 50
        verify(orderRepository).findAdminCrossShopOrders(
                isNull(), isNull(), isNull(), any(LocalDateTime.class), any(LocalDateTime.class), isNull(),
                argThat(pageable -> pageable.getPageSize() == 50)
        );
    }

    @Test
    @DisplayName("14. AdminPaymentService bounding page size to max 50")
    void testPaymentPaginationBounded() {
        when(paymentRepository.findAdminCrossShopPayments(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new PageImpl<>(List.of()));

        // Call with size 200
        adminPaymentService.getCrossShopPayments(0, 200, null, null, null, null, null, null);

        // Verify that Pageable was capped at 50
        verify(paymentRepository).findAdminCrossShopPayments(
                isNull(), isNull(), isNull(), any(LocalDateTime.class), any(LocalDateTime.class), isNull(),
                argThat(pageable -> pageable.getPageSize() == 50)
        );
    }
}
