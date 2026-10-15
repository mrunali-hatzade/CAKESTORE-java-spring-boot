package com.cakeplatform.api.modules.admin;

import com.cakeplatform.api.modules.admin.dto.AdminShopSummaryResponse;
import com.cakeplatform.api.modules.admin.dto.AdminShopSummaryProjection;
import com.cakeplatform.api.modules.admin.dto.DashboardStatsResponse;
import com.cakeplatform.api.modules.shop.Shop;
import com.cakeplatform.api.modules.shop.ShopRepository;
import com.cakeplatform.api.modules.shop.ShopStatus;
import com.cakeplatform.api.modules.subscription.Subscription;
import com.cakeplatform.api.modules.subscription.SubscriptionRepository;
import com.cakeplatform.api.modules.subscription.SubscriptionStatus;
import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.modules.user.UserRepository;
import com.cakeplatform.api.modules.user.UserRole;
import com.cakeplatform.api.modules.payment.PaymentRepository;
import com.cakeplatform.api.modules.order.OrderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
public class Day3AdminGovernanceTest {

    @Mock private ShopRepository shopRepository;
    @Mock private UserRepository userRepository;
    @Mock private PaymentRepository paymentRepository;
    @Mock private SubscriptionRepository subscriptionRepository;
    @Mock private OrderRepository orderRepository;

    @InjectMocks
    private AdminDashboardService adminDashboardService;

    @BeforeEach
    void setUp() {
        org.springframework.test.util.ReflectionTestUtils.setField(adminDashboardService, "configuredTimezone", "Asia/Kolkata");
    }

    @Test
    @DisplayName("Day 3: Dashboard stats returns comprehensive platform user metrics including soft-deleted counts")
    void testDashboardStats_UserMetrics() {
        when(userRepository.count()).thenReturn(100L);
        when(userRepository.countByRole(UserRole.ADMIN)).thenReturn(2L);
        when(userRepository.countByRole(UserRole.SHOP_OWNER)).thenReturn(30L);
        when(userRepository.countByRole(UserRole.CUSTOMER)).thenReturn(68L);
        when(userRepository.countDeletedUsers()).thenReturn(5L);

        DashboardStatsResponse stats = adminDashboardService.getPlatformStats(null, null);

        assertEquals(100L, stats.getTotalUsers());
        assertEquals(2L, stats.getTotalAdmins());
        assertEquals(30L, stats.getTotalShopOwners());
        assertEquals(68L, stats.getTotalCustomers());
        assertEquals(5L, stats.getDeletedAccounts());
    }

    @Test
    @DisplayName("Day 3: Dashboard stats returns comprehensive shop metrics including deleted shops")
    void testDashboardStats_ShopMetrics() {
        when(shopRepository.count()).thenReturn(50L);
        when(shopRepository.countByStatus(ShopStatus.ACTIVE)).thenReturn(20L);
        when(shopRepository.countByStatus(ShopStatus.PENDING)).thenReturn(5L);
        when(shopRepository.countByStatus(ShopStatus.SUSPENDED)).thenReturn(2L);
        when(shopRepository.countByStatus(ShopStatus.INACTIVE)).thenReturn(10L);
        when(shopRepository.countByStatus(ShopStatus.EXPIRED)).thenReturn(3L);
        when(shopRepository.countDeletedShops()).thenReturn(10L);

        DashboardStatsResponse stats = adminDashboardService.getPlatformStats(null, null);

        assertEquals(50L, stats.getTotalRegisteredBakeries());
        assertEquals(20L, stats.getActiveBakeries());
        assertEquals(5L, stats.getPendingBakeries());
        assertEquals(2L, stats.getSuspendedBakeries());
        assertEquals(10L, stats.getInactiveBakeries());
        assertEquals(3L, stats.getExpiredBakeries());
        assertEquals(10L, stats.getDeletedBakeries());
    }

    @Test
    @DisplayName("Day 3: Dashboard stats returns comprehensive subscription metrics excluding active intersections")
    void testDashboardStats_SubscriptionMetrics() {
        when(subscriptionRepository.countUniqueShopsByStatus(SubscriptionStatus.ACTIVE)).thenReturn(20L);
        when(subscriptionRepository.countUniqueShopsByStatusExcludingActive(SubscriptionStatus.EXPIRING_SOON)).thenReturn(5L);
        when(subscriptionRepository.countUniqueShopsByStatusExcludingActive(SubscriptionStatus.GRACE_PERIOD)).thenReturn(2L);
        when(subscriptionRepository.countUniqueShopsByStatusExcludingActive(SubscriptionStatus.PENDING)).thenReturn(1L);
        when(shopRepository.countBakeriesAwaitingInitialSubscription()).thenReturn(1L);
        when(subscriptionRepository.countUniqueShopsByStatusExcludingActive(SubscriptionStatus.EXPIRED)).thenReturn(8L);
        when(subscriptionRepository.countUniqueShopsByStatusExcludingActive(SubscriptionStatus.SUSPENDED)).thenReturn(3L);
        when(subscriptionRepository.countUniqueShopsByStatusExcludingActive(SubscriptionStatus.CANCELLED)).thenReturn(4L);

        DashboardStatsResponse stats = adminDashboardService.getPlatformStats(null, null);

        assertEquals(20L, stats.getActiveSubscribedBakeries());
        assertEquals(5L, stats.getExpiringSoonSubscribedBakeries());
        assertEquals(2L, stats.getGracePeriodSubscribedBakeries());
        assertEquals(1L, stats.getPendingPaymentBakeries());
        assertEquals(8L, stats.getExpiredSubscribedBakeries());
        assertEquals(3L, stats.getSuspendedSubscribedBakeries());
        assertEquals(4L, stats.getCancelledSubscribedBakeries());
    }

