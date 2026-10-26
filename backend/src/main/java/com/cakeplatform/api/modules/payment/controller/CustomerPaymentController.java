package com.cakeplatform.api.modules.payment.controller;

import com.cakeplatform.api.modules.notification.NotificationService;
import com.cakeplatform.api.modules.notification.NotificationType;
import com.cakeplatform.api.modules.order.Order;
import com.cakeplatform.api.modules.order.OrderRepository;
import com.cakeplatform.api.modules.payment.Payment;
import com.cakeplatform.api.modules.payment.PaymentRepository;
import com.cakeplatform.api.modules.payment.RazorpayService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/storefront/orders")
@Slf4j
public class CustomerPaymentController {

    private final OrderRepository orderRepository;
    private final PaymentRepository paymentRepository;
    private final RazorpayService razorpayService;
    private final NotificationService notificationService;
    private final com.cakeplatform.api.modules.notification.AdminNotificationService adminNotificationService;
    private final com.cakeplatform.api.modules.shop.CouponRepository couponRepository;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.cakeplatform.api.modules.notification.EmailService emailService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.cakeplatform.api.modules.notification.SmsService smsService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.cakeplatform.api.modules.audit.ActivityLoggerService activityLogger;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.cakeplatform.api.security.JwtService jwtService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.cakeplatform.api.modules.user.UserRepository userRepository;

    public void setEmailService(com.cakeplatform.api.modules.notification.EmailService emailService) {
        this.emailService = emailService;
    }

    public void setSmsService(com.cakeplatform.api.modules.notification.SmsService smsService) {
        this.smsService = smsService;
    }

    public void setActivityLogger(com.cakeplatform.api.modules.audit.ActivityLoggerService activityLogger) {
        this.activityLogger = activityLogger;
    }

    public void setJwtService(com.cakeplatform.api.security.JwtService jwtService) {
        this.jwtService = jwtService;
    }

    public void setUserRepository(com.cakeplatform.api.modules.user.UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @org.springframework.beans.factory.annotation.Autowired
    public CustomerPaymentController(
            OrderRepository orderRepository,
            PaymentRepository paymentRepository,
            RazorpayService razorpayService,
            NotificationService notificationService,
            com.cakeplatform.api.modules.notification.AdminNotificationService adminNotificationService,
            @org.springframework.beans.factory.annotation.Autowired(required = false) com.cakeplatform.api.modules.shop.CouponRepository couponRepository) {
        this.orderRepository = orderRepository;
        this.paymentRepository = paymentRepository;
        this.razorpayService = razorpayService;
        this.notificationService = notificationService;
        this.adminNotificationService = adminNotificationService;
        this.couponRepository = couponRepository;
    }

    public CustomerPaymentController(
            OrderRepository orderRepository,
            PaymentRepository paymentRepository,
            RazorpayService razorpayService,
            NotificationService notificationService,
            com.cakeplatform.api.modules.notification.AdminNotificationService adminNotificationService) {
        this(orderRepository, paymentRepository, razorpayService, notificationService, adminNotificationService, null);
    }

    /**
     * C1: Create / initialize a real Razorpay payment order for a customer order.
     * The payable amount is strictly authoritative from the server-side Order entity.
     */
    @PostMapping("/{orderNumber}/create-payment-order")
    public ResponseEntity<Map<String, Object>> createCustomerPaymentOrder(
            @PathVariable String orderNumber) {
        Order order = orderRepository.findByOrderNumber(orderNumber)
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderNumber));

        if ("CANCELLED".equalsIgnoreCase(order.getOrderStatus())) {
            throw new IllegalStateException("Cannot initiate payment for a cancelled order");
        }
        if ("PAID".equalsIgnoreCase(order.getPaymentStatus())) {
            throw new IllegalStateException("Order is already paid");
        }

        BigDecimal authoritativeAmount = order.getTotalAmount();
        long amountPaise = authoritativeAmount.multiply(BigDecimal.valueOf(100))
                .setScale(0, java.math.RoundingMode.UNNECESSARY).longValueExact();

