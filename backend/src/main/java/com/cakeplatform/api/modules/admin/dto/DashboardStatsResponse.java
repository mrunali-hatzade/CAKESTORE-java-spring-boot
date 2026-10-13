package com.cakeplatform.api.modules.admin.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class DashboardStatsResponse {
    // 1. Users
    private long totalUsers;
    private long totalAdmins;
    private long totalShopOwners;
    private long totalCustomers;
    private long deletedAccounts;

    // 2. Bakeries
    private long totalRegisteredBakeries;
    private long activeBakeries;
    private long verifiedBakeries;
    private long suspendedBakeries;
    private long inactiveBakeries;
    private long pendingBakeries;
    private long expiredBakeries;
    private long deletedBakeries;
    
    // 3. Subscriptions
    private long totalSubscriptions;
    private long activeSubscribedBakeries;
    private long expiringSoonSubscribedBakeries;
    private long gracePeriodSubscribedBakeries;
    private long pendingPaymentBakeries;
    private long expiredSubscribedBakeries;
    private long suspendedSubscribedBakeries;
    private long cancelledSubscribedBakeries;

    // Financials & Others
    private long todayRegistrations;
    private long todayPayments;
    private BigDecimal monthlyPlatformRevenue;
    private BigDecimal totalPlatformRevenue;
    private BigDecimal monthlyGmv;
    private BigDecimal totalGmv;
    
    // Semantic aliases for date-filtered period metrics
    private BigDecimal periodPlatformRevenue;
    private BigDecimal periodGmv;
    
    private LocalDate startDate;
    private LocalDate endDate;
}
