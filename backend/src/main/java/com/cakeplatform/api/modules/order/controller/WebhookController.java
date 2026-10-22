package com.cakeplatform.api.modules.order.controller;

import com.cakeplatform.api.modules.audit.ActivityLoggerService;
import com.cakeplatform.api.modules.notification.NotificationService;
import com.cakeplatform.api.modules.notification.NotificationType;
import com.cakeplatform.api.modules.order.Order;
import com.cakeplatform.api.modules.order.OrderRepository;
import com.cakeplatform.api.modules.payment.Payment;
import com.cakeplatform.api.modules.payment.PaymentRepository;
import com.cakeplatform.api.modules.payment.RazorpayService;
import com.cakeplatform.api.modules.shop.Shop;
import com.cakeplatform.api.modules.shop.ShopRepository;
import com.cakeplatform.api.modules.subscription.SubscriptionService;
import com.cakeplatform.api.modules.subscription.SubscriptionPlan;
import com.cakeplatform.api.modules.subscription.SubscriptionPlanRepository;
import com.cakeplatform.api.modules.payment.WebhookEvent;
import com.cakeplatform.api.modules.payment.WebhookEventRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;

@RestController
@RequestMapping("/api/webhooks")
@RequiredArgsConstructor
@Slf4j
public class WebhookController {

    private final OrderRepository orderRepository;
    private final PaymentRepository paymentRepository;
    private final SubscriptionService subscriptionService;
    private final ShopRepository shopRepository;
    private final RazorpayService razorpayService;
    private final NotificationService notificationService;
    private final SubscriptionPlanRepository subscriptionPlanRepository;
    private final com.cakeplatform.api.modules.notification.AdminNotificationService adminNotificationService;
    private final ActivityLoggerService activityLogger;
    private final WebhookEventRepository webhookEventRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.cakeplatform.api.modules.notification.EmailService emailService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.cakeplatform.api.modules.notification.SmsService smsService;

    public void setEmailService(com.cakeplatform.api.modules.notification.EmailService emailService) {
        this.emailService = emailService;
    }

    public void setSmsService(com.cakeplatform.api.modules.notification.SmsService smsService) {
        this.smsService = smsService;
    }

