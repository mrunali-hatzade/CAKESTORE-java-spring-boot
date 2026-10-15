package com.cakeplatform.api.modules.security;

import com.cakeplatform.api.modules.shop.Shop;
import com.cakeplatform.api.modules.shop.ShopRepository;
import com.cakeplatform.api.modules.shop.VerificationStatus;
import com.cakeplatform.api.modules.subscription.Subscription;
import com.cakeplatform.api.modules.subscription.SubscriptionRepository;
import com.cakeplatform.api.modules.subscription.SubscriptionStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class ShopAccessValidator {

    private final ShopRepository shopRepository;
    private final SubscriptionRepository subscriptionRepository;

    /**
     * Basic shop lookup by owner ID. Ensures tenant isolation (shop belongs to owner).
     * Does NOT enforce operational lifecycle gating, allowing account recovery, settings, and subscription viewing.
     */
    @Transactional(readOnly = true)
    public Shop getShopByOwnerId(Long ownerId) {
        List<Shop> shops = shopRepository.findByOwnerId(ownerId);
        if (shops.isEmpty()) {
            throw new IllegalArgumentException("Shop not found for this user");
        }
        if (shops.size() > 1) {
            log.error("Data integrity violation: Owner ID {} owns {} shops. Strictly one shop allowed per owner.", ownerId, shops.size());
            throw new IllegalStateException("Multiple shops found for single owner account");
        }
        return shops.get(0);
    }

    /**
     * Strict operational access gating for owner actions.
     * Enforces:
     * 1. Shop exists for owner (Tenant Isolation)
     * 2. Shop is not SUSPENDED
     * 3. Shop has an ACTIVE (unexpired) Subscription
     * 4. Shop status is ACTIVE
     */
    @Transactional(readOnly = true)
    public Shop getValidShopForOwner(Long ownerId) {
        Shop shop = getShopByOwnerId(ownerId);

        // Check 0: Suspended shops must be blocked from operational functions
        if (shop.getStatus() == com.cakeplatform.api.modules.shop.ShopStatus.SUSPENDED) {
            throw new com.cakeplatform.api.exception.SubscriptionExpiredException("Shop is suspended by administration. Please contact support.");
        }

        // Check 2: Active Subscription
        Subscription latestSub = subscriptionRepository.findFirstByShopIdOrderByCreatedAtDesc(shop.getId())
                .orElseThrow(() -> new com.cakeplatform.api.exception.SubscriptionExpiredException("No subscription found. Please subscribe to a plan."));

        if (latestSub.getStatus() == SubscriptionStatus.EXPIRED || 
            latestSub.getStatus() == SubscriptionStatus.SUSPENDED || 
            latestSub.getStatus() == SubscriptionStatus.CANCELLED ||
            (latestSub.getExpiryDate() != null && latestSub.getExpiryDate().isBefore(java.time.LocalDateTime.now()))) {
            throw new com.cakeplatform.api.exception.SubscriptionExpiredException("Subscription is " + latestSub.getStatus().name() + ". Please renew to access this feature.");
        }

        // Check 3: Shop must be ACTIVE
        if (shop.getStatus() != com.cakeplatform.api.modules.shop.ShopStatus.ACTIVE) {
            throw new com.cakeplatform.api.exception.SubscriptionExpiredException("Shop is currently " + shop.getStatus().name() + ". Please activate your subscription.");
        }

        return shop;
    }

    /**
     * Domain 1: Dashboard Overview & Alerts (GET /api/shops/my-shop, GET /api/owner/dashboard/overview)
     * Allowed: ACTIVE, EXPIRED, OWNER-DISABLED, ADMIN-RESTRICTED, and legacy INACTIVE.
     * Blocked: SUSPENDED (throws SubscriptionExpiredException instructing to contact support), DELETED.
     */
    @Transactional(readOnly = true)
    public Shop validateDashboardAccess(Long ownerId) {
        Shop shop = getShopByOwnerId(ownerId);
        if (shop.getStatus() == com.cakeplatform.api.modules.shop.ShopStatus.SUSPENDED) {
            throw new com.cakeplatform.api.exception.SubscriptionExpiredException("Shop is suspended by administration. Please contact support.");
        }
        return shop;
    }

    /**
     * Domain 2: Billing, Invoices & Renewal (GET/POST /api/owner/payments/**, /api/subscriptions/**)
     * Allowed: ACTIVE, EXPIRED, OWNER-DISABLED, ADMIN-RESTRICTED, and legacy INACTIVE can self-service renew.
     * Blocked from checkout: SUSPENDED (throws SubscriptionExpiredException instructing to contact support).
     */
    @Transactional(readOnly = true)
    public Shop validateBillingAccess(Long ownerId) {
        Shop shop = getShopByOwnerId(ownerId);
        if (shop.getStatus() == com.cakeplatform.api.modules.shop.ShopStatus.SUSPENDED) {
            throw new com.cakeplatform.api.exception.SubscriptionExpiredException("Shop is suspended by administration. Self-service renewal is unavailable. Please contact support.");
        }
        return shop;
    }

    /**
     * Domain 4: Catalog & Slot Editing (/api/products/**, /api/delivery-slots/**, /api/coupons/**)
     * Allowed: ACTIVE (including owner-disabled vacation and admin-restricted) with active unexpired subscription.
     * Blocked: EXPIRED (403), SUSPENDED (403), DELETED (404/403).
     */
    @Transactional(readOnly = true)
    public Shop validateCatalogAccess(Long ownerId) {
        Shop shop = getShopByOwnerId(ownerId);

        if (shop.getStatus() == com.cakeplatform.api.modules.shop.ShopStatus.SUSPENDED) {
            throw new com.cakeplatform.api.exception.SubscriptionExpiredException("Shop is suspended by administration. Catalog editing is blocked. Please contact support.");
        }

        Subscription latestSub = subscriptionRepository.findFirstByShopIdOrderByCreatedAtDesc(shop.getId())
                .orElseThrow(() -> new com.cakeplatform.api.exception.SubscriptionExpiredException("No subscription found. Please subscribe to a plan."));

        if (latestSub.getStatus() == SubscriptionStatus.EXPIRED || 
            latestSub.getStatus() == SubscriptionStatus.SUSPENDED || 
            latestSub.getStatus() == SubscriptionStatus.CANCELLED ||
            (latestSub.getExpiryDate() != null && latestSub.getExpiryDate().isBefore(java.time.LocalDateTime.now()))) {
            throw new com.cakeplatform.api.exception.SubscriptionExpiredException("Subscription is " + latestSub.getStatus().name() + ". Please renew to edit your catalog or capacity.");
        }

        return shop;
    }

    /**
     * Domain 5: Compliance & Profile Remediation (PUT /api/shops/my-shop/profile, /api/compliance/**)
     * Allowed: ACTIVE, EXPIRED, OWNER-DISABLED, ADMIN-RESTRICTED, legacy INACTIVE.
     * Blocked: SUSPENDED (403), DELETED (404/403).
     */
    @Transactional(readOnly = true)
    public Shop validateComplianceAccess(Long ownerId) {
        Shop shop = getShopByOwnerId(ownerId);
        if (shop.getStatus() == com.cakeplatform.api.modules.shop.ShopStatus.SUSPENDED) {
            throw new com.cakeplatform.api.exception.SubscriptionExpiredException("Shop is suspended by administration. Profile updates are disabled. Please contact support.");
        }
        return shop;
    }

    /**
     * Domain 6: In-Progress Order Fulfillment Exception (PATCH /api/owner/orders/{id}/status, payment-status)
     * Allowed: ACTIVE, EXPIRED, OWNER-DISABLED, ADMIN-RESTRICTED, legacy INACTIVE, and missing/pending subscription
     *          for legitimate pre-existing orders under strict tenant isolation.
     * Blocked: SUSPENDED (403), DELETED (404/403).
     */
    @Transactional(readOnly = true)
    public Shop validateOrderFulfillmentAccess(Long ownerId) {
        Shop shop = getShopByOwnerId(ownerId);
        if (shop.getStatus() == com.cakeplatform.api.modules.shop.ShopStatus.SUSPENDED) {
            throw new com.cakeplatform.api.exception.SubscriptionExpiredException("Shop is suspended by administration. Order fulfillment is blocked. Please contact support.");
        }
        return shop;
    }

    /**
     * Domain 3: Historical Order Archive (GET /api/owner/orders)
     * Allowed: ACTIVE, EXPIRED, OWNER-DISABLED, ADMIN-RESTRICTED, legacy INACTIVE.
     * Blocked: SUSPENDED (403), DELETED (404/403).
     */
    @Transactional(readOnly = true)
    public Shop validateOrderArchiveAccess(Long ownerId) {
        Shop shop = getShopByOwnerId(ownerId);
        if (shop.getStatus() == com.cakeplatform.api.modules.shop.ShopStatus.SUSPENDED) {
            throw new com.cakeplatform.api.exception.SubscriptionExpiredException("Shop is suspended by administration. Order history access is blocked. Please contact support.");
        }
        return shop;
    }
}
