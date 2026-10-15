package com.cakeplatform.api.modules.admin;

import com.cakeplatform.api.modules.admin.dto.DashboardStatsResponse;
import com.cakeplatform.api.modules.audit.ActivityLog;
import com.cakeplatform.api.modules.audit.ActivityLogRepository;
import com.cakeplatform.api.modules.audit.ActivityLoggerService;
import com.cakeplatform.api.modules.notification.NotificationService;
import com.cakeplatform.api.modules.notification.NotificationType;
import com.cakeplatform.api.modules.order.OrderRepository;
import com.cakeplatform.api.modules.payment.PaymentRepository;
import com.cakeplatform.api.modules.product.ProductRepository;
import com.cakeplatform.api.modules.shop.*;
import com.cakeplatform.api.modules.shop.dto.DocumentUploadRequest;
import com.cakeplatform.api.modules.shop.service.VerificationService;
import com.cakeplatform.api.modules.subscription.SubscriptionRepository;
import com.cakeplatform.api.modules.subscription.SubscriptionStatus;
import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.modules.user.UserRepository;
import com.cakeplatform.api.modules.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class StageBAdminOperationsTest {

    @Mock private ShopRepository shopRepository;
    @Mock private UserRepository userRepository;
    @Mock private PaymentRepository paymentRepository;
    @Mock private SubscriptionRepository subscriptionRepository;
    @Mock private ActivityLogRepository activityLogRepository;
    @Mock private ProductRepository productRepository;
    @Mock private OrderRepository orderRepository;
    @Mock private ShopStatusManager shopStatusManager;
    @Mock private BusinessDocumentRepository businessDocumentRepository;
    @Mock private NotificationService notificationService;
    @Mock private ActivityLoggerService activityLogger;
    @Mock private com.cakeplatform.api.modules.notification.AdminNotificationService adminNotificationService;

    private AdminDashboardService adminDashboardService;
    private VerificationService verificationService;
    private Shop testShop;
    private User testOwner;
    private BusinessDocument testDoc;

    @BeforeEach
    void setUp() {
        adminDashboardService = new AdminDashboardService(
                shopRepository,
                userRepository,
                paymentRepository,
                subscriptionRepository,
                activityLogRepository,
                productRepository,
                orderRepository,
                shopStatusManager,
                businessDocumentRepository,
                notificationService,
                activityLogger
        );
        ReflectionTestUtils.setField(adminDashboardService, "configuredTimezone", "Asia/Kolkata");

        verificationService = new VerificationService(
                shopRepository,
                businessDocumentRepository,
                activityLogRepository,
                adminNotificationService
        );

        testOwner = new User();
        testOwner.setId(100L);
        testOwner.setEmail("owner@artisanbakes.com");
        testOwner.setFullName("Baker Priya");
        testOwner.setRole(UserRole.SHOP_OWNER);

        testShop = new Shop();
        testShop.setId(10L);
        testShop.setBusinessName("Artisan Bakes Pune");
        testShop.setOwner(testOwner);
        testShop.setStatus(ShopStatus.ACTIVE);
        testShop.setVerificationStatus(VerificationStatus.PROCESSING);

        testDoc = new BusinessDocument();
        testDoc.setId(50L);
        testDoc.setShop(testShop);
        testDoc.setDocumentType(DocumentType.FSSAI_CERTIFICATE);
        testDoc.setFileUrl("https://storage.cakestore.in/docs/fssai.pdf");
        testDoc.setStatus(VerificationStatus.PROCESSING);
    }

    // =========================================================================
    // B1 Ã¢â‚¬â€ ADMIN DASHBOARD INTELLIGENCE TESTS
    // =========================================================================

    @Test
    @DisplayName("B1.1: Dashboard stats returns all required granular metrics")
    void testB1_DashboardStats_AllMetricsReturned() {
        when(shopRepository.count()).thenReturn(20L);
        when(shopRepository.countByStatus(ShopStatus.ACTIVE)).thenReturn(12L);
        when(shopRepository.countByStatus(ShopStatus.SUSPENDED)).thenReturn(2L);
        when(shopRepository.countByStatus(ShopStatus.INACTIVE)).thenReturn(3L);
        when(shopRepository.countByStatus(ShopStatus.PENDING)).thenReturn(3L);
        when(userRepository.countByRole(com.cakeplatform.api.modules.user.UserRole.ADMIN)).thenReturn(50L);
        when(userRepository.countByRole(com.cakeplatform.api.modules.user.UserRole.SHOP_OWNER)).thenReturn(20L);
        when(userRepository.countByRole(com.cakeplatform.api.modules.user.UserRole.CUSTOMER)).thenReturn(300L);
        when(userRepository.countByCreatedAtBetween(any(LocalDateTime.class), any(LocalDateTime.class))).thenReturn(5L);
        when(subscriptionRepository.count()).thenReturn(18L);
        when(subscriptionRepository.countUniqueShopsByStatus(SubscriptionStatus.ACTIVE)).thenReturn(12L);
        when(subscriptionRepository.countUniqueShopsByStatusExcludingActive(SubscriptionStatus.EXPIRED)).thenReturn(4L);
        when(paymentRepository.countCompletedPaymentsBetween(any(LocalDateTime.class), any(LocalDateTime.class))).thenReturn(3L);
        when(paymentRepository.getRevenueBetween(any(LocalDateTime.class), any(LocalDateTime.class))).thenReturn(new BigDecimal("45000.00"));
        when(paymentRepository.getTotalRevenue()).thenReturn(new BigDecimal("120000.00"));

        DashboardStatsResponse stats = adminDashboardService.getPlatformStats(null, null);

        assertNotNull(stats);
        assertEquals(20L, stats.getTotalRegisteredBakeries());
        assertEquals(12L, stats.getActiveBakeries());
        assertEquals(2L, stats.getSuspendedBakeries());
        assertEquals(3L, stats.getInactiveBakeries());
        assertEquals(3L, stats.getPendingBakeries());
        assertEquals(50L, stats.getTotalAdmins());
        assertEquals(300L, stats.getTotalCustomers());
        assertEquals(5L, stats.getTodayRegistrations());
        assertEquals(18L, stats.getTotalSubscriptions());
        assertEquals(12L, stats.getActiveSubscribedBakeries());
        assertEquals(4L, stats.getExpiredSubscribedBakeries());
        assertEquals(3L, stats.getTodayPayments());
        assertEquals(new BigDecimal("120000.00"), stats.getMonthlyPlatformRevenue());
        assertEquals(new BigDecimal("120000.00"), stats.getTotalPlatformRevenue());
    }

    @Test
    @DisplayName("B1.2: Inactive shops counted via ShopStatus.INACTIVE without conflating SUSPENDED")
    void testB1_InactiveShopsCountedCorrectly() {
        when(shopRepository.countByStatus(ShopStatus.INACTIVE)).thenReturn(7L);
        when(shopRepository.countByStatus(ShopStatus.SUSPENDED)).thenReturn(2L);

        DashboardStatsResponse stats = adminDashboardService.getPlatformStats(null, null);

        assertEquals(7L, stats.getInactiveBakeries());
        assertEquals(2L, stats.getSuspendedBakeries());
        verify(shopRepository).countByStatus(ShopStatus.INACTIVE);
        verify(shopRepository).countByStatus(ShopStatus.SUSPENDED);
    }

    @Test
    @DisplayName("B1.3: Today registrations and payments respect configured timezone boundary")
    void testB1_TimezoneBoundaryRespected() {
        ArgumentCaptor<LocalDateTime> startOfDayCaptor = ArgumentCaptor.forClass(LocalDateTime.class);
        ArgumentCaptor<LocalDateTime> endOfDayCaptor = ArgumentCaptor.forClass(LocalDateTime.class);
        when(userRepository.countByCreatedAtBetween(startOfDayCaptor.capture(), endOfDayCaptor.capture())).thenReturn(8L);

        adminDashboardService.getPlatformStats(null, null);

        LocalDateTime captured = startOfDayCaptor.getValue();
        assertNotNull(captured);
        assertEquals(0, captured.getHour());
        assertEquals(0, captured.getMinute());
        assertEquals(0, captured.getSecond());
        assertEquals(0, captured.getNano());
    }

    @Test
    @DisplayName("B1.4: Monthly revenue adheres to canonical Phase 6A realized revenue query")
    void testB1_MonthlyRevenue_CanonicalRealizedRule() {
        ArgumentCaptor<LocalDateTime> startOfMonthCaptor = ArgumentCaptor.forClass(LocalDateTime.class);
        ArgumentCaptor<LocalDateTime> endOfMonthCaptor = ArgumentCaptor.forClass(LocalDateTime.class);
        when(orderRepository.sumRealizedRevenueBetween(startOfMonthCaptor.capture(), endOfMonthCaptor.capture()))
                .thenReturn(new BigDecimal("82500.00"));

        LocalDate firstOfMonth = LocalDate.now().withDayOfMonth(1);
        LocalDate today = LocalDate.now();
        DashboardStatsResponse stats = adminDashboardService.getPlatformStats(firstOfMonth, today);

        assertEquals(new BigDecimal("82500.00"), stats.getMonthlyGmv());
        LocalDateTime captured = startOfMonthCaptor.getValue();
        assertNotNull(captured);
        assertEquals(0, captured.getHour());
        assertEquals(0, captured.getMinute());
    }

    // =========================================================================
    // B2 Ã¢â‚¬â€ SHOP SUSPENSION REASON WORKFLOW TESTS
    // =========================================================================

    @Test
    @DisplayName("B2.1: Admin can suspend shop with a non-empty, trimmed reason")
    void testB2_AdminCanSuspendWithReason() {
        when(shopRepository.findById(10L)).thenReturn(Optional.of(testShop));
        Long adminUserId = 1L;
        String reason = "Repeated delivery failures and hygiene violation";

        Shop result = adminDashboardService.updateShopStatus(10L, "SUSPENDED", reason, adminUserId);

        assertNotNull(result);
        verify(shopStatusManager).suspendShop(10L, 1L, reason);
    }

    @Test
    @DisplayName("B2.2: Blank suspension reason is rejected with HTTP 400 IllegalArgumentException")
    void testB2_BlankSuspensionReasonRejected() {
        Long adminUserId = 1L;

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
            adminDashboardService.updateShopStatus(10L, "SUSPENDED", "   ", adminUserId);
        });

        assertTrue(ex.getMessage().contains("Suspension reason is mandatory"));
        verify(shopStatusManager, never()).suspendShop(anyLong(), anyLong(), anyString());
    }

    @Test
    @DisplayName("B2.3: Null suspension reason is rejected with IllegalArgumentException")
    void testB2_NullSuspensionReasonRejected() {
        Long adminUserId = 1L;

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
            adminDashboardService.updateShopStatus(10L, "SUSPENDED", null, adminUserId);
        });

        assertTrue(ex.getMessage().contains("Suspension reason is mandatory"));
        verify(shopStatusManager, never()).suspendShop(anyLong(), anyLong(), anyString());
    }

    @Test
    @DisplayName("B2.4: Reactivation works without requiring a suspension reason and captures actor ID")
    void testB2_ReactivationDoesNotRequireReason() {
        when(shopRepository.findById(10L)).thenReturn(Optional.of(testShop));
        Long adminUserId = 1L;

        Shop result = adminDashboardService.updateShopStatus(10L, "ACTIVE", null, adminUserId);

        assertNotNull(result);
        verify(shopStatusManager).activateShop(10L, 1L);
    }

    // =========================================================================
    // B3 Ã¢â‚¬â€ KYC / DOCUMENT VERIFICATION WORKFLOW TESTS
    // =========================================================================

    @Test
    @DisplayName("B3.1: Admin can approve valid KYC: sets VERIFIED, logs activity, notifies owner")
    void testB3_AdminApproveKYC() {
        when(shopRepository.findById(10L)).thenReturn(Optional.of(testShop));
        when(businessDocumentRepository.findByShopId(10L)).thenReturn(List.of(testDoc));
        Long adminUserId = 1L;

        Shop updated = adminDashboardService.reviewShopVerification(10L, "APPROVE", null, adminUserId);

        assertNotNull(updated);
        assertEquals(VerificationStatus.VERIFIED, testShop.getVerificationStatus());
        assertEquals(VerificationStatus.VERIFIED, testDoc.getStatus());

        verify(shopRepository).save(testShop);
        verify(businessDocumentRepository).save(testDoc);
        verify(activityLogger).logActivity(
                eq(1L), eq(10L), eq("KYC_VERIFIED"), eq("SHOP"), eq(10L), anyString()
        );
        verify(notificationService).createNotification(
                eq(testOwner),
                eq(NotificationType.DOCUMENT_VERIFICATION),
                eq("Bakery Verified"),
                eq("Congratulations! Your bakery verification has been approved. Your storefront is now verified on CakeStore."),
                eq("10"),
                eq(true)
        );
    }

    @Test
    @DisplayName("B3.2: Admin can reject KYC with reason: sets REJECTED, logs reason, notifies owner")
    void testB3_AdminRejectKYCWithReason() {
        when(shopRepository.findById(10L)).thenReturn(Optional.of(testShop));
        when(businessDocumentRepository.findByShopId(10L)).thenReturn(List.of(testDoc));
        Long adminUserId = 1L;
        String rejectionReason = "FSSAI certificate expired and business address mismatch";

        Shop updated = adminDashboardService.reviewShopVerification(10L, "REJECT", rejectionReason, adminUserId);

        assertNotNull(updated);
        assertEquals(VerificationStatus.REJECTED, testShop.getVerificationStatus());
        assertEquals(VerificationStatus.REJECTED, testDoc.getStatus());

        verify(shopRepository).save(testShop);
        verify(businessDocumentRepository).save(testDoc);
        verify(activityLogger).logActivity(
                eq(1L), eq(10L), eq("KYC_REJECTED"), eq("SHOP"), eq(10L), contains(rejectionReason)
        );
        verify(notificationService).createNotification(
                eq(testOwner),
                eq(NotificationType.DOCUMENT_VERIFICATION),
                eq("Verification Rejected"),
                contains(rejectionReason),
                eq("10"),
                eq(true)
        );
    }

    @Test
    @DisplayName("B3.3: KYC rejection requires mandatory reason (blank or null rejected)")
    void testB3_KYCRejection_MandatoryReasonEnforced() {
        when(shopRepository.findById(10L)).thenReturn(Optional.of(testShop));
        Long adminUserId = 1L;

        IllegalArgumentException exNull = assertThrows(IllegalArgumentException.class, () -> {
            adminDashboardService.reviewShopVerification(10L, "REJECT", null, adminUserId);
        });
        assertTrue(exNull.getMessage().contains("Rejection reason is mandatory"));

        IllegalArgumentException exBlank = assertThrows(IllegalArgumentException.class, () -> {
            adminDashboardService.reviewShopVerification(10L, "REJECT", "   ", adminUserId);
        });
        assertTrue(exBlank.getMessage().contains("Rejection reason is mandatory"));

        verify(notificationService, never()).createNotification(any(), any(), any(), any(), any(), anyBoolean());
    }

    @Test
    @DisplayName("B3.4: Owner can view KYC status and rejection feedback reason")
    void testB3_OwnerCanViewRejectionFeedback() {
        testShop.setVerificationStatus(VerificationStatus.REJECTED);
        when(shopRepository.findByOwnerId(100L)).thenReturn(List.of(testShop));
        when(businessDocumentRepository.findByShopId(10L)).thenReturn(List.of(testDoc));

        ActivityLog rejectionLog = new ActivityLog();
        rejectionLog.setAction("KYC_REJECTED");
        rejectionLog.setMetadata("Rejection reason: FSSAI document blurry");
        when(activityLogRepository.findByShopIdOrderByTimestampDesc(10L)).thenReturn(List.of(rejectionLog));

        Map<String, Object> statusResponse = verificationService.getVerificationStatus(100L);

        assertNotNull(statusResponse);
        assertEquals("REJECTED", statusResponse.get("verificationStatus"));
        assertEquals("Rejection reason: FSSAI document blurry", statusResponse.get("rejectionReason"));
    }

    @Test
    @DisplayName("B3.5: Document upload does not auto-verify, leaves status as PROCESSING awaiting admin review")
    void testB3_DocumentUpload_DoesNotAutoVerify() {
        when(shopRepository.findByOwnerId(100L)).thenReturn(List.of(testShop));
        when(businessDocumentRepository.save(any(BusinessDocument.class))).thenAnswer(invocation -> invocation.getArgument(0));

        DocumentUploadRequest request = new DocumentUploadRequest();
        request.setDocumentType("FSSAI_CERTIFICATE");
        request.setFileUrl("https://storage.cakestore.in/docs/new-fssai.pdf");

        BusinessDocument uploaded = verificationService.uploadDocument(100L, request);

        assertNotNull(uploaded);
        assertEquals(VerificationStatus.PROCESSING, uploaded.getStatus());
        assertEquals(VerificationStatus.PROCESSING, testShop.getVerificationStatus());
        assertNotEquals(VerificationStatus.VERIFIED, testShop.getVerificationStatus());
    }

    @Test
    @DisplayName("B3.6: Cross-tenant KYC query for non-associated owner throws RuntimeException")
    void testB3_CrossTenantKYC_Rejected() {
        when(shopRepository.findByOwnerId(999L)).thenReturn(Collections.emptyList());

        assertThrows(RuntimeException.class, () -> {
            verificationService.getMyDocuments(999L);
        });

        assertThrows(RuntimeException.class, () -> {
            verificationService.getVerificationStatus(999L);
        });
    }

    @Test
    @DisplayName("B3.7: Mark Under Review sets verification status to PROCESSING, preserves shop status and documents, and logs activity")
    void testB3_MarkUnderReview_Success() {
        testShop.setVerificationStatus(VerificationStatus.REJECTED);
        testShop.setStatus(ShopStatus.ACTIVE);
        testDoc.setStatus(VerificationStatus.REJECTED);

        when(shopRepository.findById(10L)).thenReturn(Optional.of(testShop));
        when(shopRepository.save(any(Shop.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(businessDocumentRepository.findByShopId(10L)).thenReturn(List.of(testDoc));

        Shop updated = adminDashboardService.reviewShopVerification(10L, "MARK_UNDER_REVIEW", null, 1L);

        assertNotNull(updated);
        assertEquals(VerificationStatus.PROCESSING, updated.getVerificationStatus());
        assertEquals(ShopStatus.ACTIVE, updated.getStatus());
        // Verify document status was NOT changed or auto-verified
        assertEquals(VerificationStatus.REJECTED, testDoc.getStatus());
        verify(businessDocumentRepository, never()).save(any(BusinessDocument.class));

        verify(shopRepository).save(testShop);
        verify(activityLogger).logActivity(
                eq(1L),
                eq(10L),
                eq("KYC_UNDER_REVIEW"),
                eq("SHOP"),
                eq(10L),
                eq("Admin marked bakery KYC as under review")
        );
        verify(notificationService, never()).createNotification(any(), any(), any(), any(), any(), anyBoolean());
    }

    @Test
    @DisplayName("B3.8: Invalid verification action throws IllegalArgumentException")
    void testB3_InvalidVerificationAction_ThrowsException() {
        when(shopRepository.findById(10L)).thenReturn(Optional.of(testShop));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
            adminDashboardService.reviewShopVerification(10L, "INVALID_ACTION", null, 1L);
        });
        assertTrue(ex.getMessage().contains("Invalid verification action"));
    }
}