    /**
     * C2: Secure Razorpay Webhook Handler.
     * Computes HMAC-SHA256 signature against the exact unmodified raw request body.
     */
    @Transactional
    @PostMapping("/razorpay")
    public ResponseEntity<String> handleRazorpayWebhook(
            @RequestHeader(value = "X-Razorpay-Signature", required = false) String signature,
            @RequestHeader(value = "X-Razorpay-Event-Id", required = false) String eventIdHeader,
            @RequestBody String rawPayload) {

        // Validate webhook secret is not placeholder
        if (razorpayService.getWebhookSecret() == null || razorpayService.getWebhookSecret().isBlank() || razorpayService.getWebhookSecret().contains("placeholder")) {
            log.error("Webhook processing rejected: Webhook secret is not configured in production.");
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Webhook configuration error");
        }

        // 1. Validate signature presence
        if (signature == null || signature.trim().isEmpty()) {
            log.warn("Webhook rejected: missing X-Razorpay-Signature header");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Missing signature");
        }

        // 2. Validate HMAC-SHA256 signature against exact raw payload
        boolean isValid = razorpayService.verifyWebhookSignature(rawPayload, signature);
        if (!isValid) {
            log.warn("Webhook rejected: HMAC-SHA256 signature verification failed");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid webhook signature");
        }

        if (eventIdHeader == null || eventIdHeader.trim().isEmpty()) {
            log.warn("Webhook rejected: missing X-Razorpay-Event-Id header");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Missing event ID");
        }

        try {
            // 3. Parse JSON event
            Map<String, Object> payload = objectMapper.readValue(rawPayload, new TypeReference<Map<String, Object>>() {});
            String event = (String) payload.get("event");
            
            // Idempotency: check if event already processed
            if (webhookEventRepository.existsByEventId(eventIdHeader)) {
                log.info("Webhook idempotency: Event {} already processed. Skipping duplicate.", eventIdHeader);
                return ResponseEntity.ok("Webhook processed (idempotent duplicate)");
            }
            // Save event record atomically
            WebhookEvent webhookEvent = new WebhookEvent();
            webhookEvent.setEventId(eventIdHeader);
            webhookEvent.setEventType(event);
            webhookEventRepository.saveAndFlush(webhookEvent);

            @SuppressWarnings("unchecked")
            Map<String, Object> payloadData = (Map<String, Object>) payload.get("payload");

            if (payloadData == null) {
                log.warn("Webhook payloadData is null for event: {}", event);
                return ResponseEntity.ok("Webhook ignored (no payload data)");
            }

            @SuppressWarnings("unchecked")
            Map<String, Object> paymentWrapper = (Map<String, Object>) payloadData.get("payment");
            if (paymentWrapper == null) {
                log.info("Webhook event {} does not contain payment entity, returning 200 OK", event);
                return ResponseEntity.ok("Webhook acknowledged");
            }

            @SuppressWarnings("unchecked")
            Map<String, Object> entity = (Map<String, Object>) paymentWrapper.get("entity");
            if (entity == null) {
                return ResponseEntity.ok("Webhook acknowledged (no entity)");
            }

            String transactionId = (String) entity.get("id");
            String razorpayOrderId = (String) entity.get("order_id");
            @SuppressWarnings("unchecked")
            Map<String, Object> notes = (Map<String, Object>) entity.get("notes");

            // =========================================================================
            // Event: payment.captured
            // =========================================================================
            if ("payment.captured".equals(event)) {
                log.info("Processing webhook payment.captured: txId={}, orderId={}", transactionId, razorpayOrderId);

                // Case A: Customer Order Payment
                String orderNumber = null;
                if (notes != null) {
                    if (notes.containsKey("internal_order_number")) {
                        orderNumber = String.valueOf(notes.get("internal_order_number"));
                    } else if (notes.containsKey("order_number")) {
                        orderNumber = String.valueOf(notes.get("order_number"));
                    }
                }

                if (orderNumber != null) {
                    final String finalOrderNumber = orderNumber;
                    Order order = orderRepository.findByOrderNumberWithLock(finalOrderNumber)
                            .or(() -> orderRepository.findByOrderNumber(finalOrderNumber))
                            .orElse(null);
                    if (order != null) {
                        // Idempotency check: if order is already PAID, do nothing
                        if ("PAID".equalsIgnoreCase(order.getPaymentStatus())) {
                            log.info("Webhook idempotency: Order {} is already marked PAID. Skipping duplicate update.", orderNumber);
                            return ResponseEntity.ok("Webhook processed (idempotent, order already paid)");
                        }

                        // Safeguard: Do not reactivate or process an order that has already been explicitly REFUNDED
                        if ("REFUNDED".equalsIgnoreCase(order.getPaymentStatus())) {
                            log.warn("Webhook ignored: Order {} is already marked REFUNDED.", orderNumber);
                            return ResponseEntity.ok("Webhook processed (ignored, order refunded)");
                        }

                        boolean wasCancelled = "CANCELLED".equalsIgnoreCase(order.getOrderStatus());

                        order.setPaymentStatus("PAID");
                        order.setTransactionId(transactionId);
                        order.setPaidAt(LocalDateTime.now());

                        if (!wasCancelled) {
                            if ("NEW".equalsIgnoreCase(order.getOrderStatus()) 
                                    || "PENDING".equalsIgnoreCase(order.getOrderStatus()) 
                                    || "PAYMENT_PENDING".equalsIgnoreCase(order.getOrderStatus())) {
                                order.setOrderStatus("CONFIRMED");
                            }
                        } else {
                            // Retain CANCELLED status! Never automatically change to CONFIRMED.
                            log.warn("Payment captured for previously CANCELLED order {}. Retaining CANCELLED status to prevent slot overbooking. Flagged for owner/admin reconciliation.", order.getOrderNumber());
                        }
                        orderRepository.save(order);

                        // Save Payment record idempotently with unique constraint race protection
                        savePaymentRecordIdempotent(order, transactionId, razorpayOrderId);

                        if (!wasCancelled) {
                            // Normal active order confirmed: Notify bakery owner
                            if (order.getShop() != null && order.getShop().getOwner() != null && notificationService != null) {
                                notificationService.createNotification(
                                        order.getShop().getOwner(),
                                        NotificationType.NEW_ORDER,
                                        "Payment Confirmed (Webhook)",
                                        String.format("Payment for Order %s (₹%s) was confirmed via Razorpay webhook.",
                                                order.getOrderNumber(), order.getTotalAmount()),
                                        order.getId().toString(),
                                        true
                                );
                            }
                            activityLogger.logActivity(null, order.getShop().getId(), "PAYMENT_CAPTURED_WEBHOOK", "ORDER", order.getId(), "Tx: " + transactionId);
                            return ResponseEntity.ok("Webhook processed (order confirmed)");
                        } else {
                            // Cancelled order payment: Notify owner, admin, customer, and log activity
                            handlePaymentOnCancelledOrder(order, transactionId);
                            return ResponseEntity.ok("Webhook processed (payment recorded on cancelled order, flagged for reconciliation)");
                        }
                    }
                }

                // Case B: Owner Subscription Payment
                String shopIdStr = null;
                if (notes != null) {
                    if (notes.containsKey("subscription_shop_id")) {
                        shopIdStr = String.valueOf(notes.get("subscription_shop_id"));
                    } else if (notes.containsKey("shop_id")) {
                        shopIdStr = String.valueOf(notes.get("shop_id"));
                    }
                }

                if (shopIdStr != null) {
                    try {
                        Long shopId = Long.parseLong(shopIdStr);
                        Shop shop = shopRepository.findById(shopId).orElse(null);

                        if (shop != null && shop.getOwner() != null) {
                            Payment paymentToUpdate = paymentRepository.findByProviderOrderId(razorpayOrderId)
                                    .orElse(null);
                            
                            if (paymentToUpdate == null) {
                                log.warn("Webhook rejected: PENDING Payment not found for razorpayOrderId={}", razorpayOrderId);
                                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Missing local payment");
                            }

                            if (!shopId.equals(paymentToUpdate.getShop().getId())) {
                                log.warn("Webhook rejected: Shop mismatch");
                                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Shop mismatch");
                            }

                            SubscriptionPlan plan = paymentToUpdate.getPlan();
                            if (plan == null) {
                                log.warn("Webhook rejected: Missing plan on local Payment");
                                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Missing plan");
                            }

                            // Validate Plan ID from notes if present
                            if (notes != null && notes.containsKey("plan_id")) {
                                Long notePlanId = Long.parseLong(String.valueOf(notes.get("plan_id")));
                                if (!notePlanId.equals(plan.getId())) {
                                    log.warn("Webhook rejected: Plan ID in notes does not match local Payment plan");
                                    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Plan mismatch");
                                }
                            }

                            // Validate Amount
                            Object amountObj = entity.get("amount");
                            long capturedAmountPaise = amountObj instanceof Number ? ((Number) amountObj).longValue() : Long.parseLong(String.valueOf(amountObj));
                            long expectedAmountPaise = paymentToUpdate.getAmount().multiply(BigDecimal.valueOf(100)).longValue();
                            if (capturedAmountPaise != expectedAmountPaise) {
                                log.warn("Webhook rejected: Amount mismatch. Expected {}, got {}", expectedAmountPaise, capturedAmountPaise);
                                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Amount mismatch");
                            }

                            // Validate Currency
                            String capturedCurrency = (String) entity.get("currency");
                            if (!paymentToUpdate.getCurrency().equalsIgnoreCase(capturedCurrency)) {
                                log.warn("Webhook rejected: Currency mismatch. Expected {}, got {}", paymentToUpdate.getCurrency(), capturedCurrency);
                                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Currency mismatch");
                            }

                            if ("COMPLETED".equalsIgnoreCase(paymentToUpdate.getStatus())) {
                                log.info("Webhook idempotency: Payment {} already COMPLETED. Skipping duplicate.", paymentToUpdate.getId());
                                return ResponseEntity.ok("Webhook processed (idempotent, payment already completed)");
                            }

                            subscriptionService.processSuccessfulPayment(
                                    shop.getOwner().getId(),
                                    plan,
                                    razorpayOrderId,
                                    transactionId,
                                    paymentToUpdate
                            );

                            return ResponseEntity.ok("Webhook processed (subscription activated)");
                        }
                    } catch (NumberFormatException e) {
                        log.warn("Invalid shop_id in subscription webhook notes: {}", shopIdStr);
                    }
                }
            }

            // =========================================================================
            // Event: payment.failed
            // =========================================================================
            if ("payment.failed".equals(event)) {
                String errorDescription = "Payment failed at gateway";
                Object rawError = entity.get("error_description");
                if (rawError != null) {
                    errorDescription = String.valueOf(rawError);
                } else if (entity.containsKey("error")) {
                    errorDescription = String.valueOf(entity.get("error"));
                }

                // If customer order, keep order as PENDING/NEW but record failure in activity log
                if (notes != null && notes.containsKey("internal_order_number")) {
                    String orderNumber = String.valueOf(notes.get("internal_order_number"));
                    Order order = orderRepository.findByOrderNumber(orderNumber).orElse(null);
                    if (order != null) {
                        activityLogger.logActivity(null, order.getShop().getId(), "PAYMENT_FAILED_WEBHOOK", "ORDER", order.getId(), errorDescription);
                    }
                } else if (notes != null && (notes.containsKey("subscription_shop_id") || notes.containsKey("shop_id"))) {
                    // Subscription payment failed
                    if (razorpayOrderId != null) {
                        Payment paymentToFail = paymentRepository.findByProviderOrderId(razorpayOrderId).orElse(null);
                        if (paymentToFail != null && "PENDING".equalsIgnoreCase(paymentToFail.getStatus())) {
                            paymentToFail.setStatus("FAILED");
                            paymentToFail.setFailureReason(errorDescription);
                            paymentToFail.setProviderPaymentId(transactionId);
                            paymentRepository.save(paymentToFail);
                            log.info("Subscription payment marked as FAILED for order {}", razorpayOrderId);
                        }
                    }
                }

                // Dispatch Admin Notification (PAYMENT_FAILED)
                try {
                    adminNotificationService.dispatchAdminNotification(
                            com.cakeplatform.api.modules.notification.AdminNotificationType.PAYMENT_FAILED,
                            "Payment Failed",
                            String.format("Payment failure reported for transaction %s. Error: %s",
                                    transactionId != null ? transactionId : "N/A", errorDescription),
                            com.cakeplatform.api.modules.notification.AdminNotificationPriority.HIGH,
                            com.cakeplatform.api.modules.notification.AdminNotificationCategory.PAYMENTS,
                            transactionId != null ? transactionId : "TX-" + System.currentTimeMillis(),
                            "PAYMENT",
                            "/admin/shops"
                    );
                } catch (Exception ignored) {}
            }

            return ResponseEntity.ok("Webhook processed");
        } catch (Exception e) {
            log.error("Error processing Razorpay webhook: {}", e.getMessage(), e);
            try {
                org.springframework.transaction.interceptor.TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
            } catch (org.springframework.transaction.NoTransactionException ignored) {}
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Webhook processing error");
        }
    }

