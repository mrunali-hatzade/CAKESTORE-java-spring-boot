package com.cakeplatform.api.modules.payment.controller;

import com.cakeplatform.api.modules.order.InvoiceService;
import com.cakeplatform.api.modules.payment.Payment;
import com.cakeplatform.api.modules.payment.PaymentRepository;
import com.cakeplatform.api.modules.payment.RazorpayService;
import com.cakeplatform.api.modules.payment.dto.OwnerPaymentResponse;
import com.cakeplatform.api.modules.security.ShopAccessValidator;
import com.cakeplatform.api.modules.shop.Shop;
import com.cakeplatform.api.modules.subscription.SubscriptionPlan;
import com.cakeplatform.api.modules.subscription.SubscriptionPlanRepository;
import com.cakeplatform.api.modules.subscription.SubscriptionService;
import com.cakeplatform.api.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.beans.factory.annotation.Value;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/owner/payments")
@PreAuthorize("hasAuthority('ROLE_SHOP_OWNER')")
@RequiredArgsConstructor
@Slf4j
public class OwnerPaymentController {

    @Value("${spring.profiles.active:}")
    private String activeProfiles;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private org.springframework.core.env.Environment environment;

    public void setEnvironment(org.springframework.core.env.Environment environment) {
        this.environment = environment;
    }

    private boolean isAllowedMockEnvironment() {
        if (environment != null) {
            for (String profile : environment.getActiveProfiles()) {
                if ("prod".equalsIgnoreCase(profile) || "production".equalsIgnoreCase(profile)) {
                    return false;
                }
            }
            for (String profile : environment.getActiveProfiles()) {
                if ("test".equalsIgnoreCase(profile) || "dev".equalsIgnoreCase(profile) || "local".equalsIgnoreCase(profile)) {
                    return true;
                }
            }
        }
        return razorpayService.getKeyId() != null && razorpayService.getKeyId().contains("placeholder");
    }

    private final SubscriptionService subscriptionService;
    private final PaymentRepository paymentRepository;
    private final ShopAccessValidator shopAccessValidator;
    private final RazorpayService razorpayService;
    private final InvoiceService invoiceService;
    private final SubscriptionPlanRepository subscriptionPlanRepository;

    /**
     * C3: Retrieve billing and payment history for the authenticated shop owner.
     * Enforces database-level tenant isolation.
     */
    @GetMapping
    public ResponseEntity<List<OwnerPaymentResponse>> getMyPayments(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        Shop shop = shopAccessValidator.getShopByOwnerId(userDetails.getId());
        List<Payment> payments = paymentRepository.findByShopIdOrderByCreatedAtDesc(shop.getId());

        List<OwnerPaymentResponse> response = payments.stream().map(p -> {
            String planName = "Pro Baker Studio";
            if (p.getSubscription() != null && p.getSubscription().getPlan() != null) {
                planName = p.getSubscription().getPlan().getName();
            }
            return OwnerPaymentResponse.builder()
                    .id(p.getId())
                    .amount(p.getAmount())
                    .currency(p.getCurrency() != null ? p.getCurrency() : "INR")
                    .provider(p.getProvider())
                    .providerOrderId(p.getProviderOrderId())
                    .providerPaymentId(p.getProviderPaymentId())
                    .status(p.getStatus())
                    .failureReason(p.getFailureReason())
                    .paidAt(p.getPaidAt())
                    .createdAt(p.getCreatedAt())
                    .subscriptionPlanName(planName)
                    .invoiceAvailable("COMPLETED".equalsIgnoreCase(p.getStatus()))
                    .build();
        }).collect(Collectors.toList());

        return ResponseEntity.ok(response);
    }

    /**
     * C5: Download official tax invoice PDF for a specific subscription payment.
     * Enforces tenant isolation (payment must belong to owner's shop).
     */
    @GetMapping("/{paymentId}/invoice")
    public ResponseEntity<byte[]> downloadSubscriptionInvoice(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long paymentId) throws Exception {
        Shop shop = shopAccessValidator.getShopByOwnerId(userDetails.getId());
        Payment payment = paymentRepository.findByIdAndShopId(paymentId, shop.getId())
                .orElseThrow(() -> new IllegalArgumentException("Payment record not found or does not belong to your bakery"));

        if (!"COMPLETED".equalsIgnoreCase(payment.getStatus())) {
            throw new IllegalStateException("Invoice is only available for completed payments");
        }

        byte[] pdfBytes = invoiceService.generateSubscriptionInvoice(payment);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDispositionFormData("attachment", "invoice-SUB-" + payment.getId() + ".pdf");

        return ResponseEntity.ok().headers(headers).body(pdfBytes);
    }

