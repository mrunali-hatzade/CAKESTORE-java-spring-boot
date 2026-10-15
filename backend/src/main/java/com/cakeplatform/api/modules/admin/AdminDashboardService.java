package com.cakeplatform.api.modules.admin;

import com.cakeplatform.api.modules.admin.dto.AdminShopDetailsResponse;
import com.cakeplatform.api.modules.admin.dto.AdminShopSummaryResponse;
import com.cakeplatform.api.modules.admin.dto.DashboardStatsResponse;
import com.cakeplatform.api.modules.audit.ActivityLogRepository;
import com.cakeplatform.api.modules.audit.ActivityLoggerService;
import com.cakeplatform.api.modules.notification.NotificationService;
import com.cakeplatform.api.modules.notification.NotificationType;
import com.cakeplatform.api.modules.order.OrderRepository;
import com.cakeplatform.api.modules.payment.PaymentRepository;
import com.cakeplatform.api.modules.product.ProductRepository;
import com.cakeplatform.api.modules.shop.*;
import com.cakeplatform.api.modules.subscription.SubscriptionRepository;
import com.cakeplatform.api.modules.subscription.SubscriptionStatus;
import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.modules.user.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class AdminDashboardService {

    private final ShopRepository shopRepository;
    private final UserRepository userRepository;
    private final PaymentRepository paymentRepository;
    private final SubscriptionRepository subscriptionRepository;
    private final ActivityLogRepository activityLogRepository;
    private final ProductRepository productRepository;
    private final OrderRepository orderRepository;
    private final ShopStatusManager shopStatusManager;
    private final BusinessDocumentRepository businessDocumentRepository;
    private final NotificationService notificationService;
    private final ActivityLoggerService activityLogger;
    @Autowired(required = false)
    private com.cakeplatform.api.modules.storefront.StorefrontCacheService storefrontCacheService;

    @Autowired
    public AdminDashboardService(
            ShopRepository shopRepository,
            UserRepository userRepository,
            PaymentRepository paymentRepository,
            SubscriptionRepository subscriptionRepository,
            ActivityLogRepository activityLogRepository,
            ProductRepository productRepository,
            OrderRepository orderRepository,
            ShopStatusManager shopStatusManager,
            BusinessDocumentRepository businessDocumentRepository,
            NotificationService notificationService,
            ActivityLoggerService activityLogger) {
        this.shopRepository = shopRepository;
        this.userRepository = userRepository;
        this.paymentRepository = paymentRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.activityLogRepository = activityLogRepository;
        this.productRepository = productRepository;
        this.orderRepository = orderRepository;
        this.shopStatusManager = shopStatusManager;
        this.businessDocumentRepository = businessDocumentRepository;
        this.notificationService = notificationService;
        this.activityLogger = activityLogger;
    }

    // Backwards-compatible constructor for existing test suites
    public AdminDashboardService(
            ShopRepository shopRepository,
            UserRepository userRepository,
            PaymentRepository paymentRepository,
            SubscriptionRepository subscriptionRepository,
            ActivityLogRepository activityLogRepository,
            ProductRepository productRepository,
            OrderRepository orderRepository,
            ShopStatusManager shopStatusManager) {
        this(shopRepository, userRepository, paymentRepository, subscriptionRepository, activityLogRepository,
             productRepository, orderRepository, shopStatusManager, null, null, null);
    }

    @Value("${app.business.default-timezone:Asia/Kolkata}")
    private String configuredTimezone;

    public ZoneId getOperationalZone() {
        try {
            return ZoneId.of(configuredTimezone);
        } catch (Exception e) {
            return ZoneId.of("Asia/Kolkata");
        }
    }

    /**
     * Lightweight method that returns ONLY shop status counts.
     * Runs 3 simple COUNT(*) queries instead of the full analytical aggregation.
     */
    public java.util.Map<String, Long> getShopStatusCounts() {
        long total = shopRepository.count();
        long active = shopRepository.countByStatus(com.cakeplatform.api.modules.shop.ShopStatus.ACTIVE);
        long pending = shopRepository.countByStatus(com.cakeplatform.api.modules.shop.ShopStatus.PENDING);
        long suspended = shopRepository.countByStatus(com.cakeplatform.api.modules.shop.ShopStatus.SUSPENDED);
        long deleted = shopRepository.countDeletedShops();
        return java.util.Map.of(
            "total", total,
            "active", active,
            "pending", pending,
            "suspended", suspended,
            "deleted", deleted
        );
    }

    public java.util.List<com.cakeplatform.api.modules.audit.ActivityLog> getRecentGlobalActivity() {
        return activityLogRepository.findTop50ByEntityTypeInOrderByTimestampDesc(java.util.List.of("SHOP", "SUBSCRIPTION", "PAYMENT", "USER"));
    }

    
    public com.cakeplatform.api.modules.admin.dto.AnalyticsChartResponse getRevenueAnalytics() {
        ZoneId zone = getOperationalZone();
        LocalDate now = LocalDate.now(zone);
        LocalDateTime sixMonthsAgo = now.minusMonths(5).withDayOfMonth(1).atStartOfDay();

        java.util.List<Object[]> saasRows = paymentRepository.getMonthlySubscriptionRevenueSince(sixMonthsAgo);
        java.util.List<Object[]> gmvRows = orderRepository.getMonthlyNetworkGmvSince(sixMonthsAgo);

        java.util.Map<String, java.math.BigDecimal> saasMap = new java.util.LinkedHashMap<>();
        java.util.Map<String, java.math.BigDecimal> gmvMap = new java.util.LinkedHashMap<>();

        java.time.format.DateTimeFormatter periodFmt = java.time.format.DateTimeFormatter.ofPattern("yyyy-MM");
        java.time.format.DateTimeFormatter shortFmt = java.time.format.DateTimeFormatter.ofPattern("MMM");
        java.time.format.DateTimeFormatter longFmt = java.time.format.DateTimeFormatter.ofPattern("MMMM yyyy");

        // Initialize last 6 months in chronological order with zero amounts
        for (int i = 5; i >= 0; i--) {
            LocalDate m = now.minusMonths(i);
            String periodKey = m.format(periodFmt);
            saasMap.put(periodKey, java.math.BigDecimal.ZERO);
            gmvMap.put(periodKey, java.math.BigDecimal.ZERO);
        }

        if (saasRows != null) {
            for (Object[] row : saasRows) {
                if (row != null && row.length >= 2 && row[0] != null) {
                    String periodKey = String.valueOf(row[0]).trim();
                    java.math.BigDecimal amount = parseAggregateAmount(row[1]);
                    if (saasMap.containsKey(periodKey)) {
                        saasMap.put(periodKey, amount);
                    }
                }
            }
        }

        if (gmvRows != null) {
            for (Object[] row : gmvRows) {
                if (row != null && row.length >= 2 && row[0] != null) {
                    String periodKey = String.valueOf(row[0]).trim();
                    java.math.BigDecimal amount = parseAggregateAmount(row[1]);
                    if (gmvMap.containsKey(periodKey)) {
                        gmvMap.put(periodKey, amount);
                    }
                }
            }
        }

        java.util.List<com.cakeplatform.api.modules.admin.dto.RevenueDataPoint> saasList = new java.util.ArrayList<>();
        java.util.List<com.cakeplatform.api.modules.admin.dto.RevenueDataPoint> gmvList = new java.util.ArrayList<>();

        for (int i = 5; i >= 0; i--) {
            LocalDate m = now.minusMonths(i);
            String periodKey = m.format(periodFmt);
            String shortKey = m.format(shortFmt);
            String longKey = m.format(longFmt);
            saasList.add(new com.cakeplatform.api.modules.admin.dto.RevenueDataPoint(shortKey, longKey, saasMap.getOrDefault(periodKey, java.math.BigDecimal.ZERO)));
            gmvList.add(new com.cakeplatform.api.modules.admin.dto.RevenueDataPoint(shortKey, longKey, gmvMap.getOrDefault(periodKey, java.math.BigDecimal.ZERO)));
        }

        com.cakeplatform.api.modules.admin.dto.AnalyticsChartResponse res = new com.cakeplatform.api.modules.admin.dto.AnalyticsChartResponse();
        res.setSaasRevenue(saasList);
        res.setNetworkGmv(gmvList);
        return res;
    }

    private java.math.BigDecimal parseAggregateAmount(Object value) {
        if (value == null) {
            return java.math.BigDecimal.ZERO;
        }
        if (value instanceof java.math.BigDecimal) {
            return (java.math.BigDecimal) value;
        }
        if (value instanceof Number) {
            return java.math.BigDecimal.valueOf(((Number) value).doubleValue());
        }
        try {
            return new java.math.BigDecimal(value.toString().trim());
        } catch (Exception e) {
            return java.math.BigDecimal.ZERO;
        }
    }

    public DashboardStatsResponse getPlatformStats(LocalDate startDate, LocalDate endDate) {
        DashboardStatsResponse stats = new DashboardStatsResponse();
        
        ZoneId zone = getOperationalZone();
        LocalDateTime startOfDay = LocalDate.now(zone).atStartOfDay();
        LocalDateTime startOfMonth = LocalDate.now(zone).withDayOfMonth(1).atStartOfDay();

        stats.setStartDate(startDate);
        stats.setEndDate(endDate);

        // 1. Snapshot Metrics (NEVER change based on date filter)
        stats.setTotalUsers(userRepository.count());
        stats.setTotalAdmins(userRepository.countByRole(com.cakeplatform.api.modules.user.UserRole.ADMIN));
        stats.setTotalShopOwners(userRepository.countByRole(com.cakeplatform.api.modules.user.UserRole.SHOP_OWNER));
        stats.setTotalCustomers(userRepository.countByRole(com.cakeplatform.api.modules.user.UserRole.CUSTOMER));
        stats.setDeletedAccounts(userRepository.countDeletedUsers());

        stats.setTotalRegisteredBakeries(shopRepository.count());
        stats.setActiveBakeries(shopRepository.countByStatus(ShopStatus.ACTIVE));
        stats.setVerifiedBakeries(shopRepository.countByVerificationStatus(com.cakeplatform.api.modules.shop.VerificationStatus.VERIFIED));
        stats.setSuspendedBakeries(shopRepository.countByStatus(ShopStatus.SUSPENDED));
        stats.setInactiveBakeries(shopRepository.countByStatus(ShopStatus.INACTIVE));
        stats.setPendingBakeries(shopRepository.countByStatus(ShopStatus.PENDING));
        stats.setExpiredBakeries(shopRepository.countByStatus(ShopStatus.EXPIRED));
        stats.setDeletedBakeries(shopRepository.countDeletedShops());

        stats.setTotalSubscriptions(subscriptionRepository.count());
        stats.setActiveSubscribedBakeries(subscriptionRepository.countUniqueShopsByStatus(SubscriptionStatus.ACTIVE));
        stats.setExpiringSoonSubscribedBakeries(subscriptionRepository.countUniqueShopsByStatusExcludingActive(SubscriptionStatus.EXPIRING_SOON));
        stats.setGracePeriodSubscribedBakeries(subscriptionRepository.countUniqueShopsByStatusExcludingActive(SubscriptionStatus.GRACE_PERIOD));
        stats.setPendingPaymentBakeries(shopRepository.countBakeriesAwaitingInitialSubscription());
        stats.setExpiredSubscribedBakeries(subscriptionRepository.countUniqueShopsByStatusExcludingActive(SubscriptionStatus.EXPIRED));
        stats.setSuspendedSubscribedBakeries(subscriptionRepository.countUniqueShopsByStatusExcludingActive(SubscriptionStatus.SUSPENDED));
        stats.setCancelledSubscribedBakeries(subscriptionRepository.countUniqueShopsByStatusExcludingActive(SubscriptionStatus.CANCELLED));

        // 2. Daily Counters (Always reflect today in the operational timezone)
        LocalDateTime todayStart = startOfDay;
        LocalDateTime todayEnd = startOfDay.plusDays(1).minusNanos(1);
        stats.setTodayRegistrations(userRepository.countByCreatedAtBetween(todayStart, todayEnd));
        stats.setTodayPayments(paymentRepository.countCompletedPaymentsBetween(todayStart, todayEnd));

        // 3. Lifetime Metrics (Cumulative across all time)
        BigDecimal totalSubRev = paymentRepository.getTotalRevenue();
        stats.setTotalPlatformRevenue(totalSubRev != null ? totalSubRev : BigDecimal.ZERO);

        BigDecimal totalGmv = orderRepository.sumTotalRealizedRevenue();
        stats.setTotalGmv(totalGmv != null ? totalGmv : BigDecimal.ZERO);

        // 4. Period Metrics (Affected by date filter)
        boolean isAllTime = (startDate == null && endDate == null);
        BigDecimal periodSubRev;
        BigDecimal periodGmv;

        if (isAllTime) {
            // When no date filter is passed, All Time returns genuine lifetime totals
            periodSubRev = stats.getTotalPlatformRevenue();
            periodGmv = stats.getTotalGmv();
        } else {
            LocalDateTime periodStart;
            LocalDateTime periodEnd;
            if (startDate != null && endDate != null) {
                periodStart = startDate.atStartOfDay(zone).toLocalDateTime();
                periodEnd = endDate.atTime(23, 59, 59, 999999999).atZone(zone).toLocalDateTime();
            } else if (startDate != null) {
                periodStart = startDate.atStartOfDay(zone).toLocalDateTime();
                periodEnd = LocalDate.now(zone).atTime(23, 59, 59, 999999999).atZone(zone).toLocalDateTime();
            } else {
                periodStart = LocalDate.of(2020, 1, 1).atStartOfDay();
                periodEnd = endDate.atTime(23, 59, 59, 999999999).atZone(zone).toLocalDateTime();
            }

            BigDecimal querySubRev = paymentRepository.getRevenueBetween(periodStart, periodEnd);
            periodSubRev = querySubRev != null ? querySubRev : BigDecimal.ZERO;

            BigDecimal queryGmv = orderRepository.sumRealizedRevenueBetween(periodStart, periodEnd);
            periodGmv = queryGmv != null ? queryGmv : BigDecimal.ZERO;
        }

        stats.setMonthlyPlatformRevenue(periodSubRev);
        stats.setPeriodPlatformRevenue(periodSubRev);

        stats.setMonthlyGmv(periodGmv);
        stats.setPeriodGmv(periodGmv);

        return stats;
    }

    public org.springframework.data.domain.Page<AdminShopSummaryResponse> getAllShops(
            org.springframework.data.domain.Pageable pageable, 
            String search, 
            String status) {
        
        boolean fetchDeleted = false;
        ShopStatus shopStatus = null;
        if (status != null && !status.trim().isEmpty() && !status.equalsIgnoreCase("ALL")) {
            if (status.equalsIgnoreCase("DELETED")) {
                fetchDeleted = true;
            } else {
                try {
                    shopStatus = ShopStatus.valueOf(status.toUpperCase());
                } catch (IllegalArgumentException e) {
                    // Ignore invalid status
                }
            }
        }
        
        String searchQuery = (search != null && !search.trim().isEmpty()) ? search.trim() : "";

        if (fetchDeleted) {
            return shopRepository.searchAndFilterDeletedShopsProjection(searchQuery, pageable).map(proj -> {
                AdminShopSummaryResponse summary = new AdminShopSummaryResponse();
                summary.setShopId(proj.getShopId());
                summary.setBusinessName(proj.getBusinessName());
                summary.setShopStatus("DELETED");
                summary.setRegisteredAt(proj.getRegisteredAt());
                summary.setOwnerName(proj.getOwnerName());
                summary.setOwnerEmail(proj.getOwnerEmail());
                
                com.cakeplatform.api.modules.subscription.Subscription lastSub = subscriptionRepository.findFirstByShopIdOrderByCreatedAtDesc(proj.getShopId()).orElse(null);
                summary.setSubscriptionStatus(lastSub != null ? lastSub.getStatus().name() : "NONE");
                summary.setIsOwnerEnabled(false);
                summary.setIsMarketplaceRestricted(false);
                
                return summary;
            });
        }

        return shopRepository.searchAndFilterAllShops(shopStatus, searchQuery, pageable).map(shop -> {
            AdminShopSummaryResponse summary = new AdminShopSummaryResponse();
            summary.setShopId(shop.getId());
            summary.setBusinessName(shop.getBusinessName());
            summary.setShopStatus(shop.getStatus() != null ? shop.getStatus().name() : "UNKNOWN");
            summary.setRegisteredAt(shop.getCreatedAt());
            summary.setIsOwnerEnabled(shop.getIsOwnerEnabled());
            summary.setIsMarketplaceRestricted(shop.getIsMarketplaceRestricted());

            
            com.cakeplatform.api.modules.user.User owner = shop.getOwner();
            if (owner != null) {
                summary.setOwnerName(owner.getFullName());
                summary.setOwnerEmail(owner.getEmail());
            }
            
            com.cakeplatform.api.modules.subscription.Subscription lastSub = subscriptionRepository.findFirstByShopIdOrderByCreatedAtDesc(shop.getId()).orElse(null);
            summary.setSubscriptionStatus(lastSub != null ? lastSub.getStatus().name() : "NONE");

            return summary;

        });
    }

    public AdminShopDetailsResponse getShopDetails(Long shopId) {
        Shop shop = shopRepository.findByIdIncludingDeleted(shopId)
                .orElseThrow(() -> new RuntimeException("Shop not found with id: " + shopId));

        AdminShopDetailsResponse details = new AdminShopDetailsResponse();
        details.setShop(shop);
        details.setSubscriptions(subscriptionRepository.findByShopId(shopId));
        details.setPayments(paymentRepository.findSubscriptionPaymentsByShopId(shopId));
        details.setActivityLogs(activityLogRepository.findByShopIdAndEntityTypeInOrderByTimestampDesc(shopId, java.util.List.of("SHOP", "SUBSCRIPTION", "PAYMENT")));
        details.setBusinessDocuments(businessDocumentRepository.findByShopId(shopId));
        details.setTotalProducts(productRepository.countByShopId(shopId));
        details.setTotalOrders(orderRepository.countByShopId(shopId));

        ZoneId zone = getOperationalZone();
        LocalDate today = LocalDate.now(zone);
        LocalDateTime startOfMonth = today.withDayOfMonth(1).atStartOfDay();
        LocalDateTime startOfWeek = today.minusDays(today.getDayOfWeek().getValue() - 1).atStartOfDay();

        BigDecimal totalRev = orderRepository.sumRevenueByShopId(shopId);
        details.setTotalRevenue(totalRev != null ? totalRev : BigDecimal.ZERO);

        List<com.cakeplatform.api.modules.order.Order> recentOrders = orderRepository.findRecentRealizedOrders(shopId, startOfMonth);
        BigDecimal monthlyRev = BigDecimal.ZERO;
        BigDecimal weeklyRev = BigDecimal.ZERO;
        if (recentOrders != null) {
            for (com.cakeplatform.api.modules.order.Order o : recentOrders) {
                if (o.getTotalAmount() != null) {
                    monthlyRev = monthlyRev.add(o.getTotalAmount());
                    if (o.getCreatedAt() != null && !o.getCreatedAt().isBefore(startOfWeek)) {
                        weeklyRev = weeklyRev.add(o.getTotalAmount());
                    }
                }
            }
        }
        details.setMonthlyRevenue(monthlyRev);
        details.setWeeklyRevenue(weeklyRev);

        long completed = orderRepository.countByShopIdAndOrderStatus(shopId, "COMPLETED")
                + orderRepository.countByShopIdAndOrderStatus(shopId, "DELIVERED");
        details.setCompletedOrders(completed);
        details.setCancelledOrders(orderRepository.countByShopIdAndOrderStatus(shopId, "CANCELLED"));

        return details;
    }

    @Transactional
    public Shop updateMarketplaceRestriction(Long shopId, boolean restricted, String reason, Long actorUserId) {
        Shop shop = shopRepository.findById(shopId)
                .orElseThrow(() -> new RuntimeException("Shop not found with id: " + shopId));

        if (restricted) {
            if (reason == null || reason.trim().isEmpty()) {
                throw new IllegalArgumentException("Marketplace restriction reason is mandatory and cannot be blank");
            }
            shop.setIsMarketplaceRestricted(true);
            shop.setMarketplaceRestrictionReason(reason.trim());

            shop = shopRepository.save(shop);

            // Audit log
            if (activityLogger != null) {
                activityLogger.logActivity(
                        actorUserId,
                        shopId,
                        "MARKETPLACE_RESTRICTION_APPLIED",
                        "SHOP",
                        shopId,
                        "Admin applied marketplace restriction. Reason: " + reason.trim()
                );
            }

            // Notify owner
            if (notificationService != null && shop.getOwner() != null) {
                User owner = userRepository.findById(shop.getOwner().getId()).orElse(shop.getOwner());
                if (owner != null) {
                    notificationService.createNotification(
                            owner,
                            NotificationType.ADMIN_MESSAGE,
                            "Bakery Marketplace Restriction Applied",
                            "Your bakery has been temporarily restricted from the marketplace. Reason: " + reason.trim(),
                            shopId.toString(),
                            true
                    );
                }
            }
        } else {
            shop.setIsMarketplaceRestricted(false);
            shop.setMarketplaceRestrictionReason(null);

            shop = shopRepository.save(shop);

            // Audit log
            if (activityLogger != null) {
                activityLogger.logActivity(
                        actorUserId,
                        shopId,
                        "MARKETPLACE_RESTRICTION_LIFTED",
                        "SHOP",
                        shopId,
                        "Admin lifted marketplace restriction"
                );
            }

            // Notify owner
            if (notificationService != null && shop.getOwner() != null) {
                User owner = userRepository.findById(shop.getOwner().getId()).orElse(shop.getOwner());
                if (owner != null) {
                    notificationService.createNotification(
                            owner,
                            NotificationType.ADMIN_MESSAGE,
                            "Bakery Marketplace Restriction Lifted",
                            "The temporary marketplace restriction on your bakery has been lifted.",
                            shopId.toString(),
                            true
                    );
                }
            }
        }

        if (storefrontCacheService != null) {
            storefrontCacheService.evictShopDetails(shopId);
            storefrontCacheService.evictShopProducts(shopId);
        }

        return shop;
    }

    @Transactional
    public Shop updateShopStatus(Long shopId, String status, String reason, Long actorUserId) {
        if ("SUSPENDED".equals(status)) {
            if (reason == null || reason.trim().isEmpty()) {
                throw new IllegalArgumentException("Suspension reason is mandatory and cannot be blank");
            }
            shopStatusManager.suspendShop(shopId, actorUserId, reason.trim());
        } else if ("ACTIVE".equals(status)) {
            // Admin forcefully re-activating a shop
            shopStatusManager.activateShop(shopId, actorUserId);
        } else if ("INACTIVE".equals(status)) {
            shopStatusManager.markShopInactive(shopId, actorUserId);
        }
        if (storefrontCacheService != null) {
            storefrontCacheService.evictShopDetails(shopId);
            storefrontCacheService.evictShopProducts(shopId);
        }
        return shopRepository.findById(shopId).orElseThrow();
    }

    @Transactional
    public Shop updateShopStatus(Long shopId, String status, Long actorUserId) {
        if ("SUSPENDED".equals(status)) {
            shopStatusManager.suspendShop(shopId, actorUserId);
            return shopRepository.findById(shopId).orElseThrow();
        }
        return updateShopStatus(shopId, status, null, actorUserId);
    }

    @Transactional
    public Shop updateShopStatus(Long shopId, String status) {
        return updateShopStatus(shopId, status, null, null);
    }

    @Transactional
    public Shop reviewShopVerification(Long shopId, String action, String reason, Long actorUserId) {
        Shop shop = shopRepository.findById(shopId)
                .orElseThrow(() -> new RuntimeException("Shop not found with id: " + shopId));

        if (action == null || (!action.equalsIgnoreCase("APPROVE") && !action.equalsIgnoreCase("REJECT") && !action.equalsIgnoreCase("MARK_UNDER_REVIEW"))) {
            throw new IllegalArgumentException("Invalid verification action: " + action + ". Must be APPROVE, REJECT, or MARK_UNDER_REVIEW.");
        }

        List<BusinessDocument> docs = businessDocumentRepository.findByShopId(shopId);

        if (action.equalsIgnoreCase("APPROVE")) {
            shop.setVerificationStatus(VerificationStatus.VERIFIED);
            
            // Idempotent safety reconciliation: if shop was still PENDING despite an active subscription, activate it
            if (shop.getStatus() == ShopStatus.PENDING && subscriptionRepository != null) {
                subscriptionRepository.findFirstByShopIdAndStatusOrderByCreatedAtDesc(
                        shopId, com.cakeplatform.api.modules.subscription.SubscriptionStatus.ACTIVE)
                        .ifPresent(sub -> {
                            if (sub.getExpiryDate() == null || sub.getExpiryDate().isAfter(java.time.LocalDateTime.now())) {
                                shop.setStatus(ShopStatus.ACTIVE);
                            }
                        });
            }

            shopRepository.save(shop);

            for (BusinessDocument doc : docs) {
                doc.setStatus(VerificationStatus.VERIFIED);
                businessDocumentRepository.save(doc);
            }

            activityLogger.logActivity(
                    actorUserId,
                    shopId,
                    "KYC_VERIFIED",
                    "SHOP",
                    shopId,
                    "Bakery KYC verified by admin"
            );

            if (shop.getOwner() != null) {
                notificationService.createNotification(
                        shop.getOwner(),
                        NotificationType.DOCUMENT_VERIFICATION,
                        "Bakery Verified",
                        "Congratulations! Your bakery verification has been approved. Your storefront is now verified on CakeStore.",
                        shop.getId().toString(),
                        true
                );
            }
        } else if (action.equalsIgnoreCase("REJECT")) {
            // REJECT
            if (reason == null || reason.trim().isEmpty()) {
                throw new IllegalArgumentException("Rejection reason is mandatory and cannot be blank");
            }
            String trimmedReason = reason.trim();

            shop.setVerificationStatus(VerificationStatus.REJECTED);
            shopRepository.save(shop);

            for (BusinessDocument doc : docs) {
                doc.setStatus(VerificationStatus.REJECTED);
                businessDocumentRepository.save(doc);
            }

            activityLogger.logActivity(
                    actorUserId,
                    shopId,
                    "KYC_REJECTED",
                    "SHOP",
                    shopId,
                    "Rejection reason: " + trimmedReason
            );

            if (shop.getOwner() != null) {
                notificationService.createNotification(
                        shop.getOwner(),
                        NotificationType.DOCUMENT_VERIFICATION,
                        "Verification Rejected",
                        "Your bakery KYC verification was rejected. Reason: " + trimmedReason + ". Please upload updated documents in your compliance settings.",
                        shop.getId().toString(),
                        true
                );
            }
        } else if (action.equalsIgnoreCase("MARK_UNDER_REVIEW")) {
            // MARK_UNDER_REVIEW
            shop.setVerificationStatus(VerificationStatus.PROCESSING);
            shopRepository.save(shop);

            // Do NOT change document statuses; they remain as-is

            activityLogger.logActivity(
                    actorUserId,
                    shopId,
                    "KYC_UNDER_REVIEW",
                    "SHOP",
                    shopId,
                    "Admin marked bakery KYC as under review"
            );
            // No owner notification for under review reset
        }

        if (storefrontCacheService != null) {
            storefrontCacheService.evictShopDetails(shopId);
        }

        return shop;
    }
}
