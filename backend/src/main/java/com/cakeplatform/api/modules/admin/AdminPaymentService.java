package com.cakeplatform.api.modules.admin;

import com.cakeplatform.api.exception.ResourceNotFoundException;
import com.cakeplatform.api.modules.admin.dto.AdminPaymentDetailResponse;
import com.cakeplatform.api.modules.admin.dto.AdminPaymentSummaryResponse;
import com.cakeplatform.api.modules.order.Order;
import com.cakeplatform.api.modules.order.OrderRepository;
import com.cakeplatform.api.modules.payment.Payment;
import com.cakeplatform.api.modules.payment.PaymentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminPaymentService {

    private final PaymentRepository paymentRepository;
    private final OrderRepository orderRepository;

    public Page<AdminPaymentSummaryResponse> getCrossShopPayments(
            int page,
            int size,
            String query,
            String status,
            String type,
            Long shopId,
            LocalDate startDate,
            LocalDate endDate) {

        int boundedSize = Math.min(Math.max(size, 1), 50);
        int boundedPage = Math.max(page, 0);
        Pageable pageable = PageRequest.of(boundedPage, boundedSize);

        LocalDateTime startDateTime = startDate != null ? startDate.atStartOfDay() : LocalDateTime.of(2000, 1, 1, 0, 0);
        LocalDateTime endDateTime = endDate != null ? endDate.atTime(LocalTime.MAX) : LocalDateTime.of(2099, 12, 31, 23, 59, 59);

        Page<Payment> paymentPage = paymentRepository.findAdminCrossShopPayments(
                shopId,
                status,
                type,
                startDateTime,
                endDateTime,
                query,
                pageable
        );

        return paymentPage.map(this::toPaymentSummaryResponse);
    }

    public AdminPaymentDetailResponse getPaymentDetails(Long id) {
        if (id == null) {
            throw new IllegalArgumentException("Payment ID cannot be null");
        }
        Payment payment = paymentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Payment not found with id: " + id));

        return toPaymentDetailResponse(payment);
    }

    /**
     * Resolves matching Order for a payment using documented 3-stage resolution.
     * Enforces mandatory tenant-isolation check on EVERY matching path:
     * matchedOrder.getShop().getId().equals(payment.getShop().getId())
     */
    public Order resolveMatchingOrder(Payment payment) {
        if (payment == null) {
            return null;
        }

        // Strategy 1: Primary match by providerPaymentId (e.g. "pay_...")
        if (payment.getProviderPaymentId() != null && !payment.getProviderPaymentId().isBlank()) {
            Optional<Order> opt = orderRepository.findByTransactionId(payment.getProviderPaymentId().trim());
            if (opt.isPresent()) {
                Order order = opt.get();
                if (isSameShop(order, payment)) {
                    return order;
                } else {
                    log.warn("Tenant isolation violation prevented: payment {} (shop {}) matched order {} (shop {}) via providerPaymentId - rejecting association",
                            payment.getId(), payment.getShop() != null ? payment.getShop().getId() : null,
                            order.getId(), order.getShop() != null ? order.getShop().getId() : null);
                }
            }
        }

        // Strategy 2: Primary match by providerOrderId (e.g. "order_...")
        if (payment.getProviderOrderId() != null && !payment.getProviderOrderId().isBlank()) {
            String rzpOrderId = payment.getProviderOrderId().trim();
            Optional<Order> opt = orderRepository.findByRazorpayOrderId(rzpOrderId);
            if (opt.isEmpty()) {
                opt = orderRepository.findByTransactionId(rzpOrderId);
            }
            if (opt.isPresent()) {
                Order order = opt.get();
                if (isSameShop(order, payment)) {
                    return order;
                } else {
                    log.warn("Tenant isolation violation prevented: payment {} (shop {}) matched order {} (shop {}) via providerOrderId - rejecting association",
                            payment.getId(), payment.getShop() != null ? payment.getShop().getId() : null,
                            order.getId(), order.getShop() != null ? order.getShop().getId() : null);
                }
            }
        }

        // Strategy 3: Documented fallback by failureReason prefix "ORDER:<orderNumber>"
        if (payment.getFailureReason() != null && payment.getFailureReason().startsWith("ORDER:")) {
            String orderNumber = payment.getFailureReason().substring(6).trim();
            if (!orderNumber.isBlank()) {
                Optional<Order> opt = orderRepository.findByOrderNumber(orderNumber);
                if (opt.isPresent()) {
                    Order order = opt.get();
                    if (isSameShop(order, payment)) {
                        return order;
                    } else {
                        log.warn("Tenant isolation violation prevented: payment {} (shop {}) matched order {} (shop {}) via ORDER: fallback - rejecting association",
                                payment.getId(), payment.getShop() != null ? payment.getShop().getId() : null,
                                order.getId(), order.getShop() != null ? order.getShop().getId() : null);
                    }
                }
            }
        }

        return null;
    }

    private boolean isSameShop(Order order, Payment payment) {
        if (order == null || payment == null) {
            return false;
        }
        if (order.getShop() == null || payment.getShop() == null) {
            return false;
        }
        Long orderShopId = order.getShop().getId();
        Long paymentShopId = payment.getShop().getId();
        return orderShopId != null && orderShopId.equals(paymentShopId);
    }

    public AdminPaymentSummaryResponse toPaymentSummaryResponse(Payment payment) {
        Long shopId = payment.getShop() != null ? payment.getShop().getId() : null;
        String shopName = payment.getShop() != null ? payment.getShop().getBusinessName() : null;

        String transactionType;
        String financialClassification;
        String associationState;
        String planName = null;
        String relatedOrderNumber = null;
        Long relatedOrderId = null;

        if (payment.getSubscription() != null || payment.getPlan() != null) {
            transactionType = "SUBSCRIPTION";
            financialClassification = "PLATFORM_REVENUE";
            associationState = "SUBSCRIPTION_LINKED";
            if (payment.getPlan() != null) {
                planName = payment.getPlan().getName();
            } else if (payment.getSubscription() != null && payment.getSubscription().getPlan() != null) {
                planName = payment.getSubscription().getPlan().getName();
            }
        } else {
            Order matchedOrder = resolveMatchingOrder(payment);
            if (matchedOrder != null) {
                transactionType = "RETAIL_ORDER";
                financialClassification = "NETWORK_GMV_ZERO_COMMISSION";
                associationState = "ORDER_MATCHED";
                relatedOrderNumber = matchedOrder.getOrderNumber();
                relatedOrderId = matchedOrder.getId();
            } else {
                transactionType = "UNKNOWN";
                financialClassification = "UNLINKED_TRANSACTION";
                associationState = "UNLINKED_GATEWAY_RECORD";
            }
        }

        return AdminPaymentSummaryResponse.builder()
                .id(payment.getId())
                .shopId(shopId)
                .shopName(shopName)
                .transactionType(transactionType)
                .financialClassification(financialClassification)
                .associationState(associationState)
                .planName(planName)
                .relatedOrderNumber(relatedOrderNumber)
                .relatedOrderId(relatedOrderId)
                .amount(payment.getAmount())
                .currency(payment.getCurrency())
                .provider(payment.getProvider())
                .providerOrderId(payment.getProviderOrderId())
                .providerPaymentId(payment.getProviderPaymentId())
                .gatewayStatus(payment.getStatus())
                .failureReason(payment.getFailureReason())
                .paidAt(payment.getPaidAt())
                .createdAt(payment.getCreatedAt())
                .build();
    }

    public AdminPaymentDetailResponse toPaymentDetailResponse(Payment payment) {
        Long shopId = payment.getShop() != null ? payment.getShop().getId() : null;
        String shopName = payment.getShop() != null ? payment.getShop().getBusinessName() : null;
        String shopPhone = payment.getShop() != null ? payment.getShop().getPhone() : null;
        String shopEmail = payment.getShop() != null ? payment.getShop().getEmail() : null;

        String transactionType;
        String financialClassification;
        String associationState;
        String planName = null;
        String relatedOrderNumber = null;
        Long relatedOrderId = null;
        AdminPaymentDetailResponse.AdminSubscriptionSnapshot subscriptionDetails = null;
        AdminPaymentDetailResponse.AdminOrderSnapshot orderDetails = null;

        if (payment.getSubscription() != null || payment.getPlan() != null) {
            transactionType = "SUBSCRIPTION";
            financialClassification = "PLATFORM_REVENUE";
            associationState = "SUBSCRIPTION_LINKED";
            if (payment.getPlan() != null) {
                planName = payment.getPlan().getName();
            } else if (payment.getSubscription() != null && payment.getSubscription().getPlan() != null) {
                planName = payment.getSubscription().getPlan().getName();
            }

            subscriptionDetails = AdminPaymentDetailResponse.AdminSubscriptionSnapshot.builder()
                    .subscriptionId(payment.getSubscription() != null ? payment.getSubscription().getId() : null)
                    .planName(planName)
                    .amount(payment.getAmount())
                    .status(payment.getSubscription() != null && payment.getSubscription().getStatus() != null ?
                            payment.getSubscription().getStatus().name() : null)
                    .startDate(payment.getSubscription() != null ? payment.getSubscription().getStartDate() : null)
                    .expiryDate(payment.getSubscription() != null ? payment.getSubscription().getExpiryDate() : null)
                    .build();
        } else {
            Order matchedOrder = resolveMatchingOrder(payment);
            if (matchedOrder != null) {
                transactionType = "RETAIL_ORDER";
                financialClassification = "NETWORK_GMV_ZERO_COMMISSION";
                associationState = "ORDER_MATCHED";
                relatedOrderNumber = matchedOrder.getOrderNumber();
                relatedOrderId = matchedOrder.getId();

                orderDetails = AdminPaymentDetailResponse.AdminOrderSnapshot.builder()
                        .orderId(matchedOrder.getId())
                        .orderNumber(matchedOrder.getOrderNumber())
                        .orderStatus(matchedOrder.getOrderStatus())
                        .paymentStatus(matchedOrder.getPaymentStatus())
                        .paymentMethod(matchedOrder.getPaymentMethod())
                        .totalAmount(matchedOrder.getTotalAmount())
                        .customerName(matchedOrder.getCustomerName())
                        .deliveryDate(matchedOrder.getDeliveryDate())
                        .deliverySlotDetails(matchedOrder.fetchDeliverySlotDetails())
                        .createdAt(matchedOrder.getCreatedAt())
                        .build();
            } else {
                transactionType = "UNKNOWN";
                financialClassification = "UNLINKED_TRANSACTION";
                associationState = "UNLINKED_GATEWAY_RECORD";
            }
        }

        return AdminPaymentDetailResponse.builder()
                .id(payment.getId())
                .shopId(shopId)
                .shopName(shopName)
                .shopPhone(shopPhone)
                .shopEmail(shopEmail)
                .transactionType(transactionType)
                .financialClassification(financialClassification)
                .associationState(associationState)
                .planName(planName)
                .relatedOrderNumber(relatedOrderNumber)
                .relatedOrderId(relatedOrderId)
                .amount(payment.getAmount())
                .currency(payment.getCurrency())
                .provider(payment.getProvider())
                .providerOrderId(payment.getProviderOrderId())
                .providerPaymentId(payment.getProviderPaymentId())
                .gatewayStatus(payment.getStatus())
                .failureReason(payment.getFailureReason())
                .paidAt(payment.getPaidAt())
                .createdAt(payment.getCreatedAt())
                .updatedAt(payment.getUpdatedAt())
                .subscriptionDetails(subscriptionDetails)
                .orderDetails(orderDetails)
                .build();
    }
}
