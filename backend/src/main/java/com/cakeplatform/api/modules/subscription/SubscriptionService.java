package com.cakeplatform.api.modules.subscription;

import com.cakeplatform.api.modules.audit.ActivityLoggerService;
import com.cakeplatform.api.modules.payment.Payment;
import com.cakeplatform.api.modules.payment.PaymentRepository;
import com.cakeplatform.api.modules.shop.Shop;
import com.cakeplatform.api.modules.shop.ShopRepository;
import com.cakeplatform.api.modules.shop.ShopStatusManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@lombok.extern.slf4j.Slf4j
public class SubscriptionService {

    private final SubscriptionRepository subscriptionRepository;
    private final PaymentRepository paymentRepository;
    private final ShopRepository shopRepository;
    private final ShopStatusManager shopStatusManager;
    private final ActivityLoggerService activityLogger;
    private final com.cakeplatform.api.modules.notification.NotificationService notificationService;
    private final com.cakeplatform.api.modules.notification.AdminNotificationService adminNotificationService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.cakeplatform.api.modules.storefront.StorefrontCacheService storefrontCacheService;

    public void setStorefrontCacheService(com.cakeplatform.api.modules.storefront.StorefrontCacheService storefrontCacheService) {
        this.storefrontCacheService = storefrontCacheService;
    }

    private Shop getShopByOwnerId(Long ownerId) {
        List<Shop> shops = shopRepository.findByOwnerId(ownerId);
        if (shops.isEmpty()) {
            throw new IllegalArgumentException("Shop not found for this user");
        }
        return shops.get(0);
    }

    public Subscription getActiveSubscription(Long userId) {
        Shop shop = getShopByOwnerId(userId);
        
        return subscriptionRepository.findFirstByShopIdAndStatusOrderByCreatedAtDesc(shop.getId(), SubscriptionStatus.ACTIVE)
                .orElse(null);
    }

    @Transactional
    public Subscription cancelSubscription(Long userId, String reason) {
        Shop shop = getShopByOwnerId(userId);

        Subscription activeSub = subscriptionRepository
                .findFirstByShopIdAndStatusOrderByCreatedAtDesc(shop.getId(), SubscriptionStatus.ACTIVE)
                .orElseThrow(() -> new IllegalStateException("No active subscription found to cancel for your bakery."));

        // Idempotency: if already scheduled for cancellation, do not overwrite or duplicate
        if (activeSub.getCancelledAt() != null) {
            log.info("Subscription ID {} for Shop ID {} is already scheduled for cancellation at period end.", activeSub.getId(), shop.getId());
            return activeSub;
        }

        String normalizedReason = (reason != null && !reason.trim().isEmpty())
                ? reason.trim()
                : "Cancellation requested by bakery owner";
        if (normalizedReason.length() > 500) {
            normalizedReason = normalizedReason.substring(0, 500);
        }

        activeSub.setCancelledAt(LocalDateTime.now());
        activeSub.setCancellationReason(normalizedReason);

        Subscription savedSub = subscriptionRepository.save(activeSub);

        // Audit Logging
        if (activityLogger != null) {
            activityLogger.logActivity(
                    userId,
                    shop.getId(),
                    "SUBSCRIPTION_CANCELLATION_SCHEDULED",
                    "SUBSCRIPTION",
                    savedSub.getId(),
                    "Cancellation scheduled at period end. Reason: " + normalizedReason
            );
        }

        // Owner Notification (Confirming access preserved until expiryDate)
        if (notificationService != null && shop.getOwner() != null) {
            String expiryStr = (savedSub.getExpiryDate() != null)
                    ? savedSub.getExpiryDate().toLocalDate().toString()
                    : "the end of your current billing period";
            String message = String.format(
                    "Your subscription cancellation request for %s has been recorded. Your bakery access and storefront remain active until %s. No further renewals will occur.",
                    shop.getBusinessName(),
                    expiryStr
            );
            notificationService.createNotification(
                    shop.getOwner(),
                    com.cakeplatform.api.modules.notification.NotificationType.ADMIN_MESSAGE,
                    "Subscription Cancellation Scheduled",
                    message,
                    savedSub.getId().toString(),
                    true
            );
        }

        return savedSub;
    }