        // Check if an existing PENDING payment order can be reused to avoid duplicates on repeated initiation
        String razorpayOrderId = null;
        Payment payment = null;
        if (order.getTransactionId() != null && order.getTransactionId().startsWith("order_")) {
            payment = paymentRepository.findByProviderOrderId(order.getTransactionId()).orElse(null);
            if (payment != null && "PENDING".equalsIgnoreCase(payment.getStatus())) {
                razorpayOrderId = payment.getProviderOrderId();
            }
        }

        if (razorpayOrderId == null) {
            String receiptId = "rcpt_" + order.getOrderNumber();
            Long shopId = order.getShop() != null ? order.getShop().getId() : null;
            razorpayOrderId = razorpayService.createCustomerOrder(authoritativeAmount, order.getOrderNumber(), shopId, receiptId);

            if (payment == null) {
                payment = new Payment();
                payment.setShop(order.getShop());
                payment.setAmount(authoritativeAmount);
                payment.setCurrency("INR");
                payment.setProvider("RAZORPAY");
                payment.setStatus("PENDING");
            }
            payment.setProviderOrderId(razorpayOrderId);
            payment.setFailureReason("ORDER:" + order.getOrderNumber());
            paymentRepository.save(payment);

            order.setPaymentMethod("RAZORPAY");
            order.setTransactionId(razorpayOrderId);
            orderRepository.save(order);
        }