    private Payment savePaymentRecordIdempotent(Order order, String transactionId, String razorpayOrderId) {
        Payment payment = paymentRepository.findByProviderPaymentId(transactionId)
                .or(() -> paymentRepository.findByProviderOrderId(razorpayOrderId))
                .orElseGet(Payment::new);
        payment.setShop(order.getShop());
        payment.setAmount(order.getTotalAmount());
        payment.setCurrency("INR");
        payment.setProvider("RAZORPAY");
        payment.setProviderOrderId(razorpayOrderId);
        payment.setProviderPaymentId(transactionId);
        payment.setStatus("COMPLETED");
        payment.setPaidAt(LocalDateTime.now());
        payment.setFailureReason("ORDER:" + order.getOrderNumber());
        try {
            Payment saved = paymentRepository.save(payment);
            return saved != null ? saved : payment;
        } catch (org.springframework.dao.DataIntegrityViolationException ex) {
            log.info("Concurrent payment insert detected for txId {}. Retrieving existing record.", transactionId);
            return paymentRepository.findByProviderPaymentId(transactionId)
                    .orElse(payment);
        }
    }

    private void handlePaymentOnCancelledOrder(Order order, String transactionId) {
        // 1. Owner action-required alert
        if (order.getShop() != null && order.getShop().getOwner() != null && notificationService != null) {
            notificationService.createNotification(
                    order.getShop().getOwner(),
                    NotificationType.PAYMENT_SUCCESS,
                    "Action Required: Payment Received on Cancelled Order",
                    String.format("Payment of ₹%s received for cancelled Order %s (Tx: %s). Delivery slot was not preserved. Please review order in your dashboard to fulfill or refund.",
                            order.getTotalAmount(), order.getOrderNumber(), transactionId),
                    order.getId().toString(),
                    true
            );
        }

        // 2. Admin action-required alert
        if (adminNotificationService != null) {
            try {
                adminNotificationService.dispatchAdminNotification(
                        com.cakeplatform.api.modules.notification.AdminNotificationType.PAYMENT_RECEIVED,
                        "Payment on Cancelled Order",
                        String.format("Payment of ₹%s received for CANCELLED order %s (Shop: %s, Tx: %s). Requires reconciliation or refund.",
                                order.getTotalAmount(), order.getOrderNumber(),
                                order.getShop() != null ? order.getShop().getBusinessName() : "N/A",
                                transactionId),
                        com.cakeplatform.api.modules.notification.AdminNotificationPriority.HIGH,
                        com.cakeplatform.api.modules.notification.AdminNotificationCategory.PAYMENTS,
                        "RECON_ORD_" + order.getOrderNumber(),
                        "ORDER",
                        "/admin/orders"
                );
            } catch (Exception ignored) {}
        }

        // 3. Customer notification (email and SMS): Inform that payment was received for cancelled order and is in review. DO NOT claim refund.
        notifyCustomerPaymentOnCancelledOrder(order, transactionId);

        // 4. Activity log
        if (activityLogger != null) {
            activityLogger.logActivity(null, order.getShop() != null ? order.getShop().getId() : null,
                    "PAYMENT_CAPTURED_CANCELLED_ORDER", "ORDER", order.getId(),
                    "Tx: " + transactionId + " - Payment recorded on cancelled order; flagged for reconciliation");
        }
    }