    @Transactional
    public Payment processSuccessfulPayment(Long userId, SubscriptionPlan plan, String providerOrderId, String providerPaymentId, Payment paymentInfo) {
        Shop shop = getShopByOwnerId(userId);

        // Fetch payment with PESSIMISTIC_WRITE lock to prevent race condition
        Payment payment = paymentRepository.findByIdWithLock(paymentInfo.getId())
                .orElseThrow(() -> new IllegalArgumentException("Payment not found"));

        if ("COMPLETED".equalsIgnoreCase(payment.getStatus())) {
            log.info("Payment {} is already COMPLETED. Skipping duplicate subscription processing.", payment.getId());
            return payment;
        }

        int days = plan.getDurationDays();
        BigDecimal amount = plan.getPrice();

        // 1. Create/Update Subscription
        Subscription subscription = new Subscription();
        subscription.setShop(shop);
        subscription.setPlan(plan);
        subscription.setStatus(SubscriptionStatus.ACTIVE);
        subscription.setAmount(amount);
        subscription.setStartDate(LocalDateTime.now());
        subscription.setExpiryDate(LocalDateTime.now().plusDays(days));
        
        subscription = subscriptionRepository.save(subscription);

        activityLogger.logActivity(userId, shop.getId(), "SUBSCRIPTION_ACTIVATED", "SUBSCRIPTION", subscription.getId(), days + " days");

        // 2. Update existing Payment Record
        payment.setSubscription(subscription);
        payment.setProviderPaymentId(providerPaymentId);
        payment.setStatus("COMPLETED");
        payment.setPaidAt(LocalDateTime.now());

        Payment savedPayment = paymentRepository.save(payment);
        Long savedPaymentId = (savedPayment != null) ? savedPayment.getId() : null;

        activityLogger.logActivity(userId, shop.getId(), "PAYMENT_COMPLETED", "PAYMENT", savedPaymentId, "Amount: " + amount);

        // 3. Update Shop Status: Precise Renewal Restoration Rules (Plan Section 6.6)
        if (shop.isDeleted()) {
            log.warn("Shop {} is soft-deleted. Subscription payment processed, but shop remains deleted.", shop.getId());
        } else if (shop.getStatus() == com.cakeplatform.api.modules.shop.ShopStatus.SUSPENDED) {
            log.info("Shop {} is SUSPENDED by admin. Subscription renewed but shop remains SUSPENDED.", shop.getId());
        } else if (shop.getStatus() == com.cakeplatform.api.modules.shop.ShopStatus.INACTIVE) {
            // Legacy INACTIVE shops: Subscription activates, but shop remains INACTIVE until explicit owner re-opening.
            // Preserves isOwnerEnabled and isMarketplaceRestricted flags.
            log.info("Shop {} is legacy INACTIVE. Subscription renewed; shop status remains INACTIVE.", shop.getId());
        } else if (shop.getStatus() == com.cakeplatform.api.modules.shop.ShopStatus.EXPIRED || shop.getStatus() == com.cakeplatform.api.modules.shop.ShopStatus.PENDING) {
            // Eligible expired or pending onboarding shop: restore to ACTIVE
            shopStatusManager.activateShop(shop.getId(), userId);
        } else if (shop.getStatus() == com.cakeplatform.api.modules.shop.ShopStatus.ACTIVE) {
            // Already ACTIVE shop renewing early: preserve ACTIVE status and keep existing operational flags intact
            log.info("Shop {} is already ACTIVE. Subscription extended; preserving existing operational flags.", shop.getId());
        }

        if (storefrontCacheService != null && shop.getId() != null) {
            storefrontCacheService.evictShopDetails(shop.getId());
            storefrontCacheService.evictShopProducts(shop.getId());
        }

        // Notify owner of successful subscription renewal
        if (shop.getOwner() != null && notificationService != null) {
            notificationService.createNotification(
                    shop.getOwner(),
                    com.cakeplatform.api.modules.notification.NotificationType.SUBSCRIPTION_EXPIRING,
                    "Subscription Activated",
                    String.format("Your subscription for %s is now ACTIVE for %d days. Thank you for your payment!", shop.getBusinessName(), days),
                    subscription.getId() != null ? subscription.getId().toString() : "",
                    false
            );
        }

        // Dispatch Admin Notification (SUBSCRIPTION_RENEWED)
        try {
            adminNotificationService.dispatchAdminNotification(
                    com.cakeplatform.api.modules.notification.AdminNotificationType.SUBSCRIPTION_RENEWED,
                    "Subscription Renewed: " + shop.getBusinessName(),
                    String.format("Subscription for %s renewed for %d days (₹%s).", shop.getBusinessName(), days, amount),
                    com.cakeplatform.api.modules.notification.AdminNotificationPriority.NORMAL,
                    com.cakeplatform.api.modules.notification.AdminNotificationCategory.SUBSCRIPTIONS,
                    providerPaymentId != null ? providerPaymentId : (subscription.getId() != null ? subscription.getId().toString() : "SUB-" + System.currentTimeMillis()),
                    "SUBSCRIPTION",
                    "/admin/shops/" + shop.getId()
            );
        } catch (Exception ignored) {}

        return savedPayment;
    }

    
    
