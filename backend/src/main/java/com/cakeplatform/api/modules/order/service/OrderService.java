package com.cakeplatform.api.modules.order.service;

import com.cakeplatform.api.modules.audit.ActivityLoggerService;
import com.cakeplatform.api.modules.interaction.CustomCakeRequest;
import com.cakeplatform.api.modules.interaction.CustomCakeRequestRepository;
import com.cakeplatform.api.modules.notification.EmailService;
import com.cakeplatform.api.modules.notification.SmsService;
import com.cakeplatform.api.modules.order.Order;
import com.cakeplatform.api.modules.order.OrderRepository;
import com.cakeplatform.api.modules.shop.Shop;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrderService {

    private final OrderRepository orderRepository;
    private final com.cakeplatform.api.modules.security.ShopAccessValidator shopAccessValidator;
    private final ActivityLoggerService activityLogger;
    private final EmailService emailService;
    private final SmsService smsService;
    private final CustomCakeRequestRepository customCakeRequestRepository;

    private Shop getShopForOrderArchive(Long ownerId) {
        return shopAccessValidator.validateOrderArchiveAccess(ownerId);
    }

    private Shop getShopForOrderFulfillment(Long ownerId) {
        return shopAccessValidator.validateOrderFulfillmentAccess(ownerId);
    }

    public org.springframework.data.domain.Page<Order> getPaginatedOrdersByUserId(
            Long userId, 
            String status, 
            String paymentStatus, 
            String query, 
            org.springframework.data.domain.Pageable pageable) {
        Shop shop = getShopForOrderArchive(userId);
        return orderRepository.findFilteredOrdersByShopId(shop.getId(), status, paymentStatus, query, pageable);
    }

    public List<Order> getOrdersByUserId(Long userId) {
        Shop shop = getShopForOrderArchive(userId);
        return orderRepository.findVisibleOrdersByShopId(shop.getId());
    }

    public Order getOrderDetails(Long userId, Long orderId) {
        Shop shop = getShopForOrderArchive(userId);
        return orderRepository.findByIdAndShopId(orderId, shop.getId())
                .orElseThrow(() -> new RuntimeException("Order not found or unauthorized"));
    }

    private static final java.util.Map<String, java.util.List<String>> ALLOWED_TRANSITIONS = java.util.Map.of(
        "PAYMENT_PENDING", java.util.List.of("NEW", "CONFIRMED", "CANCELLED"),
        "NEW", java.util.List.of("CONFIRMED", "PREPARING", "READY", "DELIVERED", "COMPLETED", "CANCELLED"),
        "CONFIRMED", java.util.List.of("NEW", "PREPARING", "READY", "DELIVERED", "COMPLETED", "CANCELLED"),
        "PREPARING", java.util.List.of("CONFIRMED", "READY", "DELIVERED", "COMPLETED", "CANCELLED"),
        "READY", java.util.List.of("PREPARING", "DELIVERED", "COMPLETED", "CANCELLED"),
        "DELIVERED", java.util.List.of("READY", "COMPLETED", "CANCELLED")
    );

    @Transactional
    public Order updateOrderStatus(Long userId, Long orderId, String newStatusRaw) {
        String newStatus = newStatusRaw != null ? newStatusRaw.trim().toUpperCase() : "";
        Shop shop = getShopForOrderFulfillment(userId);
        Order order = orderRepository.findByIdAndShopId(orderId, shop.getId())
                .orElseThrow(() -> new RuntimeException("Order not found or unauthorized"));

        String currentStatus = order.getOrderStatus() != null ? order.getOrderStatus().toUpperCase() : "NEW";

        if ("COMPLETED".equals(currentStatus) || "CANCELLED".equals(currentStatus)) {
            throw new IllegalStateException("Order is in a terminal state and cannot be modified.");
        }

        if (currentStatus.equals(newStatus)) {
            return order;
        }

        java.util.List<String> allowed = ALLOWED_TRANSITIONS.getOrDefault(currentStatus, java.util.List.of());
        if (!allowed.contains(newStatus)) {
            throw new IllegalArgumentException("Invalid status transition from " + currentStatus + " to " + newStatus);
        }

        order.setOrderStatus(newStatus);
        Order updated = orderRepository.save(order);
        
        if ("CANCELLED".equals(newStatus)) {
            syncCancelledCustomCake(updated);
        }

        activityLogger.logActivity(userId, shop.getId(), "ORDER_STATUS_CHANGED", "ORDER", updated.getId(), "Status: " + newStatus);

        // Register post-commit notification to avoid rolling back transaction on failures
        final Shop finalShop = shop;
        final Order finalUpdated = updated;
        if (org.springframework.transaction.support.TransactionSynchronizationManager.isSynchronizationActive()) {
            org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(new org.springframework.transaction.support.TransactionSynchronizationAdapter() {
                @Override
                public void afterCommit() {
                    notifyCustomer(finalShop, finalUpdated);
                }
            });
        } else {
            notifyCustomer(finalShop, finalUpdated);
        }
        return updated;
    }

    private void syncCancelledCustomCake(Order order) {
        customCakeRequestRepository.findByConvertedOrderId(order.getId()).ifPresent(cakeReq -> {
            if (cakeReq.getShop().getId().equals(order.getShop().getId())) {
                cakeReq.setConvertedOrderId(null);
                cakeReq.setConvertedOrderNumber(null);
                cakeReq.setStatus("REVIEWED");
                customCakeRequestRepository.save(cakeReq);
                log.info("Synchronized cancelled Order {} by resetting CustomCakeRequest {} to REVIEWED.", order.getId(), cakeReq.getId());
            } else {
                log.warn("Tenant mismatch during custom cake sync: CakeRequest {} belongs to shop {}, but Order {} belongs to shop {}",
                        cakeReq.getId(), cakeReq.getShop().getId(), order.getId(), order.getShop().getId());
            }
        });
    }

    private void notifyCustomer(Shop shop, Order order) {
        try {
            String shopName = shop.getBusinessName() != null ? shop.getBusinessName() : "CakeStore Bakery";
            String subject = String.format("Order Update: Your order #%s is now %s", order.getOrderNumber(), order.getOrderStatus());
            String body = String.format("Hello %s,\n\nYour order #%s at %s has been updated. The current status is now: %s.\n\nThank you for choosing us!",
                    order.getCustomerName() != null ? order.getCustomerName() : "Customer",
                    order.getOrderNumber(),
                    shopName,
                    order.getOrderStatus()
            );

            if (order.getCustomerEmail() != null && !order.getCustomerEmail().isBlank()) {
                emailService.sendEmail(order.getCustomerEmail(), subject, body);
            }

            if (order.getCustomerPhone() != null && !order.getCustomerPhone().isBlank()) {
                String smsBody = String.format("Update from %s: Your order #%s is now %s.", shopName, order.getOrderNumber(), order.getOrderStatus());
                smsService.sendSms(order.getCustomerPhone(), smsBody);
            }
        } catch (Exception e) {
            // Failsafe to ensure notification exceptions NEVER roll back the transaction
        }
    }

    @Transactional
    public Order updatePaymentStatus(Long userId, Long orderId, String newPaymentStatusRaw, String paymentNote) {
        String newStatus = newPaymentStatusRaw != null ? newPaymentStatusRaw.trim().toUpperCase() : "PAID";
        Shop shop = getShopForOrderFulfillment(userId);
        Order order = orderRepository.findByIdAndShopId(orderId, shop.getId())
                .orElseThrow(() -> new RuntimeException("Order not found or unauthorized"));

        String currentPaymentStatus = order.getPaymentStatus() != null ? order.getPaymentStatus().toUpperCase() : "PENDING";
        
        if (currentPaymentStatus.equalsIgnoreCase(newStatus)) {
            return order;
        }
        
        if ("REFUNDED".equals(currentPaymentStatus)) {
            throw new IllegalStateException("Order is already REFUNDED and cannot be changed.");
        }
        
        if ("PAID".equals(currentPaymentStatus) && "PENDING".equals(newStatus)) {
            String method = order.getPaymentMethod() != null ? order.getPaymentMethod().toUpperCase() : "";
            if (method.equals("RAZORPAY") || method.equals("ONLINE_PAYMENT")) {
                throw new IllegalStateException("Online completed payments cannot be reverted to PENDING.");
            }
        }

        order.setPaymentStatus(newStatus);
        if ("PAID".equalsIgnoreCase(newStatus)) {
            order.setPaidAt(java.time.LocalDateTime.now());
            if (order.getTransactionId() == null || order.getTransactionId().isBlank()) {
                order.setTransactionId(paymentNote != null && !paymentNote.isBlank() ? paymentNote : "CASH_COLLECTED");
            }
        } else if ("PENDING".equalsIgnoreCase(newStatus)) {
            order.setPaidAt(null);
            if ("CASH_COLLECTED".equalsIgnoreCase(order.getTransactionId())) {
                order.setTransactionId(null);
            }
        } else if ("REFUNDED".equalsIgnoreCase(newStatus)) {
            if (order.getTransactionId() == null || order.getTransactionId().isBlank()) {
                order.setTransactionId(paymentNote != null && !paymentNote.isBlank() ? paymentNote : "REFUND_ISSUED");
            }
        }

        Order updated = orderRepository.save(order);

        activityLogger.logActivity(userId, shop.getId(), "ORDER_PAYMENT_STATUS_CHANGED", "ORDER", updated.getId(),
                "Payment Status: " + newStatus + (paymentNote != null ? " (" + paymentNote + ")" : ""));

        // Register email notifications to be sent after transaction commit
        final Order finalUpdated = updated;
        final Shop finalShop = shop;
        if (org.springframework.transaction.support.TransactionSynchronizationManager.isSynchronizationActive()) {
            org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(new org.springframework.transaction.support.TransactionSynchronizationAdapter() {
                @Override
                public void afterCommit() {
                    if ("REFUNDED".equalsIgnoreCase(finalUpdated.getPaymentStatus())) {
                        notifyCustomerRefundProcessed(finalShop, finalUpdated);
                    } else {
                        notifyCustomerPaymentReceived(finalShop, finalUpdated);
                    }
                }
            });
        } else {
            if ("REFUNDED".equalsIgnoreCase(finalUpdated.getPaymentStatus())) {
                notifyCustomerRefundProcessed(finalShop, finalUpdated);
            } else {
                notifyCustomerPaymentReceived(finalShop, finalUpdated);
            }
        }

        return updated;
    }

    private void notifyCustomerRefundProcessed(Shop shop, Order order) {
        try {
            String shopName = shop.getBusinessName() != null ? shop.getBusinessName() : "CakeStore Bakery";
            String subject = String.format("Manual Refund Recorded: Order #%s at %s", order.getOrderNumber(), shopName);
            String body = String.format("Hello %s,\n\nA manual refund of ₹%s for your cancelled order #%s at %s has been recorded by the bakery. If you have questions regarding your refund settlement, please contact the bakery directly.\n\nThank you for choosing us!",
                    order.getCustomerName() != null ? order.getCustomerName() : "Customer",
                    order.getTotalAmount(),
                    order.getOrderNumber(),
                    shopName
            );

            if (order.getCustomerEmail() != null && !order.getCustomerEmail().isBlank()) {
                emailService.sendEmail(order.getCustomerEmail(), subject, body);
            }

            if (order.getCustomerPhone() != null && !order.getCustomerPhone().isBlank()) {
                String smsBody = String.format("Manual refund recorded: ₹%s for order #%s at %s. Contact the bakery for settlement details.",
                        order.getTotalAmount(), order.getOrderNumber(), shopName);
                smsService.sendSms(order.getCustomerPhone(), smsBody);
            }
        } catch (Exception e) {
            // Non-blocking notification failsafe
        }
    }

    private void notifyCustomerPaymentReceived(Shop shop, Order order) {
        try {
            if (!"PAID".equalsIgnoreCase(order.getPaymentStatus())) return;
            String shopName = shop.getBusinessName() != null ? shop.getBusinessName() : "CakeStore Bakery";
            String subject = String.format("Payment Received: Order #%s at %s", order.getOrderNumber(), shopName);
            String body = String.format("Hello %s,\n\nWe have successfully received payment of ₹%s for your order #%s at %s (Payment Mode: %s).\n\nThank you for ordering with us!",
                    order.getCustomerName() != null ? order.getCustomerName() : "Customer",
                    order.getTotalAmount(),
                    order.getOrderNumber(),
                    shopName,
                    "COD".equalsIgnoreCase(order.getPaymentMethod()) ? "Cash on Delivery" : "Online / Prepaid"
            );

            if (order.getCustomerEmail() != null && !order.getCustomerEmail().isBlank()) {
                emailService.sendEmail(order.getCustomerEmail(), subject, body);
            }

            if (order.getCustomerPhone() != null && !order.getCustomerPhone().isBlank()) {
                String smsBody = String.format("Payment received: ₹%s for order #%s at %s. Thank you!",
                        order.getTotalAmount(), order.getOrderNumber(), shopName);
                smsService.sendSms(order.getCustomerPhone(), smsBody);
            }
        } catch (Exception e) {
            // Non-blocking notification failsafe
        }
    }

    @Transactional(readOnly = true)
    public void monitorPendingPaymentOrders(java.time.LocalDateTime threshold) {
        List<Order> pendingOrders = orderRepository.findStalePaymentPendingOrders(threshold);
        if (!pendingOrders.isEmpty()) {
            log.info("Order payment monitoring: Found {} PAYMENT_PENDING order(s) placed before {}. Retaining in pending reconciliation state to protect delivery slot capacity and avoid premature cancellation.",
                    pendingOrders.size(), threshold);
            for (Order order : pendingOrders) {
                log.debug("Pending reconciliation order: id={}, orderNumber={}, shopId={}, createdAt={}, total={}",
                        order.getId(), order.getOrderNumber(), order.getShop() != null ? order.getShop().getId() : null,
                        order.getCreatedAt(), order.getTotalAmount());
            }
        }
    }

    /**
     * @deprecated Automatic cancellation of PAYMENT_PENDING orders was removed to protect
     * customers against delayed payment confirmation / webhooks.
     * This method now delegates to monitorPendingPaymentOrders without cancelling orders.
     */
    @Deprecated
    @Transactional(readOnly = true)
    public void cancelStalePaymentPendingOrders(java.time.LocalDateTime expiryTime) {
        monitorPendingPaymentOrders(expiryTime);
    }
}