    private void notifyCustomerPaymentOnCancelledOrder(Order order, String transactionId) {
        try {
            String shopName = (order.getShop() != null && order.getShop().getBusinessName() != null)
                    ? order.getShop().getBusinessName()
                    : "CakeStore Bakery";
            String customerName = order.getCustomerName() != null ? order.getCustomerName() : "Customer";
            String subject = String.format("Payment Received for Cancelled Order #%s - Review in Progress", order.getOrderNumber());
            String body = String.format(
                    "Hello %s,\n\n" +
                    "We have received your payment of ₹%s (Transaction ID: %s) for order #%s at %s.\n\n" +
                    "Please note: Your checkout session had previously been cancelled, so this order is currently under review by the bakery. " +
                    "The bakery will review whether fulfillment is possible or if a refund will be processed.\n\n" +
                    "For assistance or inquiries, please contact %s directly.\n\n" +
                    "Thank you for your patience!",
                    customerName, order.getTotalAmount(), transactionId, order.getOrderNumber(), shopName, shopName
            );

            if (emailService != null && order.getCustomerEmail() != null && !order.getCustomerEmail().isBlank()) {
                emailService.sendEmail(order.getCustomerEmail(), subject, body);
            }

            if (smsService != null && order.getCustomerPhone() != null && !order.getCustomerPhone().isBlank()) {
                String smsBody = String.format("Payment of ₹%s received for cancelled order #%s at %s. The bakery is reviewing fulfillment or refund options.",
                        order.getTotalAmount(), order.getOrderNumber(), shopName);
                smsService.sendSms(order.getCustomerPhone(), smsBody);
            }
        } catch (Exception e) {
            log.warn("Non-blocking notification error for cancelled order {}: {}", order.getOrderNumber(), e.getMessage());
        }
    }
}