    @Transactional
    public void expireSubscription(Long subscriptionId) {
        Subscription subscription = subscriptionRepository.findById(subscriptionId)
                .orElseThrow(() -> new RuntimeException("Subscription not found"));
        
        Shop shop = subscription.getShop();
        
        // Idempotency: if already expired, nothing to do
        if (subscription.getStatus() == SubscriptionStatus.EXPIRED) {
            return;
        }

        subscription.setStatus(SubscriptionStatus.EXPIRED);
        subscriptionRepository.save(subscription);
        
        // Final CakeStore Rule: Only ACTIVE shops become EXPIRED when no active subscription remains.
        // Soft-deleted, suspended, and legacy INACTIVE shops strictly preserve their distinct statuses.
        if (!shop.isDeleted()
                && shop.getStatus() != com.cakeplatform.api.modules.shop.ShopStatus.SUSPENDED 
                && shop.getStatus() != com.cakeplatform.api.modules.shop.ShopStatus.INACTIVE) {
            boolean hasActiveSubscription = subscriptionRepository.findFirstByShopIdAndStatusOrderByCreatedAtDesc(shop.getId(), SubscriptionStatus.ACTIVE).isPresent();
            if (!hasActiveSubscription) {
                shop.setStatus(com.cakeplatform.api.modules.shop.ShopStatus.EXPIRED);
                shopRepository.save(shop);
            }
        }

        if (storefrontCacheService != null && shop != null && shop.getId() != null) {
            storefrontCacheService.evictShopDetails(shop.getId());
            storefrontCacheService.evictShopProducts(shop.getId());
        }
        
        activityLogger.logActivity(null, shop.getId(), "SUBSCRIPTION_EXPIRED", "SUBSCRIPTION", subscription.getId(), "Daily scheduled or manual expiration");

        // Notify the owner
        if (shop.getOwner() != null && notificationService != null) {
            String message = String.format("Your subscription for %s has expired. Please renew your plan in your billing settings to regain management access.", shop.getBusinessName());
            notificationService.createNotification(
                    shop.getOwner(),
                    com.cakeplatform.api.modules.notification.NotificationType.SUBSCRIPTION_EXPIRED,
                    "Subscription Expired",
                    message,
                    subscription.getId().toString(),
                    true
            );
        }

        // Dispatch Admin Notification (SUBSCRIPTION_EXPIRED)
        try {
            adminNotificationService.dispatchAdminNotification(
                    com.cakeplatform.api.modules.notification.AdminNotificationType.SUBSCRIPTION_EXPIRED,
                    "Subscription Expired: " + shop.getBusinessName(),
                    String.format("Subscription for %s has expired. Owner dashboard access locked pending renewal.", shop.getBusinessName()),
                    com.cakeplatform.api.modules.notification.AdminNotificationPriority.HIGH,
                    com.cakeplatform.api.modules.notification.AdminNotificationCategory.SUBSCRIPTIONS,
                    subscription.getId().toString(),
                    "SUBSCRIPTION",
                    "/admin/shops/" + shop.getId()
            );
        } catch (Exception ignored) {}
    }
}