        Map<String, Object> responseMap = new java.util.HashMap<>();
        responseMap.put("orderNumber", order.getOrderNumber());
        responseMap.put("razorpayOrderId", razorpayOrderId);
        responseMap.put("amount", authoritativeAmount);
        responseMap.put("amountPaise", amountPaise);
        responseMap.put("currency", "INR");
        responseMap.put("keyId", razorpayService.getKeyId() != null ? razorpayService.getKeyId() : "");
        responseMap.put("shopName", order.getShop() != null ? order.getShop().getBusinessName() : "CakeStore");
        responseMap.put("customerName", order.getCustomerName() != null ? order.getCustomerName() : "");
        responseMap.put("customerEmail", order.getCustomerEmail() != null ? order.getCustomerEmail() : "");
        responseMap.put("customerPhone", order.getCustomerPhone() != null ? order.getCustomerPhone() : "");
        if (jwtService != null) {
            responseMap.put("checkoutToken", jwtService.generateCheckoutToken(order.getOrderNumber(), order.getCustomerPhone()));
        }
        return ResponseEntity.ok(responseMap);
    }

    /**
     * C1: Verify payment signature for customer order and update state idempotently.
     * Wrapped in a transaction boundary with pessimistic row locking to prevent race conditions.
     */
    @Transactional
    @PostMapping("/{orderNumber}/verify-payment")
    public ResponseEntity<Map<String, Object>> verifyCustomerPayment(
            @PathVariable String orderNumber,
            @RequestBody Map<String, String> payload) {
        Order order = orderRepository.findByOrderNumberWithLock(orderNumber)
                .or(() -> orderRepository.findByOrderNumber(orderNumber))
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderNumber));

        if ("REFUNDED".equalsIgnoreCase(order.getPaymentStatus())) {
            throw new IllegalStateException("Cannot verify payment for a refunded order");
        }

        String razorpayOrderId = payload.get("razorpayOrderId");
        String razorpayPaymentId = payload.get("razorpayPaymentId");
        String razorpaySignature = payload.get("razorpaySignature");

        if (razorpayOrderId == null || razorpayOrderId.isBlank()
                || razorpayPaymentId == null || razorpayPaymentId.isBlank()
                || razorpaySignature == null || razorpaySignature.isBlank()) {
            throw new IllegalArgumentException("Missing required payment verification parameters");
        }

        // Verify Razorpay order ID belongs to this local order/payment
        if (order.getTransactionId() != null 
                && !order.getTransactionId().equals(razorpayOrderId) 
                && !order.getTransactionId().equals(razorpayPaymentId) 
                && !"PAID".equalsIgnoreCase(order.getPaymentStatus())) {
            log.warn("Razorpay order ID mismatch for order {}. Expected {}, got {}", 
                    orderNumber, order.getTransactionId(), razorpayOrderId);
            throw new IllegalArgumentException("Payment verification failed. Razorpay order ID does not match local order.");
        }

        boolean wasCancelled = "CANCELLED".equalsIgnoreCase(order.getOrderStatus());

        // Idempotency: if already PAID, return success or reconciliation status without duplicate actions
        if ("PAID".equalsIgnoreCase(order.getPaymentStatus())) {
            Payment existingPayment = paymentRepository.findByProviderPaymentId(razorpayPaymentId)
                    .or(() -> paymentRepository.findByProviderOrderId(razorpayOrderId))
                    .orElse(null);
            return ResponseEntity.ok(Map.of(
                    "status", wasCancelled ? "RECONCILIATION_REQUIRED" : "SUCCESS",
                    "message", wasCancelled ? "Payment verified on cancelled order; bakery review required" : "Order already verified and paid",
                    "orderNumber", order.getOrderNumber(),
                    "paymentId", existingPayment != null ? existingPayment.getId() : 0L
            ));
        }

        // Signature check and authoritative order verification when credentials are configured
        if (razorpayService.isConfigured()) {
            boolean valid = razorpayService.verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
            if (!valid) {
                log.warn("Payment verification failed for customer order {}", orderNumber);
                Payment failedPayment = paymentRepository.findByProviderOrderId(razorpayOrderId).orElse(null);
                if (failedPayment != null && "PENDING".equalsIgnoreCase(failedPayment.getStatus())) {
                    failedPayment.setStatus("FAILED");
                    failedPayment.setFailureReason("Invalid signature");
                    paymentRepository.save(failedPayment);
                }
                throw new IllegalArgumentException("Payment verification failed. Invalid signature.");
            }
            // Double check that Razorpay recorded the expected amount and currency
            razorpayService.verifyOrderDetails(razorpayOrderId, order.getTotalAmount(), "INR");
        }

        // Update Order
        order.setPaymentStatus("PAID");
        order.setPaymentMethod("RAZORPAY");
        order.setTransactionId(razorpayPaymentId);
        order.setPaidAt(LocalDateTime.now());
        if (!wasCancelled) {
            if ("NEW".equalsIgnoreCase(order.getOrderStatus()) 
                    || "PENDING".equalsIgnoreCase(order.getOrderStatus()) 
                    || "PAYMENT_PENDING".equalsIgnoreCase(order.getOrderStatus())) {
                order.setOrderStatus("CONFIRMED");
            }
        } else {
            // Retain CANCELLED status! Never automatically change to CONFIRMED.
            log.warn("Payment verified for previously CANCELLED order {}. Retaining CANCELLED status to prevent slot overbooking. Flagged for reconciliation.", order.getOrderNumber());
        }
        orderRepository.save(order);

        // Record / Update Payment idempotently with unique index race protection
        Payment payment = savePaymentRecordIdempotent(order, razorpayPaymentId, razorpayOrderId);

        if (!wasCancelled) {
            // Dispatch Notification to Bakery Owner
            if (order.getShop() != null && order.getShop().getOwner() != null && notificationService != null) {
                notificationService.createNotification(
                        order.getShop().getOwner(),
                        NotificationType.NEW_ORDER,
                        "Payment Received (Razorpay)",
                        String.format("Payment of ₹%s for Order %s has been confirmed.", order.getTotalAmount(), order.getOrderNumber()),
                        order.getId().toString(),
                        true
                );
            }
            if (activityLogger != null && order.getShop() != null) {
                activityLogger.logActivity(null, order.getShop().getId(), "PAYMENT_VERIFIED_CLIENT", "ORDER", order.getId(), "Tx: " + razorpayPaymentId);
            }
            return ResponseEntity.ok(Map.of(
                    "status", "SUCCESS",
                    "message", "Payment verified and order confirmed",
                    "orderNumber", order.getOrderNumber(),
                    "paymentId", payment.getId() != null ? payment.getId() : 0L
            ));
        } else {
            // Cancelled order payment: Notify owner, admin, customer, and log activity
            handlePaymentOnCancelledOrder(order, razorpayPaymentId);
            return ResponseEntity.ok(Map.of(
                    "status", "RECONCILIATION_REQUIRED",
                    "message", "Payment verified for cancelled order. Delivery slot was not preserved; bakery review required.",
                    "orderNumber", order.getOrderNumber(),
                    "paymentId", payment.getId() != null ? payment.getId() : 0L
            ));
        }
    }

    /**
     * Cancel an uncompleted customer payment checkout and mark order as cancelled.
     * Prevents abandoned or customer-cancelled checkouts from showing up as pending orders.
     */
    @PostMapping("/{orderNumber}/cancel-payment")
    @Transactional
    public ResponseEntity<Map<String, Object>> cancelCustomerPayment(
            @PathVariable String orderNumber,
            @RequestHeader(value = "X-Checkout-Token", required = false) String checkoutTokenHeader,
            @RequestBody(required = false) Map<String, String> payload) {
        Order order = orderRepository.findByOrderNumberWithLock(orderNumber)
                .or(() -> orderRepository.findByOrderNumber(orderNumber))
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderNumber));

        // Enforce server-side ownership authorization
        validateCancellationAuthorization(order, checkoutTokenHeader, payload);

        if ("PAID".equalsIgnoreCase(order.getPaymentStatus())) {
            throw new IllegalStateException("Cannot cancel payment for an already paid order");
        }

        // Idempotency: if already cancelled, return success immediately
        if ("CANCELLED".equalsIgnoreCase(order.getOrderStatus()) && "FAILED".equalsIgnoreCase(order.getPaymentStatus())) {
            return ResponseEntity.ok(Map.of(
                    "status", "CANCELLED",
                    "message", "Payment already cancelled",
                    "orderNumber", order.getOrderNumber()
            ));
        }

        String reason = (payload != null && payload.get("reason") != null && !payload.get("reason").isBlank())
                ? payload.get("reason")
                : "Payment cancelled by customer during checkout";

        order.setOrderStatus("CANCELLED");
        order.setPaymentStatus("FAILED");
        orderRepository.save(order);

        // Update payment record if present
        if (order.getTransactionId() != null) {
            Payment payment = paymentRepository.findByProviderOrderId(order.getTransactionId()).orElse(null);
            if (payment != null && !"COMPLETED".equalsIgnoreCase(payment.getStatus())) {
                payment.setStatus("FAILED");
                payment.setFailureReason(reason);
                paymentRepository.save(payment);
            }
        }

        // Restore coupon usage if a coupon was used
        if (order.getCouponCode() != null && !order.getCouponCode().isBlank() && order.getShop() != null && couponRepository != null) {
            try {
                couponRepository.findByShopIdAndCodeIgnoreCase(order.getShop().getId(), order.getCouponCode())
                        .ifPresent(c -> couponRepository.decrementUsedCount(c.getId()));
            } catch (Exception e) {
                log.warn("Failed to decrement coupon usage on payment cancellation for order {}: {}", orderNumber, e.getMessage());
            }
        }

        log.info("Payment cancelled for customer order {}: {}", orderNumber, reason);

        return ResponseEntity.ok(Map.of(
                "status", "CANCELLED",
                "message", "Payment process was cancelled. Order has not been placed.",
                "orderNumber", order.getOrderNumber()
        ));
    }

    private void validateCancellationAuthorization(Order order, String checkoutTokenHeader, Map<String, String> payload) {
        org.springframework.security.core.Authentication auth =
                org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();

        boolean isAuthenticated = auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal());

        if (isAuthenticated) {
            // Check if caller is platform admin
            boolean isAdmin = auth.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
            if (isAdmin) {
                return;
            }

            // Check if caller is the shop owner of this shop
            boolean isShopOwner = auth.getAuthorities().stream().anyMatch(a -> "ROLE_SHOP_OWNER".equals(a.getAuthority()));
            if (isShopOwner && order.getShop() != null && order.getShop().getOwner() != null) {
                String ownerEmail = order.getShop().getOwner().getEmail();
                if (ownerEmail != null && ownerEmail.equalsIgnoreCase(auth.getName())) {
                    return;
                }
            }

            // Authenticated Customer: Resolve phone strictly server-side from security context
            String callerPhone = null;
            if (auth.getPrincipal() instanceof com.cakeplatform.api.security.CustomUserDetails cud && cud.getUser() != null) {
                callerPhone = cud.getUser().getMobile();
            }
            if ((callerPhone == null || callerPhone.isBlank()) && userRepository != null) {
                String identifier = auth.getName();
                com.cakeplatform.api.modules.user.User user = userRepository.findByEmailIgnoreCase(identifier)
                        .orElseGet(() -> userRepository.findByMobile(identifier).orElse(null));
                if (user != null) {
                    callerPhone = user.getMobile();
                }
            }
            if (callerPhone == null || callerPhone.isBlank()) {
                callerPhone = auth.getName();
            }

            String normalizedCallerPhone = com.cakeplatform.api.modules.auth.service.AuthService.normalizeIndianMobile(callerPhone);
            String normalizedOrderPhone = com.cakeplatform.api.modules.auth.service.AuthService.normalizeIndianMobile(order.getCustomerPhone());

            if (normalizedCallerPhone == null || !normalizedCallerPhone.equals(normalizedOrderPhone)) {
                // Request phone in payload must NOT override authenticated identity
                throw new org.springframework.security.access.AccessDeniedException("Unauthorized: You do not have permission to cancel this order");
            }
            // Customer phone matches authenticated identity
            return;
        }

        // Unauthenticated guest checkout: require trustworthy server-validated checkout session
        String token = checkoutTokenHeader;
        if ((token == null || token.isBlank()) && payload != null) {
            token = payload.get("checkoutToken");
        }

        // 1. Validate signed server checkout session token
        if (token != null && !token.isBlank() && jwtService != null) {
            boolean valid = jwtService.validateCheckoutToken(token, order.getOrderNumber(), order.getCustomerPhone());
            if (valid) {
                return;
            }
        }

        // 2. Validate server-generated payment transaction ID (razorpayOrderId)
        String candidateOrderId = (payload != null) ? payload.get("razorpayOrderId") : null;
        if (candidateOrderId == null || candidateOrderId.isBlank()) {
            candidateOrderId = token;
        }

        if (candidateOrderId != null && !candidateOrderId.isBlank() && order.getTransactionId() != null
                && candidateOrderId.equals(order.getTransactionId())) {
            // Verify caller provided matching customer phone if phone field was provided
            String reqPhone = (payload != null) ? payload.get("phone") : null;
            if (reqPhone != null && !reqPhone.isBlank()) {
                String normReqPhone = com.cakeplatform.api.modules.auth.service.AuthService.normalizeIndianMobile(reqPhone);
                String normOrderPhone = com.cakeplatform.api.modules.auth.service.AuthService.normalizeIndianMobile(order.getCustomerPhone());
                if (normReqPhone != null && normReqPhone.equals(normOrderPhone)) {
                    return;
                }
            } else {
                return;
            }
        }

        // If neither authenticated nor presenting a valid server-validated checkout session token:
        // Do not rely solely on a caller-supplied phone number plus order number.
        throw new org.springframework.security.access.AccessDeniedException("Unauthorized: Valid checkout session token or customer authentication required to cancel payment");
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
        } catch (DataIntegrityViolationException ex) {
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
                    "PAYMENT_VERIFIED_CANCELLED_ORDER", "ORDER", order.getId(),
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

