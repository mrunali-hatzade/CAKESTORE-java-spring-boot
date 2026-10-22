package com.cakeplatform.api.modules.payment.controller;

import com.cakeplatform.api.modules.notification.AdminNotificationService;
import com.cakeplatform.api.modules.notification.NotificationService;
import com.cakeplatform.api.modules.notification.NotificationType;
import com.cakeplatform.api.modules.order.Order;
import com.cakeplatform.api.modules.order.OrderRepository;
import com.cakeplatform.api.modules.payment.Payment;
import com.cakeplatform.api.modules.payment.PaymentRepository;
import com.cakeplatform.api.modules.payment.RazorpayService;
import com.cakeplatform.api.modules.shop.Shop;
import com.cakeplatform.api.modules.user.User;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Optional;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class CustomerPaymentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private OrderRepository orderRepository;

    @MockBean
    private PaymentRepository paymentRepository;

    @MockBean
    private RazorpayService razorpayService;

    @MockBean
    private NotificationService notificationService;

    @MockBean
    private AdminNotificationService adminNotificationService;

    @MockBean
    private com.cakeplatform.api.modules.shop.CouponRepository couponRepository;

    @Autowired
    private ObjectMapper objectMapper;

    private Shop testShop;
    private User testOwner;
    private Order testOrder;

    @BeforeEach
    void setUp() {
        testOwner = new User();
        testOwner.setId(100L);
        testOwner.setEmail("baker@test.com");

        testShop = new Shop();
        testShop.setId(10L);
        testShop.setBusinessName("Sweet Delights");
        testShop.setOwner(testOwner);

        testOrder = new Order();
        testOrder.setId(500L);
        testOrder.setOrderNumber("ORD-TEST-1234");
        testOrder.setShop(testShop);
        testOrder.setCustomerName("Jane Doe");
        testOrder.setCustomerEmail("jane@example.com");
        testOrder.setCustomerPhone("9876543210");
        testOrder.setSubtotal(new BigDecimal("1200.00"));
        testOrder.setDeliveryCharge(new BigDecimal("50.00"));
        testOrder.setDiscountAmount(BigDecimal.ZERO);
        testOrder.setTotalAmount(new BigDecimal("1250.00"));
        testOrder.setOrderStatus("NEW");
        testOrder.setPaymentStatus("PENDING");

        when(razorpayService.getKeyId()).thenReturn("rzp_test_mockKey");
        when(razorpayService.isConfigured()).thenReturn(true);
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> {
            Payment p = inv.getArgument(0);
            if (p.getId() == null) p.setId(888L);
            return p;
        });
    }

    @Test
    void createCustomerPaymentOrder_UsesAuthoritativeDbAmountAndCallsRazorpayService() throws Exception {
        when(orderRepository.findByOrderNumber("ORD-TEST-1234")).thenReturn(Optional.of(testOrder));
        when(razorpayService.createCustomerOrder(eq(new BigDecimal("1250.00")), eq("ORD-TEST-1234"), eq(10L), any()))
                .thenReturn("order_rzp_real_9999");

        mockMvc.perform(post("/api/storefront/orders/ORD-TEST-1234/create-payment-order")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.orderNumber", is("ORD-TEST-1234")))
                .andExpect(jsonPath("$.razorpayOrderId", is("order_rzp_real_9999")))
                .andExpect(jsonPath("$.amount", is(1250.00)))
                .andExpect(jsonPath("$.amountPaise", is(125000)))
                .andExpect(jsonPath("$.currency", is("INR")))
                .andExpect(jsonPath("$.keyId", is("rzp_test_mockKey")))
                .andExpect(jsonPath("$.shopName", is("Sweet Delights")));

        verify(razorpayService, times(1)).createCustomerOrder(eq(new BigDecimal("1250.00")), eq("ORD-TEST-1234"), eq(10L), any());
        verify(paymentRepository, times(1)).save(any(Payment.class));
        verify(orderRepository, times(1)).save(any(Order.class));
    }

    @Test
    void createCustomerPaymentOrder_RejectsCancelledOrder() throws Exception {
        testOrder.setOrderStatus("CANCELLED");
        when(orderRepository.findByOrderNumber("ORD-TEST-1234")).thenReturn(Optional.of(testOrder));

        mockMvc.perform(post("/api/storefront/orders/ORD-TEST-1234/create-payment-order")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().is4xxClientError());
    }

    @Test
    void createCustomerPaymentOrder_RejectsAlreadyPaidOrder() throws Exception {
        testOrder.setPaymentStatus("PAID");
        when(orderRepository.findByOrderNumber("ORD-TEST-1234")).thenReturn(Optional.of(testOrder));

        mockMvc.perform(post("/api/storefront/orders/ORD-TEST-1234/create-payment-order")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().is4xxClientError());
    }

    @Test
    void createCustomerPaymentOrder_RejectsNonExistentOrder() throws Exception {
        when(orderRepository.findByOrderNumber("ORD-UNKNOWN")).thenReturn(Optional.empty());

        mockMvc.perform(post("/api/storefront/orders/ORD-UNKNOWN/create-payment-order")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().is4xxClientError());
    }

    @Test
    void verifyCustomerPayment_SuccessfulVerificationUpdatesOrderAndPayment() throws Exception {
        testOrder.setTransactionId("order_rzp_real_9999");
        when(orderRepository.findByOrderNumber("ORD-TEST-1234")).thenReturn(Optional.of(testOrder));
        when(razorpayService.verifyPaymentSignature("order_rzp_real_9999", "pay_real_7777", "valid_signature_abc"))
                .thenReturn(true);

        Payment pendingPayment = new Payment();
        pendingPayment.setId(888L);
        pendingPayment.setShop(testShop);
        pendingPayment.setAmount(new BigDecimal("1250.00"));
        pendingPayment.setProviderOrderId("order_rzp_real_9999");
        pendingPayment.setStatus("PENDING");
        when(paymentRepository.findByProviderOrderId("order_rzp_real_9999")).thenReturn(Optional.of(pendingPayment));

        Map<String, String> payload = Map.of(
                "razorpayOrderId", "order_rzp_real_9999",
                "razorpayPaymentId", "pay_real_7777",
                "razorpaySignature", "valid_signature_abc"
        );

        mockMvc.perform(post("/api/storefront/orders/ORD-TEST-1234/verify-payment")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("SUCCESS")))
                .andExpect(jsonPath("$.orderNumber", is("ORD-TEST-1234")))
                .andExpect(jsonPath("$.paymentId", is(888)));

        // Verify Order is updated to PAID + CONFIRMED
        org.junit.jupiter.api.Assertions.assertEquals("PAID", testOrder.getPaymentStatus());
        org.junit.jupiter.api.Assertions.assertEquals("CONFIRMED", testOrder.getOrderStatus());
        org.junit.jupiter.api.Assertions.assertEquals("pay_real_7777", testOrder.getTransactionId());

        // Verify Payment is marked COMPLETED
        org.junit.jupiter.api.Assertions.assertEquals("COMPLETED", pendingPayment.getStatus());
        org.junit.jupiter.api.Assertions.assertEquals("pay_real_7777", pendingPayment.getProviderPaymentId());

        // Verify Owner notification was dispatched
        verify(notificationService, times(1)).createNotification(
                eq(testOwner),
                any(),
                contains("Payment Received"),
                any(),
                any(),
                eq(true)
        );
    }

    @Test
    void verifyCustomerPayment_FailsOnInvalidSignature() throws Exception {
        testOrder.setTransactionId("order_rzp_real_9999");
        when(orderRepository.findByOrderNumber("ORD-TEST-1234")).thenReturn(Optional.of(testOrder));
        when(razorpayService.verifyPaymentSignature("order_rzp_real_9999", "pay_real_7777", "invalid_signature"))
                .thenReturn(false);

        Payment pendingPayment = new Payment();
        pendingPayment.setProviderOrderId("order_rzp_real_9999");
        pendingPayment.setStatus("PENDING");
        when(paymentRepository.findByProviderOrderId("order_rzp_real_9999")).thenReturn(Optional.of(pendingPayment));

        Map<String, String> payload = Map.of(
                "razorpayOrderId", "order_rzp_real_9999",
                "razorpayPaymentId", "pay_real_7777",
                "razorpaySignature", "invalid_signature"
        );

        mockMvc.perform(post("/api/storefront/orders/ORD-TEST-1234/verify-payment")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().is4xxClientError());

        // Verify order does NOT become PAID
        org.junit.jupiter.api.Assertions.assertEquals("PENDING", testOrder.getPaymentStatus());
        org.junit.jupiter.api.Assertions.assertEquals("NEW", testOrder.getOrderStatus());
        // Verify payment is recorded as FAILED
        org.junit.jupiter.api.Assertions.assertEquals("FAILED", pendingPayment.getStatus());
    }

    @Test
    void verifyCustomerPayment_FailsOnMismatchedOrderId() throws Exception {
        testOrder.setTransactionId("order_rzp_real_9999");
        when(orderRepository.findByOrderNumber("ORD-TEST-1234")).thenReturn(Optional.of(testOrder));

        Map<String, String> payload = Map.of(
                "razorpayOrderId", "order_rzp_DIFFERENT_1111",
                "razorpayPaymentId", "pay_real_7777",
                "razorpaySignature", "valid_sig"
        );

        mockMvc.perform(post("/api/storefront/orders/ORD-TEST-1234/verify-payment")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().is4xxClientError());

        // Verify order remains PENDING
        org.junit.jupiter.api.Assertions.assertEquals("PENDING", testOrder.getPaymentStatus());
    }

    @Test
    void verifyCustomerPayment_IsIdempotentWhenAlreadyPaid() throws Exception {
        testOrder.setPaymentStatus("PAID");
        testOrder.setOrderStatus("CONFIRMED");
        testOrder.setTransactionId("pay_real_7777");
        when(orderRepository.findByOrderNumber("ORD-TEST-1234")).thenReturn(Optional.of(testOrder));

        Payment completedPayment = new Payment();
        completedPayment.setId(888L);
        completedPayment.setStatus("COMPLETED");
        when(paymentRepository.findByProviderPaymentId("pay_real_7777")).thenReturn(Optional.of(completedPayment));

        Map<String, String> payload = Map.of(
                "razorpayOrderId", "order_rzp_real_9999",
                "razorpayPaymentId", "pay_real_7777",
                "razorpaySignature", "any_sig"
        );

        mockMvc.perform(post("/api/storefront/orders/ORD-TEST-1234/verify-payment")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("SUCCESS")))
                .andExpect(jsonPath("$.message", containsString("already verified")));

        // No duplicate notifications or saves
        verify(notificationService, never()).createNotification(any(), any(), any(), any(), any(), anyBoolean());
    }

    @Test
    void cancelCustomerPayment_SuccessfullyCancelsOrderAndSetsPaymentFailed() throws Exception {
        when(orderRepository.findByOrderNumber("ORD-TEST-1234")).thenReturn(Optional.of(testOrder));

        mockMvc.perform(post("/api/storefront/orders/ORD-TEST-1234/cancel-payment")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("reason", "Customer closed payment modal"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("CANCELLED")))
                .andExpect(jsonPath("$.orderNumber", is("ORD-TEST-1234")));

        assertEquals("CANCELLED", testOrder.getOrderStatus());
        assertEquals("FAILED", testOrder.getPaymentStatus());
        verify(orderRepository).save(testOrder);
    }

    @Test
    void cancelCustomerPayment_FailsIfOrderIsAlreadyPaid() throws Exception {
        testOrder.setPaymentStatus("PAID");
        testOrder.setOrderStatus("CONFIRMED");
        when(orderRepository.findByOrderNumber("ORD-TEST-1234")).thenReturn(Optional.of(testOrder));

        mockMvc.perform(post("/api/storefront/orders/ORD-TEST-1234/cancel-payment")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("reason", "Customer requested cancellation"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void cancelCustomerPayment_IsIdempotentWhenAlreadyCancelled() throws Exception {
        testOrder.setPaymentStatus("FAILED");
        testOrder.setOrderStatus("CANCELLED");
        when(orderRepository.findByOrderNumber("ORD-TEST-1234")).thenReturn(Optional.of(testOrder));

        mockMvc.perform(post("/api/storefront/orders/ORD-TEST-1234/cancel-payment")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("CANCELLED")))
                .andExpect(jsonPath("$.message", containsString("already cancelled")));
    }

    @Test
    void verifyCustomerPayment_OnCancelledOrder_RetainsCancelledStatusAndFlagsReconciliation() throws Exception {
        testOrder.setOrderStatus("CANCELLED");
        testOrder.setPaymentStatus("PENDING");
        testOrder.setTransactionId("order_rzp_real_9999");
        when(orderRepository.findByOrderNumber("ORD-TEST-1234")).thenReturn(Optional.of(testOrder));
        when(razorpayService.verifyPaymentSignature("order_rzp_real_9999", "pay_real_7777", "valid_signature_abc"))
                .thenReturn(true);

        Payment pendingPayment = new Payment();
        pendingPayment.setId(888L);
        pendingPayment.setShop(testShop);
        pendingPayment.setAmount(new BigDecimal("1250.00"));
        pendingPayment.setProviderOrderId("order_rzp_real_9999");
        pendingPayment.setStatus("PENDING");
        when(paymentRepository.findByProviderOrderId("order_rzp_real_9999")).thenReturn(Optional.of(pendingPayment));
        when(paymentRepository.saveAndFlush(any(Payment.class))).thenAnswer(inv -> inv.getArgument(0));

        Map<String, String> payload = Map.of(
                "razorpayOrderId", "order_rzp_real_9999",
                "razorpayPaymentId", "pay_real_7777",
                "razorpaySignature", "valid_signature_abc"
        );

        mockMvc.perform(post("/api/storefront/orders/ORD-TEST-1234/verify-payment")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("RECONCILIATION_REQUIRED")))
                .andExpect(jsonPath("$.orderNumber", is("ORD-TEST-1234")));

        // MUST retain CANCELLED order status - NEVER automatically CONFIRMED
        assertEquals("CANCELLED", testOrder.getOrderStatus());
        assertEquals("PAID", testOrder.getPaymentStatus());

        // Bakery owner notified of action required
        verify(notificationService, times(1)).createNotification(
                eq(testOwner),
                eq(NotificationType.PAYMENT_SUCCESS),
                contains("Action Required"),
                any(),
                any(),
                eq(true)
        );

        // Platform admin alerted for reconciliation
        verify(adminNotificationService, times(1)).dispatchAdminNotification(
                eq(com.cakeplatform.api.modules.notification.AdminNotificationType.PAYMENT_RECEIVED),
                contains("Payment on Cancelled Order"),
                any(),
                any(),
                any(),
                any(),
                any(),
                any()
        );
    }

    @Test
    void verifyCustomerPayment_RejectsRefundedOrder() throws Exception {
        testOrder.setPaymentStatus("REFUNDED");
        testOrder.setOrderStatus("CANCELLED");
        when(orderRepository.findByOrderNumber("ORD-TEST-1234")).thenReturn(Optional.of(testOrder));

        Map<String, String> payload = Map.of(
                "razorpayOrderId", "order_rzp_real_9999",
                "razorpayPaymentId", "pay_real_7777",
                "razorpaySignature", "valid_signature_abc"
        );

        mockMvc.perform(post("/api/storefront/orders/ORD-TEST-1234/verify-payment")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void verifyCustomerPayment_CancelledOrder_IdempotentWhenAlreadyPaid() throws Exception {
        testOrder.setPaymentStatus("PAID");
        testOrder.setOrderStatus("CANCELLED");
        testOrder.setTransactionId("pay_real_7777");
        when(orderRepository.findByOrderNumber("ORD-TEST-1234")).thenReturn(Optional.of(testOrder));

        Payment completedPayment = new Payment();
        completedPayment.setId(888L);
        completedPayment.setStatus("COMPLETED");
        when(paymentRepository.findByProviderPaymentId("pay_real_7777")).thenReturn(Optional.of(completedPayment));

        Map<String, String> payload = Map.of(
                "razorpayOrderId", "order_rzp_real_9999",
                "razorpayPaymentId", "pay_real_7777",
                "razorpaySignature", "any_sig"
        );

        mockMvc.perform(post("/api/storefront/orders/ORD-TEST-1234/verify-payment")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("RECONCILIATION_REQUIRED")))
                .andExpect(jsonPath("$.message", containsString("Payment verified on cancelled order")));

        // No duplicate owner notifications
        verify(notificationService, never()).createNotification(any(), any(), any(), any(), any(), anyBoolean());
    }
}

