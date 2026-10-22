package com.cakeplatform.api.modules.order.scheduler;

import com.cakeplatform.api.exception.DeliverySlotFullException;
import com.cakeplatform.api.modules.order.Order;
import com.cakeplatform.api.modules.order.OrderRepository;
import com.cakeplatform.api.modules.order.service.OrderService;
import com.cakeplatform.api.modules.payment.Payment;
import com.cakeplatform.api.modules.payment.PaymentRepository;
import com.cakeplatform.api.modules.payment.RazorpayService;
import com.cakeplatform.api.modules.payment.WebhookEventRepository;
import com.cakeplatform.api.modules.product.Product;
import com.cakeplatform.api.modules.product.ProductRepository;
import com.cakeplatform.api.modules.shop.Shop;
import com.cakeplatform.api.modules.shop.ShopDeliverySlot;
import com.cakeplatform.api.modules.shop.ShopDeliverySlotRepository;
import com.cakeplatform.api.modules.shop.ShopRepository;
import com.cakeplatform.api.modules.shop.ShopStatus;
import com.cakeplatform.api.modules.storefront.CustomerStorefrontService;
import com.cakeplatform.api.modules.storefront.dto.GuestOrderRequest;
import com.cakeplatform.api.modules.storefront.dto.StorefrontOrderItem;
import com.cakeplatform.api.modules.subscription.Subscription;
import com.cakeplatform.api.modules.subscription.SubscriptionRepository;
import com.cakeplatform.api.modules.subscription.SubscriptionStatus;
import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.modules.user.UserRepository;
import com.cakeplatform.api.modules.user.UserRole;
import com.cakeplatform.api.modules.notification.AdminNotification;
import com.cakeplatform.api.modules.notification.AdminNotificationRepository;
import com.cakeplatform.api.modules.notification.AdminNotificationType;
import com.cakeplatform.api.modules.notification.EmailService;
import com.cakeplatform.api.modules.notification.Notification;
import com.cakeplatform.api.modules.notification.NotificationRepository;
import com.cakeplatform.api.modules.notification.NotificationType;
import com.cakeplatform.api.modules.notification.SmsService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class DelayedPaymentConfirmationRegressionTest {

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
    private UserRepository userRepository;

    @Autowired
    private SubscriptionRepository subscriptionRepository;

    @Autowired
    private PaymentRepository paymentRepository;

    @Autowired
    private WebhookEventRepository webhookEventRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private AdminNotificationRepository adminNotificationRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private RazorpayService razorpayService;

    @MockBean
    private EmailService emailService;

    @MockBean
    private SmsService smsService;

    private Shop shop;
    private ShopDeliverySlot slot;
    private Product product;
    private User owner;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    public void setup() {
        Mockito.when(razorpayService.getWebhookSecret()).thenReturn("test_webhook_secret");
        Mockito.when(razorpayService.verifyWebhookSignature(Mockito.anyString(), Mockito.anyString())).thenReturn(true);
        Mockito.when(razorpayService.isConfigured()).thenReturn(true);

        owner = new User();
        owner.setEmail("owner_regression_" + UUID.randomUUID() + "@test.com");
        owner.setFullName("Regression Test Owner");
        owner.setMobile(String.valueOf(System.currentTimeMillis()).substring(3));
        owner.setPasswordHash("hashed_secret");
        owner.setRole(UserRole.SHOP_OWNER);
        owner = userRepository.save(owner);

        shop = new Shop();
        shop.setOwner(owner);
        shop.setBusinessName("Regression Bakery");
        shop.setStatus(ShopStatus.ACTIVE);
        shop = shopRepository.save(shop);

        Subscription sub = new Subscription();
        sub.setShop(shop);
        sub.setStatus(SubscriptionStatus.ACTIVE);
        sub.setExpiryDate(LocalDateTime.now().plusDays(30));
        sub.setAmount(BigDecimal.ZERO);
        subscriptionRepository.save(sub);

        slot = new ShopDeliverySlot();
        slot.setShop(shop);
        slot.setStartTime(LocalTime.of(14, 0));
        slot.setEndTime(LocalTime.of(16, 0));
        slot.setMaxOrders(1);
        slot.setIsActive(true);
        slot.setDayOfWeek("EVERYDAY");
        slot = deliverySlotRepository.save(slot);

        product = new Product();
        product.setShop(shop);
        product.setName("Delayed Confirmation Cake");
        product.setPrice(BigDecimal.valueOf(750));
        product.setAvailability(true);
        product.setStatus("ACTIVE");
        product = productRepository.save(product);
    }

    private Order createPendingOrder(int ageMinutes) {
        Order order = new Order();
        order.setOrderNumber("ORD-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        order.setShop(shop);
        order.setSubtotal(BigDecimal.valueOf(750));
        order.setOrderStatus("PAYMENT_PENDING");
        order.setPaymentStatus("PENDING");
        order.setPaymentMethod("ONLINE_PAYMENT");
        order.setCustomerName("Regression Buyer");
        order.setCustomerEmail("buyer@example.com");
        order.setCustomerPhone("9876543210");
        order.setDeliverySlot(slot);
        order.setDeliveryDate(LocalDate.now().plusDays(3));
        order.setTotalAmount(BigDecimal.valueOf(750));
        Order saved = orderRepository.save(order);

        jdbcTemplate.update("UPDATE orders SET created_at = ? WHERE id = ?",
                java.sql.Timestamp.valueOf(LocalDateTime.now().minusMinutes(ageMinutes)), saved.getId());
        return saved;
    }

    @Test
    @DisplayName("Regression 1: PAYMENT_PENDING order older than 15 minutes is NOT automatically cancelled")
    public void testPaymentPendingOrderOlderThan15MinutesIsNotAutomaticallyCancelled() {
        Order staleOrder = createPendingOrder(25);

        scheduler.processExpiredOrders();

        Order orderAfterScheduler = orderRepository.findById(staleOrder.getId()).orElseThrow();
        assertEquals("PAYMENT_PENDING", orderAfterScheduler.getOrderStatus(),
                "Order status must remain PAYMENT_PENDING to protect customer payment against delayed confirmation");
        assertEquals("PENDING", orderAfterScheduler.getPaymentStatus(),
                "Payment status must remain PENDING awaiting gateway confirmation");
    }

    @Test
    @DisplayName("Regression 2: Reserved delivery slot is NOT released solely due to elapsed time")
    public void testReservedDeliverySlotIsNotReleasedSolelyDueToElapsedTime() {
        GuestOrderRequest request1 = new GuestOrderRequest();
        request1.setCustomerName("First Customer");
        request1.setCustomerPhone("9123456780");
        request1.setDeliveryAddress("Flat 101, Test Road, Pune");
        request1.setDeliveryDate(LocalDate.now().plusDays(3));
        request1.setDeliverySlotId(slot.getId());
        request1.setPaymentMethod("ONLINE_PAYMENT");
        StorefrontOrderItem item = new StorefrontOrderItem();
        item.setProductId(product.getId());
        item.setQuantity(1);
        request1.setItems(List.of(item));

        Order order1 = customerStorefrontService.placeGuestOrder(shop.getId(), request1);
        assertNotNull(order1);
        assertEquals("PAYMENT_PENDING", order1.getOrderStatus());

        // Age the order past the 15-minute threshold
        jdbcTemplate.update("UPDATE orders SET created_at = ? WHERE id = ?",
                java.sql.Timestamp.valueOf(LocalDateTime.now().minusMinutes(35)), order1.getId());

        // Run scheduler
        scheduler.processExpiredOrders();

        // Order 1 is still PAYMENT_PENDING
        Order order1AfterScheduler = orderRepository.findById(order1.getId()).orElseThrow();
        assertEquals("PAYMENT_PENDING", order1AfterScheduler.getOrderStatus());

        // Attempt second order for same slot - must be rejected because slot capacity is retained
        GuestOrderRequest request2 = new GuestOrderRequest();
        request2.setCustomerName("Second Customer");
        request2.setCustomerPhone("9123456781");
        request2.setDeliveryAddress("Flat 102, Test Road, Pune");
        request2.setDeliveryDate(LocalDate.now().plusDays(3));
        request2.setDeliverySlotId(slot.getId());
        request2.setPaymentMethod("ONLINE_PAYMENT");
        request2.setItems(List.of(item));

        assertThrows(DeliverySlotFullException.class, () -> customerStorefrontService.placeGuestOrder(shop.getId(), request2),
                "Delivery slot capacity must not be released solely because order exceeded 15 minutes");
    }

    @Test
    @DisplayName("Regression 3: Valid delayed Razorpay success webhook updates order to CONFIRMED and PAID")
    public void testDelayedRazorpaySuccessWebhookUpdatesOrderCorrectly() throws Exception {
        Order staleOrder = createPendingOrder(45);
        String eventId = "evt_delayed_" + System.currentTimeMillis();
        String transactionId = "pay_delayed_" + System.currentTimeMillis();
        String rzpOrderId = "order_rzp_" + System.currentTimeMillis();

        Map<String, Object> payload = Map.of(
                "event", "payment.captured",
                "payload", Map.of(
                        "payment", Map.of(
                                "entity", Map.of(
                                        "id", transactionId,
                                        "order_id", rzpOrderId,
                                        "amount", 75000,
                                        "currency", "INR",
                                        "notes", Map.of("internal_order_number", staleOrder.getOrderNumber())
                                )
                        )
                )
        );
        String rawBody = objectMapper.writeValueAsString(payload);

        mockMvc.perform(post("/api/webhooks/razorpay")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Razorpay-Signature", "valid_test_signature")
                        .header("X-Razorpay-Event-Id", eventId)
                        .content(rawBody))
                .andExpect(status().isOk());

        Order confirmedOrder = orderRepository.findById(staleOrder.getId()).orElseThrow();
        assertEquals("CONFIRMED", confirmedOrder.getOrderStatus(), "Delayed payment must confirm the order");
        assertEquals("PAID", confirmedOrder.getPaymentStatus(), "Payment status must be updated to PAID");
        assertEquals(transactionId, confirmedOrder.getTransactionId());
        assertNotNull(confirmedOrder.getPaidAt());

        Payment payment = paymentRepository.findByProviderPaymentId(transactionId).orElse(null);
        assertNotNull(payment, "Payment record must be created for confirmed payment");
        assertEquals("COMPLETED", payment.getStatus());
    }

    @Test
    @DisplayName("Regression 4: Duplicate webhooks remain idempotent")
    public void testDuplicateWebhooksRemainIdempotent() throws Exception {
        Order order = createPendingOrder(10);
        String eventId = "evt_idem_" + System.currentTimeMillis();
        String transactionId = "pay_idem_" + System.currentTimeMillis();

        Map<String, Object> payload = Map.of(
                "event", "payment.captured",
                "payload", Map.of(
                        "payment", Map.of(
                                "entity", Map.of(
                                        "id", transactionId,
                                        "order_id", "order_idem_1",
                                        "amount", 75000,
                                        "currency", "INR",
                                        "notes", Map.of("internal_order_number", order.getOrderNumber())
                                )
                        )
                )
        );
        String rawBody = objectMapper.writeValueAsString(payload);

        // First webhook call
        mockMvc.perform(post("/api/webhooks/razorpay")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Razorpay-Signature", "valid_test_signature")
                        .header("X-Razorpay-Event-Id", eventId)
                        .content(rawBody))
                .andExpect(status().isOk());

        // Duplicate webhook call with identical event ID
        mockMvc.perform(post("/api/webhooks/razorpay")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Razorpay-Signature", "valid_test_signature")
                        .header("X-Razorpay-Event-Id", eventId)
                        .content(rawBody))
                .andExpect(status().isOk());

        // Subsequent call with different event ID for already paid order
        String newEventId = "evt_idem_second_" + System.currentTimeMillis();
        mockMvc.perform(post("/api/webhooks/razorpay")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Razorpay-Signature", "valid_test_signature")
                        .header("X-Razorpay-Event-Id", newEventId)
                        .content(rawBody))
                .andExpect(status().isOk());

        // Verify only 1 Payment record was created
        List<Payment> payments = paymentRepository.findAll().stream()
                .filter(p -> transactionId.equals(p.getProviderPaymentId()))
                .toList();
        assertEquals(1, payments.size(), "Idempotent handling must not create duplicate payment rows");
    }

    @Test
    @DisplayName("Regression 5: Manual cancellation by bakery owner safely releases delivery slot")
    public void testManualCancellationSafelyReleasesDeliverySlot() {
        GuestOrderRequest request1 = new GuestOrderRequest();
        request1.setCustomerName("Manual Test User");
        request1.setCustomerPhone("9123456782");
        request1.setDeliveryAddress("Flat 201, Test Road, Pune");
        request1.setDeliveryDate(LocalDate.now().plusDays(4));
        request1.setDeliverySlotId(slot.getId());
        request1.setPaymentMethod("ONLINE_PAYMENT");
        StorefrontOrderItem item = new StorefrontOrderItem();
        item.setProductId(product.getId());
        item.setQuantity(1);
        request1.setItems(List.of(item));

        Order order1 = customerStorefrontService.placeGuestOrder(shop.getId(), request1);
        assertNotNull(order1);

        // Owner manually cancels the unpaid order
        orderService.updateOrderStatus(owner.getId(), order1.getId(), "CANCELLED");

        Order cancelledOrder = orderRepository.findById(order1.getId()).orElseThrow();
        assertEquals("CANCELLED", cancelledOrder.getOrderStatus());

        // Another customer can now book the slot since owner legitimately cancelled
        GuestOrderRequest request2 = new GuestOrderRequest();
        request2.setCustomerName("Next Customer");
        request2.setCustomerPhone("9123456783");
        request2.setDeliveryAddress("Flat 202, Test Road, Pune");
        request2.setDeliveryDate(LocalDate.now().plusDays(4));
        request2.setDeliverySlotId(slot.getId());
        request2.setPaymentMethod("ONLINE_PAYMENT");
        request2.setItems(List.of(item));

        Order order2 = customerStorefrontService.placeGuestOrder(shop.getId(), request2);
        assertNotNull(order2);
        assertEquals("PAYMENT_PENDING", order2.getOrderStatus());
    }

    @Test
    @DisplayName("Regression 6: Captured payment for CANCELLED order via webhook does NOT reactivate it, preserves payment, flags reconciliation")
    public void testCapturedPaymentForCancelledOrderDoesNotReactivateViaWebhook() throws Exception {
        Order order = createPendingOrder(5);
        orderService.updateOrderStatus(owner.getId(), order.getId(), "CANCELLED");

        Order cancelledOrder = orderRepository.findById(order.getId()).orElseThrow();
        assertEquals("CANCELLED", cancelledOrder.getOrderStatus());

        String eventId = "evt_cancelled_recon_" + UUID.randomUUID();
        String transactionId = "pay_cancelled_recon_" + UUID.randomUUID();
        String rzpOrderId = "order_rzp_cancelled_" + UUID.randomUUID();

        Map<String, Object> payload = Map.of(
                "event", "payment.captured",
                "payload", Map.of(
                        "payment", Map.of(
                                "entity", Map.of(
                                        "id", transactionId,
                                        "order_id", rzpOrderId,
                                        "amount", 75000,
                                        "currency", "INR",
                                        "notes", Map.of("internal_order_number", cancelledOrder.getOrderNumber())
                                )
                        )
                )
        );
        String rawBody = objectMapper.writeValueAsString(payload);

        mockMvc.perform(post("/api/webhooks/razorpay")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Razorpay-Signature", "valid_test_signature")
                        .header("X-Razorpay-Event-Id", eventId)
                        .content(rawBody))
                .andExpect(status().isOk());

        Order reloadedOrder = orderRepository.findById(cancelledOrder.getId()).orElseThrow();
        // 1. MUST NOT reactivate to CONFIRMED
        assertEquals("CANCELLED", reloadedOrder.getOrderStatus(),
                "Cancelled order MUST NOT be reactivated blindly upon late payment capture");
        // 2. Financial record updated
        assertEquals("PAID", reloadedOrder.getPaymentStatus());
        assertEquals(transactionId, reloadedOrder.getTransactionId());
        assertNotNull(reloadedOrder.getPaidAt());

        // 3. Payment record exists and is marked COMPLETED
        Payment payment = paymentRepository.findByProviderPaymentId(transactionId).orElse(null);
        assertNotNull(payment, "Payment ledger record must be preserved for financial auditing");
        assertEquals("COMPLETED", payment.getStatus());
        assertEquals(cancelledOrder.getTotalAmount(), payment.getAmount());

        // 4. Bakery owner action-required alert dispatched
        List<Notification> ownerNotifs = notificationRepository.findAll().stream()
                .filter(n -> n.getRecipient() != null && n.getRecipient().getId().equals(owner.getId()))
                .filter(n -> n.getTitle() != null && n.getTitle().contains("Action Required"))
                .toList();
        assertFalse(ownerNotifs.isEmpty(), "Bakery owner must receive an Action Required notification for payment on cancelled order");

        // 5. Platform admin alert dispatched for reconciliation
        List<AdminNotification> adminNotifs = adminNotificationRepository.findAll().stream()
                .filter(an -> an.getTitle() != null && an.getTitle().contains("Payment on Cancelled Order"))
                .toList();
        assertFalse(adminNotifs.isEmpty(), "Platform admin must receive reconciliation alert for payment on cancelled order");

        // 6. Customer notified via email and SMS regarding review without falsely claiming a completed refund
        verify(emailService, atLeastOnce()).sendEmail(
                eq(cancelledOrder.getCustomerEmail()),
                contains("Review in Progress"),
                argThat(body -> body.contains("under review") && !body.contains("refund has been processed"))
        );
        verify(smsService, atLeastOnce()).sendSms(
                eq(cancelledOrder.getCustomerPhone()),
                argThat(body -> body.contains("reviewing fulfillment or refund"))
        );
    }

    @Test
    @DisplayName("Regression 7: Captured payment for CANCELLED order via client verification does NOT reactivate it")
    public void testCapturedPaymentForCancelledOrderDoesNotReactivateViaClientVerification() throws Exception {
        Order order = createPendingOrder(5);
        orderService.updateOrderStatus(owner.getId(), order.getId(), "CANCELLED");

        Order cancelledOrder = orderRepository.findById(order.getId()).orElseThrow();
        assertEquals("CANCELLED", cancelledOrder.getOrderStatus());

        String rzpOrderId = "order_rzp_client_recon_" + UUID.randomUUID();
        String transactionId = "pay_client_recon_" + UUID.randomUUID();

        cancelledOrder.setTransactionId(rzpOrderId);
        orderRepository.save(cancelledOrder);

        Payment pendingPayment = new Payment();
        pendingPayment.setShop(shop);
        pendingPayment.setAmount(cancelledOrder.getTotalAmount());
        pendingPayment.setCurrency("INR");
        pendingPayment.setProvider("RAZORPAY");
        pendingPayment.setProviderOrderId(rzpOrderId);
        pendingPayment.setStatus("PENDING");
        paymentRepository.save(pendingPayment);

        when(razorpayService.verifyPaymentSignature(eq(rzpOrderId), eq(transactionId), eq("sig_client_test")))
                .thenReturn(true);

        Map<String, String> payload = Map.of(
                "razorpayOrderId", rzpOrderId,
                "razorpayPaymentId", transactionId,
                "razorpaySignature", "sig_client_test"
        );

        mockMvc.perform(post("/api/storefront/orders/" + cancelledOrder.getOrderNumber() + "/verify-payment")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RECONCILIATION_REQUIRED"))
                .andExpect(jsonPath("$.orderNumber").value(cancelledOrder.getOrderNumber()));

        Order reloadedOrder = orderRepository.findById(cancelledOrder.getId()).orElseThrow();
        assertEquals("CANCELLED", reloadedOrder.getOrderStatus(),
                "Client payment verification MUST NOT reactivate a cancelled order");
        assertEquals("PAID", reloadedOrder.getPaymentStatus());

        Payment completedPayment = paymentRepository.findByProviderPaymentId(transactionId).orElse(null);
        assertNotNull(completedPayment);
        assertEquals("COMPLETED", completedPayment.getStatus());
    }

    @Test
    @DisplayName("Regression 8: Refunded orders remain protected against reactivation")
    public void testRefundedOrderCannotBeReactivated() throws Exception {
        Order order = createPendingOrder(5);
        order.setOrderStatus("CANCELLED");
        order.setPaymentStatus("REFUNDED");
        orderRepository.save(order);

        String eventId = "evt_refund_protect_" + UUID.randomUUID();
        String transactionId = "pay_refund_protect_" + UUID.randomUUID();
        String rzpOrderId = "order_rzp_refund_" + UUID.randomUUID();

        Map<String, Object> webhookPayload = Map.of(
                "event", "payment.captured",
                "payload", Map.of(
                        "payment", Map.of(
                                "entity", Map.of(
                                        "id", transactionId,
                                        "order_id", rzpOrderId,
                                        "amount", 75000,
                                        "currency", "INR",
                                        "notes", Map.of("internal_order_number", order.getOrderNumber())
                                )
                        )
                )
        );

        mockMvc.perform(post("/api/webhooks/razorpay")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Razorpay-Signature", "valid_test_signature")
                        .header("X-Razorpay-Event-Id", eventId)
                        .content(objectMapper.writeValueAsString(webhookPayload)))
                .andExpect(status().isOk());

        Order reloadedOrder = orderRepository.findById(order.getId()).orElseThrow();
        assertEquals("CANCELLED", reloadedOrder.getOrderStatus());
        assertEquals("REFUNDED", reloadedOrder.getPaymentStatus(),
                "Late payment webhook MUST NOT overwrite REFUNDED status");

        // Client verification rejection
        Map<String, String> clientPayload = Map.of(
                "razorpayOrderId", rzpOrderId,
                "razorpayPaymentId", transactionId,
                "razorpaySignature", "valid_sig"
        );

        mockMvc.perform(post("/api/storefront/orders/" + order.getOrderNumber() + "/verify-payment")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(clientPayload)))
                .andExpect(status().is4xxClientError());

        Order reloadedOrder2 = orderRepository.findById(order.getId()).orElseThrow();
        assertEquals("REFUNDED", reloadedOrder2.getPaymentStatus());
        assertEquals("CANCELLED", reloadedOrder2.getOrderStatus());
    }

    @Test
    @DisplayName("Regression 9: Concurrent webhook and client verification do not create duplicate payment rows")
    public void testConcurrentWebhookAndClientVerificationDoesNotCreateDuplicatePayments() throws Exception {
        Order order = createPendingOrder(5);
        String rzpOrderId = "order_rzp_concur_" + UUID.randomUUID();
        String transactionId = "pay_concur_" + UUID.randomUUID();

        order.setTransactionId(rzpOrderId);
        orderRepository.save(order);

        when(razorpayService.verifyPaymentSignature(eq(rzpOrderId), eq(transactionId), anyString()))
                .thenReturn(true);

        // Webhook payload
        Map<String, Object> webhookPayload = Map.of(
                "event", "payment.captured",
                "payload", Map.of(
                        "payment", Map.of(
                                "entity", Map.of(
                                        "id", transactionId,
                                        "order_id", rzpOrderId,
                                        "amount", 75000,
                                        "currency", "INR",
                                        "notes", Map.of("internal_order_number", order.getOrderNumber())
                                )
                        )
                )
        );
        String webhookJson = objectMapper.writeValueAsString(webhookPayload);

        // Client payload
        Map<String, String> clientPayload = Map.of(
                "razorpayOrderId", rzpOrderId,
                "razorpayPaymentId", transactionId,
                "razorpaySignature", "sig_concurrent_valid"
        );
        String clientJson = objectMapper.writeValueAsString(clientPayload);

        ExecutorService executor = Executors.newFixedThreadPool(2);
        CompletableFuture<Void> webhookFuture = CompletableFuture.runAsync(() -> {
            try {
                mockMvc.perform(post("/api/webhooks/razorpay")
                                .contentType(MediaType.APPLICATION_JSON)
                                .header("X-Razorpay-Signature", "valid_test_signature")
                                .header("X-Razorpay-Event-Id", "evt_concur_1_" + UUID.randomUUID())
                                .content(webhookJson))
                        .andExpect(status().isOk());
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }, executor);

        CompletableFuture<Void> clientFuture = CompletableFuture.runAsync(() -> {
            try {
                mockMvc.perform(post("/api/storefront/orders/" + order.getOrderNumber() + "/verify-payment")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(clientJson))
                        .andExpect(status().isOk());
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }, executor);

        CompletableFuture.allOf(webhookFuture, clientFuture).join();
        executor.shutdown();

        Order finalOrder = orderRepository.findById(order.getId()).orElseThrow();
        assertEquals("CONFIRMED", finalOrder.getOrderStatus());
        assertEquals("PAID", finalOrder.getPaymentStatus());

        List<Payment> payments = paymentRepository.findAll().stream()
                .filter(p -> transactionId.equals(p.getProviderPaymentId()))
                .toList();
        assertEquals(1, payments.size(),
                "Partial unique index and idempotent handling must guarantee exactly 1 Payment row under concurrency");
    }

    @Test
    @DisplayName("Regression 10: Duplicate webhook deliveries do not send duplicate alerts on cancelled orders")
    public void testDuplicateWebhookDeliveriesDoNotSendDuplicateAlertsOnCancelledOrders() throws Exception {
        Order order = createPendingOrder(5);
        orderService.updateOrderStatus(owner.getId(), order.getId(), "CANCELLED");

        String eventId = "evt_dup_cancelled_" + UUID.randomUUID();
        String transactionId = "pay_dup_cancelled_" + UUID.randomUUID();
        String rzpOrderId = "order_rzp_dup_c_" + UUID.randomUUID();

        Map<String, Object> payload = Map.of(
                "event", "payment.captured",
                "payload", Map.of(
                        "payment", Map.of(
                                "entity", Map.of(
                                        "id", transactionId,
                                        "order_id", rzpOrderId,
                                        "amount", 75000,
                                        "currency", "INR",
                                        "notes", Map.of("internal_order_number", order.getOrderNumber())
                                )
                        )
                )
        );
        String rawBody = objectMapper.writeValueAsString(payload);

        // First delivery
        mockMvc.perform(post("/api/webhooks/razorpay")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Razorpay-Signature", "valid_test_signature")
                        .header("X-Razorpay-Event-Id", eventId)
                        .content(rawBody))
                .andExpect(status().isOk());

        long ownerNotifCount1 = notificationRepository.findAll().stream()
                .filter(n -> n.getRecipient() != null && n.getRecipient().getId().equals(owner.getId()))
                .filter(n -> n.getTitle() != null && n.getTitle().contains("Action Required"))
                .count();
        assertEquals(1, ownerNotifCount1);

        // Duplicate delivery with same event ID
        mockMvc.perform(post("/api/webhooks/razorpay")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Razorpay-Signature", "valid_test_signature")
                        .header("X-Razorpay-Event-Id", eventId)
                        .content(rawBody))
                .andExpect(status().isOk());

        // Duplicate delivery with different event ID (order already marked PAID)
        mockMvc.perform(post("/api/webhooks/razorpay")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Razorpay-Signature", "valid_test_signature")
                        .header("X-Razorpay-Event-Id", "evt_dup_cancelled_second_" + UUID.randomUUID())
                        .content(rawBody))
                .andExpect(status().isOk());

        long ownerNotifCount2 = notificationRepository.findAll().stream()
                .filter(n -> n.getRecipient() != null && n.getRecipient().getId().equals(owner.getId()))
                .filter(n -> n.getTitle() != null && n.getTitle().contains("Action Required"))
                .count();
        assertEquals(1, ownerNotifCount2, "Duplicate webhook events must not generate duplicate alerts for bakery owners");
    }
}