    /**
     * C1: Initiate subscription payment with server-authoritative pricing.
     */
    @PostMapping("/initiate-subscription")
    public ResponseEntity<Map<String, Object>> initiateSubscriptionPayment(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestBody Map<String, Object> payload) {
        Shop shop = shopAccessValidator.getShopByOwnerId(userDetails.getId());

        Number planIdNum = (Number) payload.get("planId");
        if (planIdNum == null) {
            throw new IllegalArgumentException("planId is required");
        }

        SubscriptionPlan plan = subscriptionPlanRepository.findById(planIdNum.longValue())
                .orElseThrow(() -> new IllegalArgumentException("Invalid subscription plan"));

        if (!plan.getIsActive()) {
            throw new IllegalStateException("Selected subscription plan is no longer active");
        }

        BigDecimal amount = plan.getPrice();
        int durationDays = plan.getDurationDays();

        // Create local Payment record in PENDING state
        Payment payment = new Payment();
        payment.setShop(shop);
        payment.setPlan(plan);
        payment.setAmount(amount);
        payment.setCurrency("INR");
        payment.setProvider("RAZORPAY");
        payment.setStatus("PENDING");
        payment = paymentRepository.save(payment);

        String receiptId = "sub_rcpt_" + payment.getId();
        String orderId;
        if (!razorpayService.isConfigured()) {
            if (isAllowedMockEnvironment()) {
                orderId = "order_mock_sub_" + payment.getId();
                log.info("[TEST/DEV MOCK] Generated simulated Razorpay order ID {} for unconfigured non-production environment", orderId);
            } else {
                throw new IllegalStateException("Razorpay credentials not configured.");
            }
        } else {
            orderId = razorpayService.createSubscriptionOrder(amount, plan.getId(), shop.getId(), receiptId);
        }
        
        // Save the razorpay order id back to payment
        payment.setProviderOrderId(orderId);
        paymentRepository.save(payment);

        return ResponseEntity.ok(Map.of(
                "paymentId", payment.getId(),
                "razorpayOrderId", orderId,
                "amount", amount,
                "amountPaise", amount.multiply(BigDecimal.valueOf(100)).longValue(),
                "currency", "INR",
                "keyId", razorpayService.getKeyId(),
                "durationDays", durationDays,
                "shopName", shop.getBusinessName()
        ));
    }

    /**
     * C1: Verify subscription payment signature and update subscription & shop state.
     */
    @PostMapping("/verify-subscription")
    public ResponseEntity<Map<String, Object>> verifySubscriptionPayment(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestBody Map<String, Object> payload) {
        String razorpayOrderId = (String) payload.get("razorpayOrderId");
        String razorpayPaymentId = (String) payload.get("razorpayPaymentId");
        String razorpaySignature = (String) payload.get("razorpaySignature");
        
        Number planIdNum = (Number) payload.get("planId");
        if (planIdNum == null) {
            throw new IllegalArgumentException("planId is required for verification");
        }

        SubscriptionPlan plan = subscriptionPlanRepository.findById(planIdNum.longValue())
                .orElseThrow(() -> new IllegalArgumentException("Invalid subscription plan"));

        if (!plan.getIsActive()) {
            throw new IllegalStateException("Selected subscription plan is no longer active");
        }

        if (razorpayOrderId == null || razorpayPaymentId == null || razorpaySignature == null) {
            throw new IllegalArgumentException("Missing required payment verification parameters");
        }

        // Signature verification
        if (!razorpayService.isConfigured()) {
            if (isAllowedMockEnvironment() && "simulated_test_sig".equals(razorpaySignature)) {
                log.info("[TEST/DEV MOCK] Bypassing Razorpay signature check in non-production environment for orderId={}", razorpayOrderId);
            } else {
                throw new IllegalArgumentException("Razorpay is not configured for production use.");
            }
        } else {
            boolean valid = razorpayService.verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
            if (!valid) {
                log.warn("Subscription payment signature verification failed for user {}", userDetails.getId());
                throw new IllegalArgumentException("Payment verification failed. Invalid signature.");
            }
            // Double check that Razorpay recorded the expected amount and currency
            razorpayService.verifyOrderDetails(razorpayOrderId, plan.getPrice(), "INR");
        }

        Shop shop = shopAccessValidator.getShopByOwnerId(userDetails.getId());
        Payment payment = paymentRepository.findByProviderOrderId(razorpayOrderId)
                .orElseThrow(() -> new IllegalArgumentException("Payment order not found"));

        if (!payment.getShop().getId().equals(shop.getId())) {
            throw new IllegalArgumentException("Payment does not belong to this shop");
        }

        if ("COMPLETED".equals(payment.getStatus())) {
            return ResponseEntity.ok(Map.of(
                    "status", "SUCCESS",
                    "message", "Payment already verified",
                    "paymentId", payment.getId()
            ));
        }

        if (!"PENDING".equals(payment.getStatus())) {
            throw new IllegalStateException("Payment is not in a pending state");
        }

        if (payment.getPlan() == null || !payment.getPlan().getId().equals(plan.getId())) {
            throw new IllegalArgumentException("Payment plan mismatch. Security check failed.");
        }

        if (payment.getAmount().compareTo(plan.getPrice()) != 0) {
            throw new IllegalArgumentException("Payment amount mismatch. Security check failed.");
        }

        payment = subscriptionService.processSuccessfulPayment(
                userDetails.getId(),
                plan,
                razorpayOrderId,
                razorpayPaymentId,
                payment
        );

        return ResponseEntity.ok(Map.of(
                "status", "SUCCESS",
                "message", "Subscription payment verified successfully",
                "paymentId", payment.getId(),
                "providerPaymentId", razorpayPaymentId
        ));
    }

}