    @Test
    @DisplayName("Day 3: Admin bakery list fetches deleted bakeries when status DELETED is provided")
    void testGetAllShops_DeletedStatus() {
        AdminShopSummaryProjection proj = new AdminShopSummaryProjection() {
            @Override public Long getShopId() { return 99L; }
            @Override public String getBusinessName() { return "Deleted Bakery"; }
            @Override public String getOwnerName() { return "John Doe"; }
            @Override public String getOwnerEmail() { return "deleted_123@deleted.com"; }
            @Override public String getShopStatus() { return "ACTIVE"; } // It was active before deletion
            @Override public java.time.LocalDateTime getRegisteredAt() { return java.time.LocalDateTime.now(); }
        };

        Page<AdminShopSummaryProjection> page = new PageImpl<>(List.of(proj));
        when(shopRepository.searchAndFilterDeletedShopsProjection(anyString(), any(Pageable.class))).thenReturn(page);
        when(subscriptionRepository.findFirstByShopIdOrderByCreatedAtDesc(99L)).thenReturn(Optional.empty());

        Page<AdminShopSummaryResponse> result = adminDashboardService.getAllShops(PageRequest.of(0, 10), "", "DELETED");

        assertNotNull(result);
        assertEquals(1, result.getContent().size());
        assertEquals("Deleted Bakery", result.getContent().get(0).getBusinessName());
        assertEquals("DELETED", result.getContent().get(0).getShopStatus());
        assertEquals("John Doe", result.getContent().get(0).getOwnerName());
        assertEquals("deleted_123@deleted.com", result.getContent().get(0).getOwnerEmail());
        assertEquals(false, result.getContent().get(0).getIsOwnerEnabled());
        assertEquals(false, result.getContent().get(0).getIsMarketplaceRestricted());
        
        verify(shopRepository).searchAndFilterDeletedShopsProjection(anyString(), any(Pageable.class));
        verify(shopRepository, never()).searchAndFilterAllShops(any(), any(), any());
    }

    @Test
    @DisplayName("Day 3: Admin bakery list correctly populates isOwnerEnabled and isMarketplaceRestricted for active shops")
    void testGetAllShops_ActiveShopPopulatesOperationalFlags() {
        Shop activeShop = new Shop();
        activeShop.setId(10L);
        activeShop.setBusinessName("Operational Bakery");
        activeShop.setStatus(ShopStatus.ACTIVE);
        activeShop.setIsOwnerEnabled(true);
        activeShop.setIsMarketplaceRestricted(false);
        activeShop.setCreatedAt(LocalDateTime.now());

        User owner = new User();
        owner.setId(20L);
        owner.setFullName("Alice Baker");
        owner.setEmail("alice@baker.com");
        activeShop.setOwner(owner);

        Subscription activeSub = new Subscription();
        activeSub.setId(50L);
        activeSub.setStatus(SubscriptionStatus.ACTIVE);
        activeSub.setShop(activeShop);

        Page<Shop> page = new PageImpl<>(List.of(activeShop));
        when(shopRepository.searchAndFilterAllShops(eq(ShopStatus.ACTIVE), anyString(), any(Pageable.class))).thenReturn(page);
        when(subscriptionRepository.findFirstByShopIdOrderByCreatedAtDesc(10L)).thenReturn(Optional.of(activeSub));

        Page<AdminShopSummaryResponse> result = adminDashboardService.getAllShops(PageRequest.of(0, 10), "", "ACTIVE");

        assertNotNull(result);
        assertEquals(1, result.getContent().size());
        AdminShopSummaryResponse item = result.getContent().get(0);
        assertEquals("Operational Bakery", item.getBusinessName());
        assertEquals("ACTIVE", item.getShopStatus());
        assertEquals("ACTIVE", item.getSubscriptionStatus());
        assertEquals(true, item.getIsOwnerEnabled());
        assertEquals(false, item.getIsMarketplaceRestricted());
        assertEquals("Alice Baker", item.getOwnerName());
        assertEquals("alice@baker.com", item.getOwnerEmail());
    }

    @Test
    @DisplayName("Day 3: Snapshot Metrics do NOT change based on analytics date filters")
    void testDashboardStats_DateFilterSemantics() {
        when(userRepository.count()).thenReturn(100L);
        when(shopRepository.count()).thenReturn(50L);
        
        LocalDate startDate = LocalDate.of(2023, 1, 1);
        LocalDate endDate = LocalDate.of(2023, 1, 31);
        
        DashboardStatsResponse stats = adminDashboardService.getPlatformStats(startDate, endDate);
        
        assertEquals(100L, stats.getTotalUsers());
        assertEquals(50L, stats.getTotalRegisteredBakeries());
        
        verify(userRepository).count();
        verify(shopRepository).count();
    }
}
