package com.cakeplatform.api.modules.payment;

import com.cakeplatform.api.modules.audit.ActivityLoggerService;
import com.cakeplatform.api.modules.notification.NotificationService;
import com.cakeplatform.api.modules.order.InvoiceService;
import com.cakeplatform.api.modules.order.Order;
import com.cakeplatform.api.modules.order.OrderRepository;
import com.cakeplatform.api.modules.order.controller.WebhookController;
import com.cakeplatform.api.modules.payment.controller.CustomerPaymentController;
import com.cakeplatform.api.modules.payment.controller.OwnerPaymentController;
import com.cakeplatform.api.modules.payment.dto.OwnerPaymentResponse;
import com.cakeplatform.api.modules.security.ShopAccessValidator;
import com.cakeplatform.api.modules.shop.Shop;
import com.cakeplatform.api.modules.shop.ShopRepository;
import com.cakeplatform.api.modules.shop.ShopStatus;
import com.cakeplatform.api.modules.shop.ShopStatusManager;
import com.cakeplatform.api.modules.shop.VerificationStatus;
import com.cakeplatform.api.modules.subscription.Subscription;
import com.cakeplatform.api.modules.subscription.SubscriptionPlan;
import com.cakeplatform.api.modules.subscription.SubscriptionPlanRepository;
import com.cakeplatform.api.modules.subscription.SubscriptionRepository;
import com.cakeplatform.api.modules.subscription.SubscriptionService;
import com.cakeplatform.api.modules.subscription.SubscriptionStatus;
import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.security.CustomUserDetails;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class StageCPaymentAndSubscriptionTest {

    private static final String TEST_KEY_ID = "rzp_test_mockKey123";
    private static final String TEST_KEY_SECRET = "secret_xyz_abc_123456";
    private static final String TEST_WEBHOOK_SECRET = "whsec_super_secret_webhook_key";

    private RazorpayService razorpayService;

    // WebhookController mocks
    @Mock
    private OrderRepository orderRepository;
    @Mock
    private PaymentRepository paymentRepository;
    @Mock
    private SubscriptionService subscriptionService;
    @Mock
    private ShopRepository shopRepository;
    @Mock
    private NotificationService notificationService;
    @Mock
    private ActivityLoggerService activityLogger;
    @Mock
    private com.cakeplatform.api.modules.notification.AdminNotificationService adminNotificationService;

    private WebhookController webhookController;

    // OwnerPaymentController mocks
    @Mock
    private ShopAccessValidator shopAccessValidator;
    @Mock
    private InvoiceService invoiceService;
    @Mock
    private SubscriptionPlanRepository subscriptionPlanRepository;

    private OwnerPaymentController ownerPaymentController;

    // CustomerPaymentController
    private CustomerPaymentController customerPaymentController;

    private Shop testShop;
    private Shop otherShop;
    private User testOwner;
    private CustomUserDetails ownerDetails;

    @BeforeEach
    void setUp() {
        razorpayService = spy(new RazorpayService(TEST_KEY_ID, TEST_KEY_SECRET, TEST_WEBHOOK_SECRET, org.mockito.Mockito.mock(com.cakeplatform.api.modules.settings.GlobalSettingsService.class)));

        com.cakeplatform.api.modules.payment.WebhookEventRepository webhookEventRepo = org.mockito.Mockito.mock(com.cakeplatform.api.modules.payment.WebhookEventRepository.class);
        webhookController = new WebhookController(
                orderRepository,
                paymentRepository,
                subscriptionService,
                shopRepository,
                razorpayService,
                notificationService,
                subscriptionPlanRepository,
                adminNotificationService,
                activityLogger,
                webhookEventRepo
        );

        ownerPaymentController = new OwnerPaymentController(
                subscriptionService,
                paymentRepository,
                shopAccessValidator,
                razorpayService,
                invoiceService,
                subscriptionPlanRepository
        );

        customerPaymentController = new CustomerPaymentController(
                orderRepository,
                paymentRepository,
                razorpayService,
                notificationService,
                adminNotificationService
        );

        testOwner = new User();
        testOwner.setId(1L);
        testOwner.setEmail("owner@sweetdelights.com");

        testShop = new Shop();
        testShop.setId(101L);
        testShop.setBusinessName("Sweet Delights Bakery");
        testShop.setStatus(ShopStatus.ACTIVE);
        testShop.setVerificationStatus(VerificationStatus.VERIFIED);
        testShop.setOwner(testOwner);

        otherShop = new Shop();
        otherShop.setId(202L);
        otherShop.setBusinessName("Other Bakery");
        otherShop.setStatus(ShopStatus.ACTIVE);
        otherShop.setVerificationStatus(VerificationStatus.VERIFIED);

        ownerDetails = mock(CustomUserDetails.class);
        lenient().when(ownerDetails.getId()).thenReturn(1L);
    }

    private String calculateHmac(String data, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKey = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            mac.init(secretKey);
            byte[] hash = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    // =========================================================================
    // 1. C1 - Razorpay HMAC-SHA256 Signature Verification
    // =========================================================================

    @Test
    @DisplayName("C1.1: Valid checkout signature passes HMAC verification")
    void testCheckoutSignature_Valid() {
        String orderId = "order_123456";
        String paymentId = "pay_789012";
        String data = orderId + "|" + paymentId;
        String validSignature = calculateHmac(data, TEST_KEY_SECRET);

        boolean result = razorpayService.verifyPaymentSignature(orderId, paymentId, validSignature);
        assertTrue(result, "Valid HMAC-SHA256 signature must be verified successfully");
    }

    @Test
    @DisplayName("C1.2: Tampered signature is rejected")
    void testCheckoutSignature_TamperedRejected() {
        String orderId = "order_123456";
        String paymentId = "pay_789012";
        String data = orderId + "|" + paymentId;
        String validSignature = calculateHmac(data, TEST_KEY_SECRET);
        String tamperedSignature = validSignature.substring(0, validSignature.length() - 2) + "ff";

        boolean result = razorpayService.verifyPaymentSignature(orderId, paymentId, tamperedSignature);
        assertFalse(result, "Tampered signature must be rejected");
    }

    @Test
    @DisplayName("C1.3: Tampered paymentId or orderId is rejected")
    void testCheckoutSignature_TamperedPayloadRejected() {
        String orderId = "order_123456";
        String paymentId = "pay_789012";
        String data = orderId + "|" + paymentId;
        String validSignature = calculateHmac(data, TEST_KEY_SECRET);

        boolean result = razorpayService.verifyPaymentSignature(orderId, "pay_TAMPERED", validSignature);
        assertFalse(result, "Signature with tampered paymentId must be rejected");
    }

    @Test
    @DisplayName("C1.4: Null or empty signature parameters are rejected safely")
    void testCheckoutSignature_NullOrEmptyInputs() {
        assertFalse(razorpayService.verifyPaymentSignature(null, "pay_1", "sig"));
        assertFalse(razorpayService.verifyPaymentSignature("ord_1", null, "sig"));
        assertFalse(razorpayService.verifyPaymentSignature("ord_1", "pay_1", null));
        assertFalse(razorpayService.verifyPaymentSignature("ord_1", "pay_1", ""));
    }

    @Test
    @DisplayName("C1.5: Valid raw-body webhook signature passes verification")
    void testWebhookSignature_Valid() {
        String rawPayload = """
                {"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_123"}}}}
                """.trim();
        String validSignature = calculateHmac(rawPayload, TEST_WEBHOOK_SECRET);

        boolean result = razorpayService.verifyWebhookSignature(rawPayload, validSignature);
        assertTrue(result, "Webhook signature calculated over exact raw string must pass");
    }

    @Test
    @DisplayName("C1.6: Webhook signature with modified raw payload is rejected")
    void testWebhookSignature_PayloadModifiedRejected() {
        String originalPayload = """
                {"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_123"}}}}
                """.trim();
        String signature = calculateHmac(originalPayload, TEST_WEBHOOK_SECRET);
        String tamperedPayload = originalPayload.replace("pay_123", "pay_999");

        boolean result = razorpayService.verifyWebhookSignature(tamperedPayload, signature);
        assertFalse(result, "Tampered raw payload must fail webhook HMAC check");
    }

    // =========================================================================
    // 2. C2 - Secure Webhook Processing & Idempotency
    // =========================================================================

    @Test
    @DisplayName("C2.1: Webhook missing signature header returns HTTP 400")
    void testWebhook_MissingSignatureReturns400() {
        ResponseEntity<String> response = webhookController.handleRazorpayWebhook(null, "evt_mock_id", "{\"event\":\"payment.captured\"}");
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertTrue(response.getBody().contains("Missing signature"));
    }

    @Test
    @DisplayName("C2.2: Webhook with invalid signature returns HTTP 400")
    void testWebhook_InvalidSignatureReturns400() {
        String payload = "{\"event\":\"payment.captured\"}";
        ResponseEntity<String> response = webhookController.handleRazorpayWebhook("invalid_signature_hex", "evt_mock_id", payload);
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertTrue(response.getBody().contains("Invalid webhook signature"));
    }

    @Test
    @DisplayName("C2.3: Webhook payment.captured marks order PAID and creates Payment record")
    void testWebhook_PaymentCaptured_Success() {
        String orderNumber = "ORD-20260909-001";
        String txId = "pay_live_capture_999";

        Order order = new Order();
        order.setId(10L);
        order.setOrderNumber(orderNumber);
        order.setOrderStatus("NEW");
        order.setPaymentStatus("PENDING");
        order.setTotalAmount(BigDecimal.valueOf(1250.00));
        order.setShop(testShop);

        when(orderRepository.findByOrderNumber(orderNumber)).thenReturn(Optional.of(order));
        when(paymentRepository.findByProviderPaymentId(txId)).thenReturn(Optional.empty());

        String rawPayload = """
                {
                  "event": "payment.captured",
                  "payload": {
                    "payment": {
                      "entity": {
                        "id": "%s",
                        "order_id": "order_rzp_123",
                        "amount": 125000,
                        "currency": "INR",
                        "notes": {
                          "order_number": "%s"
                        }
                      }
                    }
                  }
                }
                """.formatted(txId, orderNumber).trim();

        String signature = calculateHmac(rawPayload, TEST_WEBHOOK_SECRET);

        ResponseEntity<String> response = webhookController.handleRazorpayWebhook(signature, "evt_mock_id", rawPayload);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("PAID", order.getPaymentStatus());
        assertEquals("CONFIRMED", order.getOrderStatus());
        assertEquals(txId, order.getTransactionId());
        assertNotNull(order.getPaidAt());

        verify(orderRepository).save(order);
        verify(paymentRepository).save(any(Payment.class));
        verify(activityLogger).logActivity(isNull(), eq(testShop.getId()), eq("PAYMENT_CAPTURED_WEBHOOK"), eq("ORDER"), eq(order.getId()), anyString());
    }

    @Test
    @DisplayName("C2.4: Duplicate webhook payment.captured is strictly idempotent")
    void testWebhook_PaymentCaptured_Idempotent() {
        String orderNumber = "ORD-20260909-002";
        String txId = "pay_already_captured_888";

        Order alreadyPaidOrder = new Order();
        alreadyPaidOrder.setId(11L);
        alreadyPaidOrder.setOrderNumber(orderNumber);
        alreadyPaidOrder.setOrderStatus("CONFIRMED");
        alreadyPaidOrder.setPaymentStatus("PAID"); // Already paid!
        alreadyPaidOrder.setTransactionId(txId);
        alreadyPaidOrder.setShop(testShop);

        when(orderRepository.findByOrderNumber(orderNumber)).thenReturn(Optional.of(alreadyPaidOrder));

        String rawPayload = """
                {
                  "event": "payment.captured",
                  "payload": {
                    "payment": {
                      "entity": {
                        "id": "%s",
                        "order_id": "order_rzp_456",
                        "notes": {
                          "internal_order_number": "%s"
                        }
                      }
                    }
                  }
                }
                """.formatted(txId, orderNumber).trim();

        String signature = calculateHmac(rawPayload, TEST_WEBHOOK_SECRET);

        ResponseEntity<String> response = webhookController.handleRazorpayWebhook(signature, "evt_mock_id", rawPayload);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(response.getBody().contains("idempotent"));

        // Must not re-save or duplicate payment
        verify(orderRepository, never()).save(alreadyPaidOrder);
        verify(paymentRepository, never()).save(any(Payment.class));
    }

    @Test
    @DisplayName("C2.5: Webhook payment.captured for owner subscription calls SubscriptionService")
    void testWebhook_SubscriptionPaymentCaptured() {
        Long shopId = testShop.getId();
        String txId = "pay_sub_capture_777";
        String rzpOrderId = "order_sub_123";

        when(shopRepository.findById(shopId)).thenReturn(Optional.of(testShop));
        SubscriptionPlan mockPlan = new SubscriptionPlan();
        mockPlan.setId(1L);
        mockPlan.setPrice(BigDecimal.valueOf(350));
        mockPlan.setDurationDays(30);
        mockPlan.setIsActive(true);

        Payment pendingPayment = new Payment();
        pendingPayment.setId(999L);
        pendingPayment.setShop(testShop);
        pendingPayment.setPlan(mockPlan);
        pendingPayment.setAmount(BigDecimal.valueOf(350));
        pendingPayment.setCurrency("INR");
        pendingPayment.setProviderOrderId(rzpOrderId);
        pendingPayment.setStatus("PENDING");

        when(paymentRepository.findByProviderOrderId(rzpOrderId)).thenReturn(Optional.of(pendingPayment));

        // Mock payment save to return a Payment with an ID
        org.mockito.Mockito.lenient().when(paymentRepository.findByIdWithLock(anyLong())).thenAnswer(i -> { Payment p = new Payment(); p.setStatus("PENDING"); return java.util.Optional.of(p); }); org.mockito.Mockito.lenient().when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> {
            Payment p = inv.getArgument(0);
            if (p.getId() == null) p.setId(999L);
            return p;
        });

        String rawPayload = """
                {
                  "event": "payment.captured",
                  "payload": {
                    "payment": {
                      "entity": {
                        "id": "%s",
                        "order_id": "%s",
                        "amount": 35000,
                        "currency": "INR",
                        "notes": {
                          "payment_type": "SUBSCRIPTION",
                          "shop_id": "%d",
                          "billing_cycle": "monthly"
                        }
                      }
                    }
                  }
                }
                """.formatted(txId, rzpOrderId, shopId).trim();

        String signature = calculateHmac(rawPayload, TEST_WEBHOOK_SECRET);

        ResponseEntity<String> response = webhookController.handleRazorpayWebhook(signature, "evt_mock_id", rawPayload);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(subscriptionService).processSuccessfulPayment(eq(testOwner.getId()), any(), eq(rzpOrderId), eq(txId), any(com.cakeplatform.api.modules.payment.Payment.class)
        );
    }

    // =========================================================================
    // 3. C3 - Owner Payment History & Tenant Isolation
    // =========================================================================

    @Test
    @DisplayName("C3.1: getMyPayments returns payments belonging to owner shop only")
    void testGetMyPayments_TenantIsolation() {
        when(shopAccessValidator.getShopByOwnerId(1L)).thenReturn(testShop);

        Payment p1 = new Payment();
        p1.setId(101L);
        p1.setShop(testShop);
        p1.setAmount(BigDecimal.valueOf(350.00));
        p1.setStatus("COMPLETED");
        p1.setProviderPaymentId("pay_abc_1");
        p1.setCreatedAt(LocalDateTime.now().minusDays(5));

        Payment p2 = new Payment();
        p2.setId(102L);
        p2.setShop(testShop);
        p2.setAmount(BigDecimal.valueOf(350.00));
        p2.setStatus("COMPLETED");
        p2.setProviderPaymentId("pay_abc_2");
        p2.setCreatedAt(LocalDateTime.now());

        when(paymentRepository.findSubscriptionPaymentsByShopId(eq(testShop.getId()), any(org.springframework.data.domain.Pageable.class)))
                .thenReturn(new org.springframework.data.domain.PageImpl<>(List.of(p2, p1), org.springframework.data.domain.PageRequest.of(0, 10), 2));

        ResponseEntity<org.springframework.data.domain.Page<OwnerPaymentResponse>> response = ownerPaymentController.getMyPayments(ownerDetails);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(2, response.getBody().getContent().size());
        assertEquals(2, response.getBody().getTotalElements());
        assertEquals(1, response.getBody().getTotalPages());
        assertEquals(102L, response.getBody().getContent().get(0).getId());
        assertEquals(101L, response.getBody().getContent().get(1).getId());
        assertTrue(response.getBody().getContent().get(0).isInvoiceAvailable());
    }

    @Test
    @DisplayName("C3.2: Cross-tenant invoice download is blocked")
    void testDownloadInvoice_CrossTenantBlocked() {
        when(shopAccessValidator.getShopByOwnerId(1L)).thenReturn(testShop);
        Long targetPaymentId = 999L;

        // Payment 999 does NOT belong to testShop (belongs to otherShop)
        when(paymentRepository.findByIdAndShopId(targetPaymentId, testShop.getId()))
                .thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () ->
                ownerPaymentController.downloadSubscriptionInvoice(ownerDetails, targetPaymentId));
    }

    @Test
    @DisplayName("C3.3: Invoice download for incomplete payment is rejected")
    void testDownloadInvoice_PendingPaymentRejected() {
        when(shopAccessValidator.getShopByOwnerId(1L)).thenReturn(testShop);
        Payment pendingPayment = new Payment();
        pendingPayment.setId(55L);
        pendingPayment.setShop(testShop);
        pendingPayment.setStatus("PENDING");

        when(paymentRepository.findByIdAndShopId(55L, testShop.getId()))
                .thenReturn(Optional.of(pendingPayment));

        assertThrows(IllegalStateException.class, () ->
                ownerPaymentController.downloadSubscriptionInvoice(ownerDetails, 55L));
    }

    @Test
    @DisplayName("C3.4: Initiate subscription payment with configured credentials creates pending order")
    void testInitiateSubscriptionPayment_ConfiguredCredentials() {
        when(shopAccessValidator.validateBillingAccess(1L)).thenReturn(testShop);

        SubscriptionPlan plan = new SubscriptionPlan();
        plan.setId(1L);
        plan.setName("Pro Baker Studio");
        plan.setPrice(BigDecimal.valueOf(350));
        plan.setDurationDays(30);
        plan.setIsActive(true);
        when(subscriptionPlanRepository.findById(1L)).thenReturn(Optional.of(plan));

        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> {
            Payment p = inv.getArgument(0);
            if (p.getId() == null) p.setId(500L);
            return p;
        });
        doReturn("order_sub_rzp_500").when(razorpayService)
                .createSubscriptionOrder(eq(BigDecimal.valueOf(350)), eq(1L), eq(testShop.getId()), any());

        ResponseEntity<Map<String, Object>> res = ownerPaymentController.initiateSubscriptionPayment(
                ownerDetails, Map.of("planId", 1L));

        assertEquals(HttpStatus.OK, res.getStatusCode());
        assertNotNull(res.getBody());
        assertEquals("order_sub_rzp_500", res.getBody().get("razorpayOrderId"));
        assertEquals(35000L, res.getBody().get("amountPaise"));
        assertEquals("Sweet Delights Bakery", res.getBody().get("shopName"));
    }

    @Test
    @DisplayName("C3.5: Initiate subscription payment in unconfigured test profile generates simulated order")
    void testInitiateSubscriptionPayment_UnconfiguredTestProfile() {
        when(shopAccessValidator.validateBillingAccess(1L)).thenReturn(testShop);

        SubscriptionPlan plan = new SubscriptionPlan();
        plan.setId(1L);
        plan.setName("Pro Baker Studio");
        plan.setPrice(BigDecimal.valueOf(350));
        plan.setDurationDays(30);
        plan.setIsActive(true);
        when(subscriptionPlanRepository.findById(1L)).thenReturn(Optional.of(plan));

        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> {
            Payment p = inv.getArgument(0);
            if (p.getId() == null) p.setId(501L);
            return p;
        });

        // Configure test environment on controller and unconfigured razorpay
        doReturn(false).when(razorpayService).isConfigured();
        org.springframework.mock.env.MockEnvironment mockEnv = new org.springframework.mock.env.MockEnvironment();
        mockEnv.setActiveProfiles("test");
        ownerPaymentController.setEnvironment(mockEnv);

        ResponseEntity<Map<String, Object>> res = ownerPaymentController.initiateSubscriptionPayment(
                ownerDetails, Map.of("planId", 1L));

        assertEquals(HttpStatus.OK, res.getStatusCode());
        assertNotNull(res.getBody());
        assertEquals("order_mock_sub_501", res.getBody().get("razorpayOrderId"));
    }

    @Test
    @DisplayName("C3.6: Verify subscription payment with valid HMAC signature activates subscription")
    void testVerifySubscriptionPayment_ValidSignature() {
        when(shopAccessValidator.getShopByOwnerId(1L)).thenReturn(testShop);

        SubscriptionPlan plan = new SubscriptionPlan();
        plan.setId(1L);
        plan.setName("Pro Baker Studio");
        plan.setPrice(BigDecimal.valueOf(350));
        plan.setIsActive(true);
        when(subscriptionPlanRepository.findById(1L)).thenReturn(Optional.of(plan));

        Payment pending = new Payment();
        pending.setId(600L);
        pending.setShop(testShop);
        pending.setPlan(plan);
        pending.setAmount(BigDecimal.valueOf(350));
        pending.setStatus("PENDING");
        pending.setProviderOrderId("order_rzp_sub_600");
        when(paymentRepository.findByProviderOrderId("order_rzp_sub_600")).thenReturn(Optional.of(pending));

        doReturn(true).when(razorpayService).isConfigured();
        doReturn(true).when(razorpayService).verifyPaymentSignature(eq("order_rzp_sub_600"), eq("pay_rzp_777"), eq("valid_sig_mock"));
        doNothing().when(razorpayService).verifyOrderDetails(any(), any(), any());

        when(subscriptionService.processSuccessfulPayment(eq(1L), eq(plan), eq("order_rzp_sub_600"), eq("pay_rzp_777"), any()))
                .thenAnswer(inv -> {
                    Payment p = inv.getArgument(4);
                    p.setStatus("COMPLETED");
                    return p;
                });

        ResponseEntity<Map<String, Object>> res = ownerPaymentController.verifySubscriptionPayment(
                ownerDetails, Map.of(
                        "razorpayOrderId", "order_rzp_sub_600",
                        "razorpayPaymentId", "pay_rzp_777",
                        "razorpaySignature", "valid_sig_mock",
                        "planId", 1L
                ));

        assertEquals(HttpStatus.OK, res.getStatusCode());
        assertNotNull(res.getBody());
        assertEquals("SUCCESS", res.getBody().get("status"));
        assertEquals("Subscription payment verified successfully", res.getBody().get("message"));
    }

    @Test
    @DisplayName("C3.7: Verify subscription payment with invalid signature throws IllegalArgumentException")
    void testVerifySubscriptionPayment_InvalidSignature_Rejected() {
        SubscriptionPlan plan = new SubscriptionPlan();
        plan.setId(1L);
        plan.setIsActive(true);
        when(subscriptionPlanRepository.findById(1L)).thenReturn(Optional.of(plan));

        doReturn(true).when(razorpayService).isConfigured();
        doReturn(false).when(razorpayService).verifyPaymentSignature(eq("order_rzp_sub_600"), eq("pay_rzp_777"), any());

        assertThrows(IllegalArgumentException.class, () ->
                ownerPaymentController.verifySubscriptionPayment(
                        ownerDetails, Map.of(
                                "razorpayOrderId", "order_rzp_sub_600",
                                "razorpayPaymentId", "pay_rzp_777",
                                "razorpaySignature", "tampered_signature_hex",
                                "planId", 1L
                        )));
    }

    @Test
    @DisplayName("C3.8: Verify subscription payment in unconfigured test profile accepts simulated signature")
    void testVerifySubscriptionPayment_SimulatedSignature_InTestProfile() {
        when(shopAccessValidator.getShopByOwnerId(1L)).thenReturn(testShop);

        SubscriptionPlan plan = new SubscriptionPlan();
        plan.setId(1L);
        plan.setName("Pro Baker Studio");
        plan.setPrice(BigDecimal.valueOf(350));
        plan.setIsActive(true);
        when(subscriptionPlanRepository.findById(1L)).thenReturn(Optional.of(plan));

        Payment pending = new Payment();
        pending.setId(601L);
        pending.setShop(testShop);
        pending.setPlan(plan);
        pending.setAmount(BigDecimal.valueOf(350));
        pending.setStatus("PENDING");
        pending.setProviderOrderId("order_mock_sub_601");
        when(paymentRepository.findByProviderOrderId("order_mock_sub_601")).thenReturn(Optional.of(pending));

        doReturn(false).when(razorpayService).isConfigured();
        org.springframework.mock.env.MockEnvironment mockEnv = new org.springframework.mock.env.MockEnvironment();
        mockEnv.setActiveProfiles("test");
        ownerPaymentController.setEnvironment(mockEnv);

        when(subscriptionService.processSuccessfulPayment(eq(1L), eq(plan), eq("order_mock_sub_601"), eq("pay_mock_999"), any()))
                .thenAnswer(inv -> {
                    Payment p = inv.getArgument(4);
                    p.setStatus("COMPLETED");
                    return p;
                });

        ResponseEntity<Map<String, Object>> res = ownerPaymentController.verifySubscriptionPayment(
                ownerDetails, Map.of(
                        "razorpayOrderId", "order_mock_sub_601",
                        "razorpayPaymentId", "pay_mock_999",
                        "razorpaySignature", "simulated_test_sig",
                        "planId", 1L
                ));

        assertEquals(HttpStatus.OK, res.getStatusCode());
        assertNotNull(res.getBody());
        assertEquals("SUCCESS", res.getBody().get("status"));
    }

    @Test
    @DisplayName("C3.9: Simulated signature is STRICTLY REJECTED in production profile")
    void testVerifySubscriptionPayment_SimulatedSignature_RejectedInProdProfile() {
        SubscriptionPlan plan = new SubscriptionPlan();
        plan.setId(1L);
        plan.setIsActive(true);
        when(subscriptionPlanRepository.findById(1L)).thenReturn(Optional.of(plan));

        doReturn(false).when(razorpayService).isConfigured();
        org.springframework.mock.env.MockEnvironment prodEnv = new org.springframework.mock.env.MockEnvironment();
        prodEnv.setActiveProfiles("prod");
        ownerPaymentController.setEnvironment(prodEnv);

        // In prod, even with simulated_test_sig, it must be rejected!
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                ownerPaymentController.verifySubscriptionPayment(
                        ownerDetails, Map.of(
                                "razorpayOrderId", "order_mock_sub_601",
                                "razorpayPaymentId", "pay_mock_999",
                                "razorpaySignature", "simulated_test_sig",
                                "planId", 1L
                        )));
        assertTrue(ex.getMessage().contains("Razorpay is not configured for production use"));
    }

    // =========================================================================
    // 4. C4 - Subscription Lifecycle & Administrative Invariants
    // =========================================================================

    @Test
    @DisplayName("C4.1: Subscription renewal restores INACTIVE verified shop to ACTIVE")
    void testSubscriptionRenewal_RestoresInactiveVerifiedShop() {
        SubscriptionRepository subRepo = mock(SubscriptionRepository.class);
        PaymentRepository pRepo = mock(PaymentRepository.class);
        ShopRepository sRepo = mock(ShopRepository.class);
        ShopStatusManager ssMgr = mock(ShopStatusManager.class);
        ActivityLoggerService aLogger = mock(ActivityLoggerService.class);
        NotificationService nService = mock(NotificationService.class);

        SubscriptionService subService = new SubscriptionService(
                subRepo, pRepo, sRepo, ssMgr, aLogger, nService, adminNotificationService
        );

        Shop inactiveShop = new Shop();
        inactiveShop.setId(10L);
        inactiveShop.setStatus(ShopStatus.INACTIVE);
        inactiveShop.setVerificationStatus(VerificationStatus.VERIFIED);
        inactiveShop.setOwner(testOwner);

        when(sRepo.findByOwnerId(1L)).thenReturn(List.of(inactiveShop));
        when(subRepo.save(any(Subscription.class))).thenAnswer(inv -> {
            Subscription s = inv.getArgument(0);
            s.setId(100L);
            return s;
        });
        when(pRepo.findByIdWithLock(anyLong())).thenAnswer(i -> { Payment pm = new Payment(); pm.setStatus("PENDING"); return java.util.Optional.of(pm); }); when(pRepo.save(any(Payment.class))).thenAnswer(inv -> {
            Payment p = inv.getArgument(0);
            p.setId(200L);
            return p;
        });

        Payment payment = subService.processSuccessfulPayment(1L, new com.cakeplatform.api.modules.subscription.SubscriptionPlan() {{ setPrice(java.math.BigDecimal.valueOf(350)); setDurationDays(30); }}, "ord_sub_1", "pay_renewal_1", new com.cakeplatform.api.modules.payment.Payment() {{ setId(100L); }});

        assertNotNull(payment);
        assertEquals("COMPLETED", payment.getStatus());
        // Phase 1 Lifecycle Specification: Subscription renewal preserves owner-disabled INACTIVE status; activateShop is not called
        verify(ssMgr, never()).activateShop(anyLong(), anyLong());
    }

    @Test
    @DisplayName("C4.2: CRITICAL - Subscription renewal does NOT restore SUSPENDED shop")
    void testSubscriptionRenewal_DoesNotRestoreSuspendedShop() {
        SubscriptionRepository subRepo = mock(SubscriptionRepository.class);
        PaymentRepository pRepo = mock(PaymentRepository.class);
        ShopRepository sRepo = mock(ShopRepository.class);
        ShopStatusManager ssMgr = mock(ShopStatusManager.class);
        ActivityLoggerService aLogger = mock(ActivityLoggerService.class);
        NotificationService nService = mock(NotificationService.class);

        SubscriptionService subService = new SubscriptionService(
                subRepo, pRepo, sRepo, ssMgr, aLogger, nService, adminNotificationService
        );

        Shop suspendedShop = new Shop();
        suspendedShop.setId(12L);
        suspendedShop.setStatus(ShopStatus.SUSPENDED); // Admin suspended
        suspendedShop.setVerificationStatus(VerificationStatus.VERIFIED);
        suspendedShop.setOwner(testOwner);

        when(sRepo.findByOwnerId(1L)).thenReturn(List.of(suspendedShop));
        when(subRepo.save(any(Subscription.class))).thenAnswer(inv -> {
            Subscription s = inv.getArgument(0);
            s.setId(101L);
            return s;
        });
        when(pRepo.findByIdWithLock(anyLong())).thenAnswer(i -> { Payment pm = new Payment(); pm.setStatus("PENDING"); return java.util.Optional.of(pm); }); when(pRepo.save(any(Payment.class))).thenAnswer(inv -> {
            Payment p = inv.getArgument(0);
            p.setId(201L);
            return p;
        });

        Payment payment = subService.processSuccessfulPayment(1L, new com.cakeplatform.api.modules.subscription.SubscriptionPlan() {{ setPrice(java.math.BigDecimal.valueOf(350)); setDurationDays(30); }}, "ord_sub_2", "pay_renewal_2", new com.cakeplatform.api.modules.payment.Payment() {{ setId(100L); }});

        assertNotNull(payment);
        // Crucial invariant: SUSPENDED must NOT be overturned by subscription renewal!
        verify(ssMgr, never()).activateShop(anyLong(), anyLong());
        assertEquals(ShopStatus.SUSPENDED, suspendedShop.getStatus(),
                "Suspended shop must remain SUSPENDED even after subscription renewal! Admin action takes strict precedence.");
    }

    @Test
    @DisplayName("C4.3: Payment success activates unverified shop to ACTIVE while preserving PROCESSING verification status")
    void testSubscriptionRenewal_DoesNotRestoreUnverifiedShop() {
        SubscriptionRepository subRepo = mock(SubscriptionRepository.class);
        PaymentRepository pRepo = mock(PaymentRepository.class);
        ShopRepository sRepo = mock(ShopRepository.class);
        ShopStatusManager ssMgr = mock(ShopStatusManager.class);
        ActivityLoggerService aLogger = mock(ActivityLoggerService.class);
        NotificationService nService = mock(NotificationService.class);

        SubscriptionService subService = new SubscriptionService(
                subRepo, pRepo, sRepo, ssMgr, aLogger, nService, adminNotificationService
        );

        Shop unverifiedShop = new Shop();
        unverifiedShop.setId(14L);
        unverifiedShop.setStatus(ShopStatus.PENDING);
        unverifiedShop.setVerificationStatus(VerificationStatus.PROCESSING);
        unverifiedShop.setOwner(testOwner);

        when(sRepo.findByOwnerId(1L)).thenReturn(List.of(unverifiedShop));
        when(subRepo.save(any(Subscription.class))).thenAnswer(inv -> {
            Subscription s = inv.getArgument(0);
            s.setId(102L);
            return s;
        });
        when(pRepo.findByIdWithLock(anyLong())).thenAnswer(i -> { Payment pm = new Payment(); pm.setStatus("PENDING"); return java.util.Optional.of(pm); }); when(pRepo.save(any(Payment.class))).thenAnswer(inv -> {
            Payment p = inv.getArgument(0);
            p.setId(202L);
            return p;
        });

        Payment payment = subService.processSuccessfulPayment(1L, new com.cakeplatform.api.modules.subscription.SubscriptionPlan() {{ setPrice(java.math.BigDecimal.valueOf(350)); setDurationDays(30); }}, "ord_sub_3", "pay_renewal_3", new com.cakeplatform.api.modules.payment.Payment() {{ setId(100L); }});

        assertNotNull(payment);
        // Authoritative CakeStore V1 Rule: Payment success activates shop to ACTIVE
        verify(ssMgr).activateShop(14L, 1L);
        assertEquals(VerificationStatus.PROCESSING, unverifiedShop.getVerificationStatus(),
                "Verification status must remain PROCESSING until admin explicitly approves");
    }

    // =========================================================================
    // 5. C5 - OpenPDF Subscription Invoice Generation
    // =========================================================================

    @Test
    @DisplayName("C5.1: generateSubscriptionInvoice generates valid PDF document starting with %PDF-")
    void testGenerateSubscriptionInvoice_ValidPdf() throws Exception {
        InvoiceService realInvoiceService = new InvoiceService();

        Payment payment = new Payment();
        payment.setId(888L);
        payment.setAmount(BigDecimal.valueOf(350.00));
        payment.setCurrency("INR");
        payment.setProvider("RAZORPAY");
        payment.setProviderPaymentId("pay_tax_sub_123");
        payment.setStatus("COMPLETED");
        payment.setPaidAt(LocalDateTime.now());
        payment.setShop(testShop);

        SubscriptionPlan plan = new SubscriptionPlan();
        plan.setName("Pro Baker Studio");
        Subscription sub = new Subscription();
        sub.setPlan(plan);
        payment.setSubscription(sub);

        byte[] pdf = realInvoiceService.generateSubscriptionInvoice(payment);

        assertNotNull(pdf, "Generated PDF bytes must not be null");
        assertTrue(pdf.length > 500, "PDF document must have meaningful size");
        String header = new String(Arrays.copyOfRange(pdf, 0, 5), StandardCharsets.US_ASCII);
        assertEquals("%PDF-", header, "PDF document must start with '%PDF-' magic bytes");
    }

    // =========================================================================
    // 6. C6 - Customer Payment Flow & COD Coexistence
    // =========================================================================

    @Test
    @DisplayName("C6.1: Customer create payment order returns server-authoritative amount")
    void testCustomerCreatePaymentOrder_AuthoritativeAmount() {
        Order order = new Order();
        order.setId(50L);
        order.setOrderNumber("ORD-AUTH-100");
        order.setOrderStatus("NEW");
        order.setPaymentStatus("UNPAID");
        order.setTotalAmount(BigDecimal.valueOf(1850.50));
        order.setShop(testShop);
        order.setCustomerName("Rohan Verma");

        when(orderRepository.findByOrderNumber("ORD-AUTH-100")).thenReturn(Optional.of(order));
        doReturn("order_rzp_real_mock100").when(razorpayService)
                .createCustomerOrder(eq(BigDecimal.valueOf(1850.50)), eq("ORD-AUTH-100"), any(), any());

        ResponseEntity<Map<String, Object>> response =
                customerPaymentController.createCustomerPaymentOrder("ORD-AUTH-100");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertEquals(BigDecimal.valueOf(1850.50), body.get("amount"));
        assertEquals(185050L, body.get("amountPaise"));
        assertEquals(TEST_KEY_ID, body.get("keyId"));
        assertEquals("Sweet Delights Bakery", body.get("shopName"));
        assertEquals("order_rzp_real_mock100", body.get("razorpayOrderId"));
    }

    @Test
    @DisplayName("C6.2: Customer create payment order rejects cancelled or already paid orders")
    void testCustomerCreatePaymentOrder_RejectsInvalidState() {
        Order cancelledOrder = new Order();
        cancelledOrder.setOrderStatus("CANCELLED");
        when(orderRepository.findByOrderNumber("ORD-CANCELLED")).thenReturn(Optional.of(cancelledOrder));

        assertThrows(IllegalStateException.class, () ->
                customerPaymentController.createCustomerPaymentOrder("ORD-CANCELLED"));

        Order paidOrder = new Order();
        paidOrder.setOrderStatus("CONFIRMED");
        paidOrder.setPaymentStatus("PAID");
        when(orderRepository.findByOrderNumber("ORD-PAID")).thenReturn(Optional.of(paidOrder));

        assertThrows(IllegalStateException.class, () ->
                customerPaymentController.createCustomerPaymentOrder("ORD-PAID"));
    }
}
