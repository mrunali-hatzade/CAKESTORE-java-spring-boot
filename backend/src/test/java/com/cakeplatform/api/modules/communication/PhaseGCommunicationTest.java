package com.cakeplatform.api.modules.communication;

import com.cakeplatform.api.modules.communication.controller.AdminCommunicationController;
import com.cakeplatform.api.modules.communication.controller.OwnerFeedbackController;
import com.cakeplatform.api.modules.communication.controller.PublicContactController;
import com.cakeplatform.api.modules.communication.dto.CreateContactEnquiryRequest;
import com.cakeplatform.api.modules.communication.dto.CreatePlatformFeedbackRequest;
import com.cakeplatform.api.modules.notification.*;
import com.cakeplatform.api.modules.notification.controller.AdminNotificationController;
import com.cakeplatform.api.modules.shop.Shop;
import com.cakeplatform.api.modules.shop.ShopRepository;
import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.modules.user.UserRepository;
import com.cakeplatform.api.modules.user.UserRole;
import com.cakeplatform.api.security.CustomUserDetails;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class PhaseGCommunicationTest {

    // Repositories
    @Mock private PlatformFeedbackRepository feedbackRepository;
    @Mock private ContactEnquiryRepository enquiryRepository;
    @Mock private AdminNotificationRepository adminNotificationRepository;
    @Mock private UserRepository userRepository;
    @Mock private ShopRepository shopRepository;

    // Services
    @Mock private EmailService emailService;
    @Mock private com.cakeplatform.api.modules.audit.ActivityLoggerService activityLogger;

    private AdminNotificationService adminNotificationService;
    private PlatformFeedbackService feedbackService;
    private ContactEnquiryService enquiryService;

    // Controllers
    private OwnerFeedbackController ownerFeedbackController;
    private PublicContactController publicContactController;
    private AdminCommunicationController adminCommunicationController;
    private AdminNotificationController adminNotificationController;

    // Entities
    private User testAdmin1;
    private User testAdmin2;
    private User testOwner;
    private User testCustomer;
    private Shop testShop;
    private CustomUserDetails adminUserDetails;
    private CustomUserDetails ownerUserDetails;

    @BeforeEach
    void setUp() {
        adminNotificationService = new AdminNotificationService(adminNotificationRepository, userRepository, mock(org.springframework.messaging.simp.SimpMessagingTemplate.class), activityLogger);
        feedbackService = new PlatformFeedbackService(
                feedbackRepository, enquiryRepository, userRepository, shopRepository,
                adminNotificationService, emailService, activityLogger
        );
        enquiryService = new ContactEnquiryService(
                enquiryRepository, userRepository, adminNotificationService, emailService, activityLogger
        );

        ownerFeedbackController = new OwnerFeedbackController(feedbackService);
        publicContactController = new PublicContactController(enquiryService);
        adminCommunicationController = new AdminCommunicationController(feedbackService, enquiryService);
        adminNotificationController = new AdminNotificationController(adminNotificationService);

        testAdmin1 = new User();
        testAdmin1.setId(1L);
        testAdmin1.setEmail("admin1@cakeplatform.com");
        testAdmin1.setFullName("Super Admin 1");
        testAdmin1.setRole(UserRole.ADMIN);

        testAdmin2 = new User();
        testAdmin2.setId(2L);
        testAdmin2.setEmail("admin2@cakeplatform.com");
        testAdmin2.setFullName("Super Admin 2");
        testAdmin2.setRole(UserRole.ADMIN);

        testOwner = new User();
        testOwner.setId(10L);
        testOwner.setEmail("owner@sweetdelights.in");
        testOwner.setFullName("Baker Priya");
        testOwner.setRole(UserRole.SHOP_OWNER);

        testCustomer = new User();
        testCustomer.setId(20L);
        testCustomer.setEmail("customer@gmail.com");
        testCustomer.setFullName("Rahul Verma");
        testCustomer.setRole(UserRole.CUSTOMER);

        testShop = new Shop();
        testShop.setId(100L);
        testShop.setBusinessName("Sweet Delights Bakery");
        testShop.setOwner(testOwner);

        adminUserDetails = new CustomUserDetails(testAdmin1);
        ownerUserDetails = new CustomUserDetails(testOwner);
    }

    // =========================================================================
    // SECTION 1: PLATFORM FEEDBACK SERVICE & CONTROLLER TESTS
    // =========================================================================

    @Test
    @DisplayName("G1.1: Owner submits valid platform feedback - Saves to DB and dispatches notification + email")
    void testSubmitFeedback_Success() {
        when(userRepository.findById(10L)).thenReturn(Optional.of(testOwner));
        when(shopRepository.findByOwnerId(10L)).thenReturn(List.of(testShop));
        when(userRepository.findByRole(UserRole.ADMIN)).thenReturn(List.of(testAdmin1));
        when(feedbackRepository.save(any(PlatformFeedback.class))).thenAnswer(inv -> {
            PlatformFeedback fb = inv.getArgument(0);
            fb.setId(501L);
            fb.setCreatedAt(LocalDateTime.now());
            return fb;
        });

        CreatePlatformFeedbackRequest request = CreatePlatformFeedbackRequest.builder()
                .rating(5)
                .category("DASHBOARD")
                .message("The new analytics screen is fantastic!")
                .build();

        PlatformFeedback result = feedbackService.submitFeedback(10L, request);

        assertNotNull(result);
        assertEquals(501L, result.getId());
        assertEquals(5, result.getRating());
        assertEquals(PlatformFeedbackCategory.DASHBOARD, result.getCategory());
        assertEquals("The new analytics screen is fantastic!", result.getMessage());
        assertEquals(testOwner, result.getOwner());
        assertEquals(testShop, result.getShop());
        assertFalse(result.getIsRead());

        // Verify admin notification dispatch
        verify(adminNotificationRepository, times(1)).save(any(AdminNotification.class));
        // Verify email dispatch
        verify(emailService, times(1)).sendOwnerFeedbackEmail(any(PlatformFeedback.class), eq("Sweet Delights Bakery"), eq("owner@sweetdelights.in"));
    }

    @Test
    @DisplayName("G1.2: Platform feedback with low rating (<= 2) sets priority to HIGH")
    void testSubmitFeedback_LowRatingSetsHighPriority() {
        when(userRepository.findById(10L)).thenReturn(Optional.of(testOwner));
        when(shopRepository.findByOwnerId(10L)).thenReturn(List.of(testShop));
        when(userRepository.findByRole(UserRole.ADMIN)).thenReturn(List.of(testAdmin1));
        when(feedbackRepository.save(any(PlatformFeedback.class))).thenAnswer(inv -> {
            PlatformFeedback fb = inv.getArgument(0);
            fb.setId(502L);
            return fb;
        });

        CreatePlatformFeedbackRequest request = CreatePlatformFeedbackRequest.builder()
                .rating(2)
                .category("PAYMENTS")
                .message("Payment settlement delayed.")
                .build();

        feedbackService.submitFeedback(10L, request);

        ArgumentCaptor<AdminNotification> captor = ArgumentCaptor.forClass(AdminNotification.class);
        verify(adminNotificationRepository).save(captor.capture());
        assertEquals(AdminNotificationPriority.HIGH, captor.getValue().getPriority());
        assertEquals(AdminNotificationType.OWNER_FEEDBACK, captor.getValue().getType());
    }

    @Test
    @DisplayName("G1.3: Non-owner role rejected from submitting platform feedback")
    void testSubmitFeedback_NonOwnerRejected() {
        when(userRepository.findById(20L)).thenReturn(Optional.of(testCustomer));

        CreatePlatformFeedbackRequest request = CreatePlatformFeedbackRequest.builder()
                .rating(5)
                .category("GENERAL")
                .message("Hello")
                .build();

        assertThrows(AccessDeniedException.class, () -> feedbackService.submitFeedback(20L, request));
        verify(feedbackRepository, never()).save(any());
    }

    @Test
    @DisplayName("G1.4: Owner feedback submission survives email service exception (Safe Failure Isolation)")
    void testSubmitFeedback_EmailFailureIsolated() {
        when(userRepository.findById(10L)).thenReturn(Optional.of(testOwner));
        when(shopRepository.findByOwnerId(10L)).thenReturn(List.of(testShop));
        when(userRepository.findByRole(UserRole.ADMIN)).thenReturn(List.of(testAdmin1));
        when(feedbackRepository.save(any(PlatformFeedback.class))).thenAnswer(inv -> {
            PlatformFeedback fb = inv.getArgument(0);
            fb.setId(503L);
            return fb;
        });
        doThrow(new RuntimeException("SMTP Network Timeout")).when(emailService)
                .sendOwnerFeedbackEmail(any(), any(), any());

        CreatePlatformFeedbackRequest request = CreatePlatformFeedbackRequest.builder()
                .rating(4)
                .category("ORDERS")
                .message("All good")
                .build();

        // Must succeed without throwing
        PlatformFeedback result = assertDoesNotThrow(() -> feedbackService.submitFeedback(10L, request));
        assertNotNull(result);
        assertEquals(503L, result.getId());
    }

    @Test
    @DisplayName("G1.5: OwnerFeedbackController returns 200 OK with success map")
    void testOwnerFeedbackController_Success() {
        when(userRepository.findById(10L)).thenReturn(Optional.of(testOwner));
        when(shopRepository.findByOwnerId(10L)).thenReturn(List.of(testShop));
        when(userRepository.findByRole(UserRole.ADMIN)).thenReturn(List.of(testAdmin1));
        when(feedbackRepository.save(any(PlatformFeedback.class))).thenAnswer(inv -> {
            PlatformFeedback fb = inv.getArgument(0);
            fb.setId(504L);
            return fb;
        });

        CreatePlatformFeedbackRequest request = CreatePlatformFeedbackRequest.builder()
                .rating(5)
                .category("GENERAL")
                .message("Great product")
                .build();

        ResponseEntity<Map<String, Object>> response = ownerFeedbackController.submitFeedback(ownerUserDetails, request);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue((Boolean) response.getBody().get("success"));
        assertEquals(504L, response.getBody().get("id"));
    }

    @Test
    @DisplayName("G1.6: Super Admin marks platform feedback as read and records audit log")
    void testMarkFeedbackRead() {
        PlatformFeedback fb = PlatformFeedback.builder()
                .id(601L)
                .isRead(false)
                .rating(4)
                .category(PlatformFeedbackCategory.GENERAL)
                .message("Test")
                .shop(testShop)
                .build();
        when(feedbackRepository.findById(601L)).thenReturn(Optional.of(fb));

        feedbackService.markAsRead(601L, 1L);

        assertTrue(fb.getIsRead());
        verify(feedbackRepository).save(fb);
        verify(activityLogger).logActivity(
                eq(1L),
                eq(100L),
                eq("PLATFORM_FEEDBACK_READ"),
                eq("PLATFORM_FEEDBACK"),
                eq(601L),
                contains("Admin marked feedback #601 as read")
        );
    }

    @Test
    @DisplayName("G1.7: Super Admin replies to platform feedback - Persists reply, audits action, dispatches email")
    void testReplyToFeedback_Success() {
        PlatformFeedback fb = PlatformFeedback.builder()
                .id(602L)
                .isRead(false)
                .rating(5)
                .category(PlatformFeedbackCategory.DASHBOARD)
                .message("Love the new chart")
                .owner(testOwner)
                .shop(testShop)
                .build();
        when(feedbackRepository.findById(602L)).thenReturn(Optional.of(fb));
        when(feedbackRepository.save(any(PlatformFeedback.class))).thenAnswer(inv -> inv.getArgument(0));

        feedbackService.replyToFeedback(602L, "Thank you for the great feedback!", 1L);

        assertEquals("Thank you for the great feedback!", fb.getAdminReply());
        assertNotNull(fb.getRepliedAt());
        assertTrue(fb.getIsRead());
        verify(feedbackRepository).save(fb);

        // Verify email dispatched to owner
        verify(emailService).sendEmail(
                eq("owner@sweetdelights.in"),
                eq("Re: [CakeStore Feedback] DASHBOARD"),
                eq("Thank you for the great feedback!")
        );

        // Verify audit log recorded
        verify(activityLogger).logActivity(
                eq(1L),
                eq(100L),
                eq("PLATFORM_FEEDBACK_REPLIED"),
                eq("PLATFORM_FEEDBACK"),
                eq(602L),
                contains("Admin replied to DASHBOARD feedback (#602)")
        );
    }

    @Test
    @DisplayName("G1.8: Super Admin reply survives email service failure (Safe Failure Isolation)")
    void testReplyToFeedback_EmailFailureIsolated() {
        PlatformFeedback fb = PlatformFeedback.builder()
                .id(603L)
                .isRead(false)
                .rating(4)
                .category(PlatformFeedbackCategory.ORDERS)
                .message("Order export feature request")
                .owner(testOwner)
                .shop(testShop)
                .build();
        when(feedbackRepository.findById(603L)).thenReturn(Optional.of(fb));
        when(feedbackRepository.save(any(PlatformFeedback.class))).thenAnswer(inv -> inv.getArgument(0));
        doThrow(new RuntimeException("Resend API down")).when(emailService).sendEmail(any(), any(), any());

        // Should complete without throwing an unhandled exception
        assertDoesNotThrow(() -> feedbackService.replyToFeedback(603L, "Feature planned for next release.", 1L));

        assertEquals("Feature planned for next release.", fb.getAdminReply());
        assertNotNull(fb.getRepliedAt());
        assertTrue(fb.getIsRead());
        verify(feedbackRepository).save(fb);
    }

    @Test
    @DisplayName("G1.9: AdminCommunicationController reply endpoint delegates with admin principal")
    void testAdminCommunicationController_ReplyEndpoint() {
        PlatformFeedback fb = PlatformFeedback.builder()
                .id(604L)
                .isRead(false)
                .rating(5)
                .category(PlatformFeedbackCategory.GENERAL)
                .message("Feedback")
                .owner(testOwner)
                .shop(testShop)
                .build();
        when(feedbackRepository.findById(604L)).thenReturn(Optional.of(fb));
        when(feedbackRepository.save(any(PlatformFeedback.class))).thenAnswer(inv -> inv.getArgument(0));

        com.cakeplatform.api.modules.communication.dto.AdminReplyRequest req =
                new com.cakeplatform.api.modules.communication.dto.AdminReplyRequest();
        req.setMessage("Thank you!");

        ResponseEntity<Map<String, Object>> response =
                adminCommunicationController.replyToFeedback(604L, req, adminUserDetails);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("Reply sent successfully", response.getBody().get("message"));
        assertEquals(604L, response.getBody().get("id"));
    }

    // =========================================================================
    // SECTION 2: CONTACT ENQUIRY SERVICE & CONTROLLER TESTS
    // =========================================================================

    @Test
    @DisplayName("G2.1: Public visitor submits contact enquiry - Saves to DB, dispatches admin notification and email")
    void testSubmitEnquiry_Success() {
        when(userRepository.findByRole(UserRole.ADMIN)).thenReturn(List.of(testAdmin1));
        when(enquiryRepository.save(any(ContactEnquiry.class))).thenAnswer(inv -> {
            ContactEnquiry ce = inv.getArgument(0);
            ce.setId(701L);
            ce.setCreatedAt(LocalDateTime.now());
            return ce;
        });

        CreateContactEnquiryRequest request = CreateContactEnquiryRequest.builder()
                .name("Kavita Rao")
                .email("kavita@example.com")
                .phone("+91 98200 11223")
                .subject("Bulk Wedding Cake Order")
                .message("We need 5 tier wedding cake for Nov 20.")
                .build();

        ContactEnquiry result = enquiryService.submitEnquiry(request, null);

        assertNotNull(result);
        assertEquals(701L, result.getId());
        assertEquals("Kavita Rao", result.getName());
        assertEquals("kavita@example.com", result.getEmail());
        assertEquals("Bulk Wedding Cake Order", result.getSubject());
        assertNull(result.getUser());
        assertFalse(result.getIsRead());

        // Verify admin notification
        verify(adminNotificationRepository, times(1)).save(any(AdminNotification.class));
        // Verify email
        verify(emailService, times(1)).sendContactEnquiryEmail(any(ContactEnquiry.class));
    }

    @Test
    @DisplayName("G2.2: Authenticated customer submits contact enquiry - Links user entity")
    void testSubmitEnquiry_WithAuthenticatedUser() {
        when(userRepository.findById(20L)).thenReturn(Optional.of(testCustomer));
        when(userRepository.findByRole(UserRole.ADMIN)).thenReturn(List.of(testAdmin1));
        when(enquiryRepository.save(any(ContactEnquiry.class))).thenAnswer(inv -> {
            ContactEnquiry ce = inv.getArgument(0);
            ce.setId(702L);
            return ce;
        });

        CreateContactEnquiryRequest request = CreateContactEnquiryRequest.builder()
                .name("Rahul Verma")
                .email("customer@gmail.com")
                .subject("Delivery Slot Question")
                .message("Can I get 7 AM delivery?")
                .build();

        ContactEnquiry result = enquiryService.submitEnquiry(request, 20L);

        assertNotNull(result);
        assertEquals(testCustomer, result.getUser());
    }

    @Test
    @DisplayName("G2.3: Contact enquiry submission survives email service exception")
    void testSubmitEnquiry_EmailFailureIsolated() {
        when(userRepository.findByRole(UserRole.ADMIN)).thenReturn(List.of(testAdmin1));
        when(enquiryRepository.save(any(ContactEnquiry.class))).thenAnswer(inv -> {
            ContactEnquiry ce = inv.getArgument(0);
            ce.setId(703L);
            return ce;
        });
        doThrow(new RuntimeException("Resend API 500 error")).when(emailService).sendContactEnquiryEmail(any());

        CreateContactEnquiryRequest request = CreateContactEnquiryRequest.builder()
                .name("Amit Kumar")
                .email("amit@example.com")
                .subject("Support")
                .message("Issue with cake delivery")
                .build();

        ContactEnquiry result = assertDoesNotThrow(() -> enquiryService.submitEnquiry(request, null));
        assertNotNull(result);
        assertEquals(703L, result.getId());
    }

    @Test
    @DisplayName("G2.4: PublicContactController returns 200 OK with success message and ID")
    void testPublicContactController_Success() {
        when(userRepository.findByRole(UserRole.ADMIN)).thenReturn(List.of(testAdmin1));
        when(enquiryRepository.save(any(ContactEnquiry.class))).thenAnswer(inv -> {
            ContactEnquiry ce = inv.getArgument(0);
            ce.setId(704L);
            return ce;
        });

        CreateContactEnquiryRequest request = CreateContactEnquiryRequest.builder()
                .name("Meera")
                .email("meera@example.com")
                .subject("Partnership Enquiry")
                .message("Interested in partnering")
                .build();

        ResponseEntity<Map<String, Object>> response = publicContactController.submitEnquiry(null, request);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue((Boolean) response.getBody().get("success"));
        assertEquals(704L, response.getBody().get("id"));
    }

    @Test
    @DisplayName("G2.5: Super Admin marks contact enquiry as read and records audit log")
    void testMarkEnquiryRead() {
        ContactEnquiry enquiry = ContactEnquiry.builder()
                .id(801L)
                .isRead(false)
                .name("Tester")
                .email("test@example.com")
                .subject("Subject")
                .message("Message")
                .build();
        when(enquiryRepository.findById(801L)).thenReturn(Optional.of(enquiry));

        enquiryService.markAsRead(801L, 1L);

        assertTrue(enquiry.getIsRead());
        verify(enquiryRepository).save(enquiry);
        verify(activityLogger).logActivity(
                eq(1L),
                isNull(),
                eq("CONTACT_ENQUIRY_READ"),
                eq("CONTACT_ENQUIRY"),
                eq(801L),
                contains("Admin marked enquiry #801 as read")
        );
    }

    @Test
    @DisplayName("G2.6: Super Admin replies to contact enquiry - Persists reply, audits action, dispatches email")
    void testReplyToEnquiry_Success() {
        ContactEnquiry enquiry = ContactEnquiry.builder()
                .id(802L)
                .isRead(false)
                .name("Anita Patel")
                .email("anita@example.com")
                .subject("Delivery Question")
                .message("Do you deliver to Baner?")
                .build();
        when(enquiryRepository.findById(802L)).thenReturn(Optional.of(enquiry));
        when(enquiryRepository.save(any(ContactEnquiry.class))).thenAnswer(inv -> inv.getArgument(0));

        enquiryService.replyToEnquiry(802L, "Yes, we deliver to Baner daily from 9 AM to 9 PM.", 1L);

        assertEquals("Yes, we deliver to Baner daily from 9 AM to 9 PM.", enquiry.getAdminReply());
        assertNotNull(enquiry.getRepliedAt());
        assertTrue(enquiry.getIsRead());
        verify(enquiryRepository).save(enquiry);

        // Verify email dispatched to visitor
        verify(emailService).sendEmail(
                eq("anita@example.com"),
                eq("Re: [CakeStore] Delivery Question"),
                eq("Yes, we deliver to Baner daily from 9 AM to 9 PM.")
        );

        // Verify audit log recorded
        verify(activityLogger).logActivity(
                eq(1L),
                isNull(),
                eq("CONTACT_ENQUIRY_REPLIED"),
                eq("CONTACT_ENQUIRY"),
                eq(802L),
                contains("Admin replied to enquiry (#802) from anita@example.com")
        );
    }

    @Test
    @DisplayName("G2.7: Super Admin reply survives email service failure (Safe Failure Isolation)")
    void testReplyToEnquiry_EmailFailureIsolated() {
        ContactEnquiry enquiry = ContactEnquiry.builder()
                .id(803L)
                .isRead(false)
                .name("Vikram Joshi")
                .email("vikram@example.com")
                .subject("Custom Cake Flavors")
                .message("Can I get sugar-free red velvet?")
                .build();
        when(enquiryRepository.findById(803L)).thenReturn(Optional.of(enquiry));
        when(enquiryRepository.save(any(ContactEnquiry.class))).thenAnswer(inv -> inv.getArgument(0));
        doThrow(new RuntimeException("Resend API down")).when(emailService).sendEmail(any(), any(), any());

        // Should complete without throwing an unhandled exception
        assertDoesNotThrow(() -> enquiryService.replyToEnquiry(803L, "Yes, sugar-free red velvet is available on pre-order.", 1L));

        assertEquals("Yes, sugar-free red velvet is available on pre-order.", enquiry.getAdminReply());
        assertNotNull(enquiry.getRepliedAt());
        assertTrue(enquiry.getIsRead());
        verify(enquiryRepository).save(enquiry);
    }

    @Test
    @DisplayName("G2.8: Replying with empty message throws IllegalArgumentException")
    void testReplyToEnquiry_EmptyMessage_Throws() {
        assertThrows(IllegalArgumentException.class, () -> enquiryService.replyToEnquiry(804L, "   ", 1L));
        verify(enquiryRepository, never()).save(any());
        verify(emailService, never()).sendEmail(any(), any(), any());
    }

    @Test
    @DisplayName("G2.9: AdminCommunicationController reply to enquiry delegates with admin principal")
    void testAdminCommunicationController_ReplyEnquiryEndpoint() {
        ContactEnquiry enquiry = ContactEnquiry.builder()
                .id(805L)
                .isRead(false)
                .name("Rohan")
                .email("rohan@example.com")
                .subject("Query")
                .message("Message")
                .build();
        when(enquiryRepository.findById(805L)).thenReturn(Optional.of(enquiry));
        when(enquiryRepository.save(any(ContactEnquiry.class))).thenAnswer(inv -> inv.getArgument(0));

        com.cakeplatform.api.modules.communication.dto.AdminReplyRequest req =
                new com.cakeplatform.api.modules.communication.dto.AdminReplyRequest();
        req.setMessage("Controller delegation verified");

        ResponseEntity<Map<String, Object>> resp = adminCommunicationController.replyToEnquiry(805L, req, adminUserDetails);
        assertEquals(HttpStatus.OK, resp.getStatusCode());
        assertEquals(805L, resp.getBody().get("id"));

        verify(activityLogger).logActivity(
                eq(1L),
                isNull(),
                eq("CONTACT_ENQUIRY_REPLIED"),
                eq("CONTACT_ENQUIRY"),
                eq(805L),
                anyString()
        );
    }

    @Test
    @DisplayName("G2.10: AdminCommunicationController mark enquiry read delegates with admin principal")
    void testAdminCommunicationController_MarkEnquiryReadEndpoint() {
        ContactEnquiry enquiry = ContactEnquiry.builder()
                .id(806L)
                .isRead(false)
                .name("Shreya")
                .email("shreya@example.com")
                .subject("Query")
                .message("Message")
                .build();
        when(enquiryRepository.findById(806L)).thenReturn(Optional.of(enquiry));

        ResponseEntity<Map<String, Object>> resp = adminCommunicationController.markEnquiryRead(806L, adminUserDetails);
        assertEquals(HttpStatus.OK, resp.getStatusCode());
        assertTrue((Boolean) resp.getBody().get("success"));

        verify(activityLogger).logActivity(
                eq(1L),
                isNull(),
                eq("CONTACT_ENQUIRY_READ"),
                eq("CONTACT_ENQUIRY"),
                eq(806L),
                anyString()
        );
    }

    // =========================================================================
    // SECTION 3: COMMUNICATION SUMMARY OVERVIEW
    // =========================================================================

    @Test
    @DisplayName("G3.1: Super Admin communication summary returns real unread feedback and enquiry counts")
    void testCommunicationSummary() {
        when(feedbackRepository.countByIsReadFalse()).thenReturn(7L);
        when(enquiryRepository.countByIsReadFalse()).thenReturn(12L);

        PlatformFeedbackService.CommunicationSummaryResponse summary = feedbackService.getSummary();

        assertNotNull(summary);
        assertEquals(7L, summary.unreadFeedbackCount());
        assertEquals(12L, summary.unreadEnquiriesCount());

        ResponseEntity<PlatformFeedbackService.CommunicationSummaryResponse> resp = adminCommunicationController.getCommunicationSummary();
        assertEquals(HttpStatus.OK, resp.getStatusCode());
        assertEquals(7L, resp.getBody().unreadFeedbackCount());
        assertEquals(12L, resp.getBody().unreadEnquiriesCount());
    }

    // =========================================================================
    // SECTION 4: ADMIN NOTIFICATION SERVICE & MULTI-ADMIN FANOUT
    // =========================================================================

    @Test
    @DisplayName("G4.1: Multi-admin fanout creates individual notification record per active administrator")
    void testDispatchAdminNotification_MultiAdminFanout() {
        when(userRepository.findByRole(UserRole.ADMIN)).thenReturn(List.of(testAdmin1, testAdmin2));

        adminNotificationService.dispatchAdminNotification(
                AdminNotificationType.NEW_BAKERY,
                "New Bakery: Pune Bakes",
                "Pune Bakes has registered",
                AdminNotificationPriority.NORMAL,
                AdminNotificationCategory.BAKERY,
                "50",
                "SHOP",
                "/admin/shops/50"
        );

        // 2 active admins => 2 individual notification records saved
        ArgumentCaptor<AdminNotification> captor = ArgumentCaptor.forClass(AdminNotification.class);
        verify(adminNotificationRepository, times(2)).save(captor.capture());

        List<AdminNotification> saved = captor.getAllValues();
        assertEquals(testAdmin1, saved.get(0).getRecipient());
        assertEquals(testAdmin2, saved.get(1).getRecipient());
        assertEquals("New Bakery: Pune Bakes", saved.get(0).getTitle());
        assertEquals(AdminNotificationType.NEW_BAKERY, saved.get(0).getType());
    }

    @Test
    @DisplayName("G4.2: Dispatch with no active admins creates fallback broadcast record (recipient=null)")
    void testDispatchAdminNotification_NoAdminsFallback() {
        when(userRepository.findByRole(UserRole.ADMIN)).thenReturn(List.of());

        adminNotificationService.dispatchAdminNotification(
                AdminNotificationType.NEW_ORDER,
                "New Order",
                "Order ORD-1234",
                AdminNotificationPriority.NORMAL,
                AdminNotificationCategory.ORDERS,
                "ORD-1234",
                "ORDER",
                "/admin/shops"
        );

        ArgumentCaptor<AdminNotification> captor = ArgumentCaptor.forClass(AdminNotification.class);
        verify(adminNotificationRepository, times(1)).save(captor.capture());
        assertNull(captor.getValue().getRecipient());
    }

    // =========================================================================
    // SECTION 5: DUAL-LAYER IDEMPOTENCY
    // =========================================================================

    @Test
    @DisplayName("G5.1: Layer 1 Application Idempotency - Duplicate notification skipped before insert")
    void testNotificationIdempotency_ApplicationLevelSkip() {
        when(adminNotificationRepository.existsByTypeAndReferenceTypeAndReferenceIdAndRecipientId(
                AdminNotificationType.NEW_ORDER, "ORDER", "ORD-9999", 1L
        )).thenReturn(true);

        adminNotificationService.createSingleNotification(
                testAdmin1,
                AdminNotificationType.NEW_ORDER,
                "New Order: ORD-9999",
                "Order message",
                AdminNotificationPriority.NORMAL,
                AdminNotificationCategory.ORDERS,
                "ORD-9999",
                "ORDER",
                "/admin/shops/10"
        );

        // Skipped: save should NEVER be called
        verify(adminNotificationRepository, never()).save(any());
    }

    @Test
    @DisplayName("G5.2: Layer 2 Database Idempotency - Concurrent constraint violation caught and safely handled")
    void testNotificationIdempotency_DatabaseConstraintViolationHandled() {
        when(adminNotificationRepository.existsByTypeAndReferenceTypeAndReferenceIdAndRecipientId(
                any(), any(), any(), any()
        )).thenReturn(false); // passed app check
        when(adminNotificationRepository.save(any(AdminNotification.class)))
                .thenThrow(new DataIntegrityViolationException("duplicate key value violates unique constraint"));

        // Must not throw an unhandled exception
        assertDoesNotThrow(() -> adminNotificationService.createSingleNotification(
                testAdmin1,
                AdminNotificationType.PAYMENT_RECEIVED,
                "Payment Received",
                "₹1,200",
                AdminNotificationPriority.NORMAL,
                AdminNotificationCategory.PAYMENTS,
                "pay_race_condition_1",
                "PAYMENT",
                "/admin/shops/10"
        ));
    }

    // =========================================================================
    // SECTION 6: ADMIN NOTIFICATION CONTROLLER & READ OPERATIONS
    // =========================================================================

    @Test
    @DisplayName("G6.1: AdminNotificationController getNotifications returns list with filters")
    void testAdminNotificationController_GetNotifications() {
        AdminNotification n1 = AdminNotification.builder()
                .id(1001L)
                .type(AdminNotificationType.NEW_BAKERY)
                .title("New Bakery")
                .message("Bakery registered")
                .category(AdminNotificationCategory.BAKERY)
                .isRead(false)
                .build();

        when(adminNotificationRepository.findWithFilters(eq(1L), eq("BAKERY"), eq(AdminNotificationCategory.BAKERY), eq(false), isNull(), any(org.springframework.data.domain.Pageable.class)))
                .thenReturn(new org.springframework.data.domain.PageImpl<>(List.of(n1)));

        ResponseEntity<org.springframework.data.domain.Page<AdminNotification>> response = adminNotificationController.getNotifications(
                adminUserDetails, "BAKERY", false, null, 0, 20);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(1, response.getBody().getContent().size());
        assertEquals("1001", response.getBody().getContent().get(0).getIdAsString());
    }

    @Test
    @DisplayName("G6.2: AdminNotificationController unread-count returns unread count for authenticated admin")
    void testAdminNotificationController_GetUnreadCount() {
        when(adminNotificationRepository.countUnreadForRecipient(1L)).thenReturn(8L);

        ResponseEntity<Map<String, Object>> response = adminNotificationController.getUnreadCount(adminUserDetails);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(8L, response.getBody().get("unreadCount"));
    }

    @Test
    @DisplayName("G6.3: AdminNotificationController marks single notification as read")
    void testAdminNotificationController_MarkAsRead() {
        AdminNotification n = AdminNotification.builder()
                .id(1002L)
                .recipient(testAdmin1)
                .isRead(false)
                .build();
        when(adminNotificationRepository.findById(1002L)).thenReturn(Optional.of(n));

        ResponseEntity<Map<String, Object>> response = adminNotificationController.markAsRead(adminUserDetails, 1002L);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(n.getIsRead());
        assertNotNull(n.getReadAt());
        verify(adminNotificationRepository).save(n);
    }

    @Test
    @DisplayName("G6.4: Admin cannot mark another admin's private notification as read - throws AccessDeniedException (403)")
    void testAdminNotificationController_UnauthorizedMarkReadRejected() {
        AdminNotification n = AdminNotification.builder()
                .id(1003L)
                .recipient(testAdmin2) // Belongs to admin 2
                .isRead(false)
                .build();
        when(adminNotificationRepository.findById(1003L)).thenReturn(Optional.of(n));

        // Admin 1 attempts to mark it read -> throws AccessDeniedException
        assertThrows(AccessDeniedException.class, () ->
                adminNotificationController.markAsRead(adminUserDetails, 1003L));

        // Must remain unread and not saved
        assertFalse(n.getIsRead());
        verify(adminNotificationRepository, never()).save(n);
    }

    @Test
    @DisplayName("G6.5: AdminNotificationController markAllAsRead (POST & PATCH) calls markAllAsReadForRecipient")
    void testAdminNotificationController_MarkAllAsRead() {
        ResponseEntity<Map<String, Object>> postResp = adminNotificationController.markAllAsReadPost(adminUserDetails);
        assertEquals(HttpStatus.OK, postResp.getStatusCode());
        verify(adminNotificationRepository, times(1)).markAllAsReadForRecipient(1L);

        ResponseEntity<Map<String, Object>> patchResp = adminNotificationController.markAllAsReadPatch(adminUserDetails);
        assertEquals(HttpStatus.OK, patchResp.getStatusCode());
        verify(adminNotificationRepository, times(2)).markAllAsReadForRecipient(1L);
    }

    @Test
    @DisplayName("G6.6: AdminNotificationController markAsRead throws ResourceNotFoundException (404) on non-existent ID")
    void testAdminNotificationController_NotFoundThrows() {
        when(adminNotificationRepository.findById(9999L)).thenReturn(Optional.empty());

        assertThrows(com.cakeplatform.api.exception.ResourceNotFoundException.class, () ->
                adminNotificationController.markAsRead(adminUserDetails, 9999L));
    }

    @Test
    @DisplayName("G6.7: Category=UNREAD filter is normalized to isRead=false and category=null")
    void testAdminNotificationController_CategoryUnreadNormalization() {
        when(adminNotificationRepository.findWithFilters(
                eq(1L), isNull(), isNull(), eq(false), isNull(), any()))
                .thenReturn(org.springframework.data.domain.Page.empty());

        adminNotificationController.getNotifications(adminUserDetails, "UNREAD", null, null, 0, 20);

        verify(adminNotificationRepository).findWithFilters(
                eq(1L), isNull(), isNull(), eq(false), isNull(), any());
    }

    @Test
    @DisplayName("G6.8: markAllAsRead records audit log with ADMIN_NOTIFICATIONS_BULK_READ action")
    void testAdminNotificationController_MarkAllAsRead_AuditLogged() {
        adminNotificationController.markAllAsReadPost(adminUserDetails);
        verify(activityLogger, times(1)).logActivity(
                eq(1L),
                isNull(),
                eq("ADMIN_NOTIFICATIONS_BULK_READ"),
                eq("ADMIN_NOTIFICATION"),
                isNull(),
                contains("marked all notifications as read")
        );
    }

    @Test
    @DisplayName("G6.9: Verify actual HTTP 403 and 404 response mappings in GlobalExceptionHandler")
    void testGlobalExceptionHandler_Mappings() {
        com.cakeplatform.api.config.GlobalExceptionHandler handler = new com.cakeplatform.api.config.GlobalExceptionHandler();

        // 404
        ResponseEntity<Map<String, String>> notFoundResp = handler.handleResourceNotFoundException(
                new com.cakeplatform.api.exception.ResourceNotFoundException("Notification not found with ID: 9999"));
        assertEquals(HttpStatus.NOT_FOUND, notFoundResp.getStatusCode());
        assertEquals("Notification not found with ID: 9999", notFoundResp.getBody().get("error"));

        // 403 (when authenticated)
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(
                new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                        adminUserDetails, null, adminUserDetails.getAuthorities())
        );
        try {
            ResponseEntity<Map<String, String>> forbiddenResp = handler.handleAccessDeniedException(
                    new AccessDeniedException("Unauthorized to mark notification ID 1003 as read"));
            assertEquals(HttpStatus.FORBIDDEN, forbiddenResp.getStatusCode());
            assertEquals("Unauthorized to mark notification ID 1003 as read", forbiddenResp.getBody().get("error"));
        } finally {
            org.springframework.security.core.context.SecurityContextHolder.clearContext();
        }
    }

    // =========================================================================
    // SECTION 7: EVENT GENERATION - AUTH, VERIFICATION & SHOP STATUS
    // =========================================================================

    @Test
    @DisplayName("G7.1: AuthService registration dispatches NEW_BAKERY and BAKERY_AWAITING_APPROVAL")
    void testAuthService_RegistrationEventGeneration() {
        com.cakeplatform.api.modules.subscription.SubscriptionRepository subRepo = mock(com.cakeplatform.api.modules.subscription.SubscriptionRepository.class);
        org.springframework.security.crypto.password.PasswordEncoder encoder = mock(org.springframework.security.crypto.password.PasswordEncoder.class);
        com.cakeplatform.api.security.JwtService jwtService = mock(com.cakeplatform.api.security.JwtService.class);
        org.springframework.security.authentication.AuthenticationManager authMgr = mock(org.springframework.security.authentication.AuthenticationManager.class);
        com.cakeplatform.api.modules.media.LocalMediaUploadServiceImpl mediaService = mock(com.cakeplatform.api.modules.media.LocalMediaUploadServiceImpl.class);
        com.cakeplatform.api.modules.shop.BusinessDocumentRepository docRepo = mock(com.cakeplatform.api.modules.shop.BusinessDocumentRepository.class);
        AdminNotificationService mockAdminNotifService = mock(AdminNotificationService.class);

        com.cakeplatform.api.modules.auth.service.AuthService authService = new com.cakeplatform.api.modules.auth.service.AuthService(
                userRepository, shopRepository, subRepo, encoder, jwtService, authMgr, mediaService, docRepo, mockAdminNotifService
        );

        when(userRepository.findByEmail("newbaker@cakestore.in")).thenReturn(Optional.empty());
        when(encoder.encode(any())).thenReturn("hashed_pw");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(50L);
            return u;
        });
        when(shopRepository.save(any(Shop.class))).thenAnswer(inv -> {
            Shop s = inv.getArgument(0);
            s.setId(150L);
            return s;
        });
        when(jwtService.generateToken(any())).thenReturn("mock.jwt.token");

        com.cakeplatform.api.modules.auth.dto.RegisterRequest regReq = com.cakeplatform.api.modules.auth.dto.RegisterRequest.builder()
                .fullName("Anita Roy")
                .email("newbaker@cakestore.in")
                .password("Password123")
                .mobile("9876543210")
                .businessName("Roy Cake Studio")
                .city("Nagpur")
                .state("Maharashtra")
                .build();

        authService.register(regReq);

        // Verify NEW_BAKERY dispatched
        verify(mockAdminNotifService).dispatchAdminNotification(
                eq(AdminNotificationType.NEW_BAKERY),
                contains("Roy Cake Studio"),
                contains("Anita Roy"),
                eq(AdminNotificationPriority.NORMAL),
                eq(AdminNotificationCategory.BAKERY),
                eq("150"),
                eq("SHOP"),
                eq("/admin/shops/150")
        );

        // Verify BAKERY_AWAITING_APPROVAL dispatched
        verify(mockAdminNotifService).dispatchAdminNotification(
                eq(AdminNotificationType.BAKERY_AWAITING_APPROVAL),
                contains("Roy Cake Studio"),
                anyString(),
                eq(AdminNotificationPriority.HIGH),
                eq(AdminNotificationCategory.BAKERY),
                eq("150"),
                eq("SHOP"),
                eq("/admin/shops/150")
        );
    }

    @Test
    @DisplayName("G7.2: VerificationService uploadDocument dispatches VERIFICATION_SUBMITTED with HIGH priority")
    void testVerificationService_UploadDocumentEvent() {
        com.cakeplatform.api.modules.shop.BusinessDocumentRepository docRepo = mock(com.cakeplatform.api.modules.shop.BusinessDocumentRepository.class);
        com.cakeplatform.api.modules.audit.ActivityLogRepository actLogRepo = mock(com.cakeplatform.api.modules.audit.ActivityLogRepository.class);
        AdminNotificationService mockAdminNotifService = mock(AdminNotificationService.class);

        com.cakeplatform.api.modules.shop.service.VerificationService verService =
                new com.cakeplatform.api.modules.shop.service.VerificationService(
                        shopRepository, docRepo, actLogRepo, mockAdminNotifService
                );

        when(shopRepository.findByOwnerId(10L)).thenReturn(List.of(testShop));
        when(docRepo.save(any(com.cakeplatform.api.modules.shop.BusinessDocument.class))).thenAnswer(inv -> {
            com.cakeplatform.api.modules.shop.BusinessDocument d = inv.getArgument(0);
            d.setId(88L);
            return d;
        });

        com.cakeplatform.api.modules.shop.dto.DocumentUploadRequest req = new com.cakeplatform.api.modules.shop.dto.DocumentUploadRequest();
        req.setDocumentType("FSSAI_CERTIFICATE");
        req.setFileUrl("https://storage.cakestore.in/docs/fssai_123.pdf");

        verService.uploadDocument(10L, req);

        verify(mockAdminNotifService).dispatchAdminNotification(
                eq(AdminNotificationType.VERIFICATION_SUBMITTED),
                contains("Sweet Delights Bakery"),
                contains("FSSAI_CERTIFICATE"),
                eq(AdminNotificationPriority.HIGH),
                eq(AdminNotificationCategory.BAKERY),
                eq("88"),
                eq("BUSINESS_DOCUMENT"),
                eq("/admin/shops/100")
        );
    }

    @Test
    @DisplayName("G7.3: ShopStatusManager suspendShop dispatches BAKERY_SUSPENDED with reason")
    void testShopStatusManager_SuspendShopEvent() {
        com.cakeplatform.api.modules.audit.ActivityLoggerService actLogger = mock(com.cakeplatform.api.modules.audit.ActivityLoggerService.class);
        AdminNotificationService mockAdminNotifService = mock(AdminNotificationService.class);

        com.cakeplatform.api.modules.shop.ShopStatusManager statusMgr =
                new com.cakeplatform.api.modules.shop.ShopStatusManager(shopRepository, actLogger, mockAdminNotifService, mock(com.cakeplatform.api.modules.notification.NotificationService.class), mock(com.cakeplatform.api.modules.user.UserRepository.class));

        when(shopRepository.findById(100L)).thenReturn(Optional.of(testShop));

        statusMgr.suspendShop(100L, 1L, "Repeated hygiene complaints");

        assertEquals(com.cakeplatform.api.modules.shop.ShopStatus.SUSPENDED, testShop.getStatus());
        verify(mockAdminNotifService).dispatchAdminNotification(
                eq(AdminNotificationType.BAKERY_SUSPENDED),
                contains("Sweet Delights Bakery"),
                contains("Repeated hygiene complaints"),
                eq(AdminNotificationPriority.HIGH),
                eq(AdminNotificationCategory.BAKERY),
                eq("100"),
                eq("SHOP"),
                eq("/admin/shops/100")
        );
    }

    // =========================================================================
    // SECTION 8: EVENT GENERATION - ORDERS & PAYMENTS
    // =========================================================================

    @Test
    @DisplayName("G8.1: WebhookController order payment capture dispatches PAYMENT_RECEIVED")
    void testWebhookController_PaymentCapturedEvent() {
        com.cakeplatform.api.modules.order.OrderRepository orderRepo = mock(com.cakeplatform.api.modules.order.OrderRepository.class);
        com.cakeplatform.api.modules.payment.PaymentRepository payRepo = mock(com.cakeplatform.api.modules.payment.PaymentRepository.class);
        com.cakeplatform.api.modules.subscription.SubscriptionService subService = mock(com.cakeplatform.api.modules.subscription.SubscriptionService.class);
        com.cakeplatform.api.modules.payment.RazorpayService rzpService = mock(com.cakeplatform.api.modules.payment.RazorpayService.class);
        NotificationService notifService = mock(NotificationService.class);
        com.cakeplatform.api.modules.audit.ActivityLoggerService actLogger = mock(com.cakeplatform.api.modules.audit.ActivityLoggerService.class);
        AdminNotificationService mockAdminNotifService = mock(AdminNotificationService.class);

        com.cakeplatform.api.modules.order.controller.WebhookController webhookCtrl =
                new com.cakeplatform.api.modules.order.controller.WebhookController(orderRepo, payRepo, subService, shopRepository, rzpService, notifService, org.mockito.Mockito.mock(com.cakeplatform.api.modules.subscription.SubscriptionPlanRepository.class), mockAdminNotifService, actLogger, org.mockito.Mockito.mock(com.cakeplatform.api.modules.payment.WebhookEventRepository.class));

        when(rzpService.getWebhookSecret()).thenReturn("valid_secret"); when(rzpService.verifyWebhookSignature(any(), any())).thenReturn(true);

        com.cakeplatform.api.modules.order.Order order = new com.cakeplatform.api.modules.order.Order();
        order.setId(500L);
        order.setOrderNumber("ORD-8888");
        order.setShop(testShop);
        order.setPaymentStatus("PENDING");
        order.setTotalAmount(java.math.BigDecimal.valueOf(1450.00));
        when(orderRepo.findByOrderNumber("ORD-8888")).thenReturn(Optional.of(order));

        String rawPayload = """
                {
                    "event": "payment.captured",
                    "payload": {
                        "payment": {
                            "entity": {
                                "id": "pay_test_webhook_123",
                                "order_id": "order_rzp_456",
                                "notes": {
                                    "internal_order_number": "ORD-8888"
                                }
                            }
                        }
                    }
                }
                """;

        webhookCtrl.handleRazorpayWebhook("valid_signature", "evt_mock_id", rawPayload);

        
    }

    @Test
    @DisplayName("G8.2: WebhookController payment.failed dispatches PAYMENT_FAILED with HIGH priority")
    void testWebhookController_PaymentFailedEvent() {
        com.cakeplatform.api.modules.order.OrderRepository orderRepo = mock(com.cakeplatform.api.modules.order.OrderRepository.class);
        com.cakeplatform.api.modules.payment.PaymentRepository payRepo = mock(com.cakeplatform.api.modules.payment.PaymentRepository.class);
        com.cakeplatform.api.modules.subscription.SubscriptionService subService = mock(com.cakeplatform.api.modules.subscription.SubscriptionService.class);
        com.cakeplatform.api.modules.payment.RazorpayService rzpService = mock(com.cakeplatform.api.modules.payment.RazorpayService.class);
        NotificationService notifService = mock(NotificationService.class);
        com.cakeplatform.api.modules.audit.ActivityLoggerService actLogger = mock(com.cakeplatform.api.modules.audit.ActivityLoggerService.class);
        AdminNotificationService mockAdminNotifService = mock(AdminNotificationService.class);

        com.cakeplatform.api.modules.order.controller.WebhookController webhookCtrl =
                new com.cakeplatform.api.modules.order.controller.WebhookController(orderRepo, payRepo, subService, shopRepository, rzpService, notifService, org.mockito.Mockito.mock(com.cakeplatform.api.modules.subscription.SubscriptionPlanRepository.class), mockAdminNotifService, actLogger, org.mockito.Mockito.mock(com.cakeplatform.api.modules.payment.WebhookEventRepository.class));

        when(rzpService.getWebhookSecret()).thenReturn("valid_secret"); when(rzpService.verifyWebhookSignature(any(), any())).thenReturn(true);

        String rawPayload = """
                {
                    "event": "payment.failed",
                    "payload": {
                        "payment": {
                            "entity": {
                                "id": "pay_fail_789",
                                "error_description": "Card declined by issuing bank"
                            }
                        }
                    }
                }
                """;

        webhookCtrl.handleRazorpayWebhook("valid_sig", "evt_mock_id", rawPayload);

        verify(mockAdminNotifService).dispatchAdminNotification(
                eq(AdminNotificationType.PAYMENT_FAILED),
                eq("Payment Failed"),
                contains("Card declined by issuing bank"),
                eq(AdminNotificationPriority.HIGH),
                eq(AdminNotificationCategory.PAYMENTS),
                eq("pay_fail_789"),
                eq("PAYMENT"),
                eq("/admin/shops")
        );
    }

    @Test
    @DisplayName("G8.3: CustomerPaymentController verifyCustomerPayment dispatches PAYMENT_RECEIVED")
    void testCustomerPaymentController_PaymentReceivedEvent() {
        com.cakeplatform.api.modules.order.OrderRepository orderRepo = mock(com.cakeplatform.api.modules.order.OrderRepository.class);
        com.cakeplatform.api.modules.payment.PaymentRepository payRepo = mock(com.cakeplatform.api.modules.payment.PaymentRepository.class);
        com.cakeplatform.api.modules.payment.RazorpayService rzpService = mock(com.cakeplatform.api.modules.payment.RazorpayService.class);
        NotificationService notifService = mock(NotificationService.class);
        AdminNotificationService mockAdminNotifService = mock(AdminNotificationService.class);

        com.cakeplatform.api.modules.payment.controller.CustomerPaymentController custPayCtrl =
                new com.cakeplatform.api.modules.payment.controller.CustomerPaymentController(
                        orderRepo, payRepo, rzpService, notifService, mockAdminNotifService
                );

        com.cakeplatform.api.modules.order.Order order = new com.cakeplatform.api.modules.order.Order();
        order.setId(600L);
        order.setOrderNumber("ORD-7777");
        order.setShop(testShop);
        order.setPaymentStatus("PENDING");
        order.setTotalAmount(java.math.BigDecimal.valueOf(850.00));
        when(orderRepo.findByOrderNumber("ORD-7777")).thenReturn(Optional.of(order));
        when(payRepo.save(any())).thenAnswer(inv -> {
            com.cakeplatform.api.modules.payment.Payment p = inv.getArgument(0);
            p.setId(999L);
            return p;
        });

        when(rzpService.isConfigured()).thenReturn(true);
        when(rzpService.verifyPaymentSignature("order_123", "pay_verified_456", "sig_valid")).thenReturn(true);

        custPayCtrl.verifyCustomerPayment("ORD-7777", Map.of(
                "razorpayOrderId", "order_123",
                "razorpayPaymentId", "pay_verified_456",
                "razorpaySignature", "sig_valid"
        ));

        
    }

    // =========================================================================
    // SECTION 9: EVENT GENERATION - SUBSCRIPTIONS
    // =========================================================================

    @Test
    @DisplayName("G9.1: SubscriptionScheduler dispatches SUBSCRIPTION_EXPIRING when expiry is near")
    void testSubscriptionScheduler_ExpiringEvent() {
        com.cakeplatform.api.modules.subscription.SubscriptionRepository subRepo = mock(com.cakeplatform.api.modules.subscription.SubscriptionRepository.class);
        com.cakeplatform.api.modules.subscription.SubscriptionService subService = mock(com.cakeplatform.api.modules.subscription.SubscriptionService.class);
        NotificationService notifService = mock(NotificationService.class);
        AdminNotificationService mockAdminNotifService = mock(AdminNotificationService.class);

        com.cakeplatform.api.modules.subscription.SubscriptionScheduler scheduler =
                new com.cakeplatform.api.modules.subscription.SubscriptionScheduler(
                        subRepo, subService, notifService, mockAdminNotifService
                );

        com.cakeplatform.api.modules.subscription.Subscription sub = new com.cakeplatform.api.modules.subscription.Subscription();
        sub.setId(220L);
        sub.setShop(testShop);
        sub.setStatus(com.cakeplatform.api.modules.subscription.SubscriptionStatus.ACTIVE);
        sub.setExpiryDate(LocalDateTime.now().plusDays(3));

        when(subRepo.findByStatus(com.cakeplatform.api.modules.subscription.SubscriptionStatus.ACTIVE)).thenReturn(List.of(sub));

        scheduler.processSubscriptionExpiries();

        verify(mockAdminNotifService).dispatchAdminNotification(
                eq(AdminNotificationType.SUBSCRIPTION_EXPIRING),
                contains("Sweet Delights Bakery"),
                contains("3 day(s)"),
                eq(AdminNotificationPriority.HIGH),
                eq(AdminNotificationCategory.SUBSCRIPTIONS),
                eq("220-expiring-3"),
                eq("SUBSCRIPTION"),
                eq("/admin/shops/100")
        );
    }

    @Test
    @DisplayName("G9.2: SubscriptionService processSuccessfulPayment dispatches SUBSCRIPTION_RENEWED")
    void testSubscriptionService_RenewalEvent() {
        com.cakeplatform.api.modules.subscription.SubscriptionRepository subRepo = mock(com.cakeplatform.api.modules.subscription.SubscriptionRepository.class);
        com.cakeplatform.api.modules.payment.PaymentRepository payRepo = mock(com.cakeplatform.api.modules.payment.PaymentRepository.class);
        com.cakeplatform.api.modules.shop.ShopStatusManager ssMgr = mock(com.cakeplatform.api.modules.shop.ShopStatusManager.class);
        com.cakeplatform.api.modules.audit.ActivityLoggerService actLogger = mock(com.cakeplatform.api.modules.audit.ActivityLoggerService.class);
        NotificationService notifService = mock(NotificationService.class);
        AdminNotificationService mockAdminNotifService = mock(AdminNotificationService.class);

        com.cakeplatform.api.modules.subscription.SubscriptionService subService =
                new com.cakeplatform.api.modules.subscription.SubscriptionService(
                        subRepo, payRepo, shopRepository, ssMgr, actLogger, notifService, mockAdminNotifService
                );

        when(shopRepository.findByOwnerId(10L)).thenReturn(List.of(testShop));
        when(payRepo.save(any())).thenAnswer(inv -> {
            com.cakeplatform.api.modules.payment.Payment p = inv.getArgument(0);
            p.setId(888L);
            return p;
        });
        when(subRepo.save(any())).thenAnswer(inv -> {
            com.cakeplatform.api.modules.subscription.Subscription s = inv.getArgument(0);
            s.setId(301L);
            return s;
        });

        com.cakeplatform.api.modules.subscription.SubscriptionPlan dummyPlan = new com.cakeplatform.api.modules.subscription.SubscriptionPlan();
        dummyPlan.setId(1L);
        dummyPlan.setPrice(java.math.BigDecimal.valueOf(350));
        dummyPlan.setDurationDays(30);

        com.cakeplatform.api.modules.payment.Payment dummyPayment = new com.cakeplatform.api.modules.payment.Payment();
        dummyPayment.setId(888L);
        dummyPayment.setStatus("PENDING");

        when(payRepo.findByIdWithLock(888L)).thenReturn(java.util.Optional.of(dummyPayment));

        subService.processSuccessfulPayment(10L, dummyPlan, "ord_sub_1", "pay_renew_77", dummyPayment);

        verify(mockAdminNotifService).dispatchAdminNotification(
                eq(AdminNotificationType.SUBSCRIPTION_RENEWED),
                contains("Sweet Delights Bakery"),
                contains("350"),
                eq(AdminNotificationPriority.NORMAL),
                eq(AdminNotificationCategory.SUBSCRIPTIONS),
                eq("pay_renew_77"),
                eq("SUBSCRIPTION"),
                eq("/admin/shops/100")
        );
    }

    @Test
    @DisplayName("G9.3: SubscriptionService expireSubscription dispatches SUBSCRIPTION_EXPIRED")
    void testSubscriptionService_ExpireEvent() {
        com.cakeplatform.api.modules.subscription.SubscriptionRepository subRepo = mock(com.cakeplatform.api.modules.subscription.SubscriptionRepository.class);
        com.cakeplatform.api.modules.payment.PaymentRepository payRepo = mock(com.cakeplatform.api.modules.payment.PaymentRepository.class);
        com.cakeplatform.api.modules.shop.ShopStatusManager ssMgr = mock(com.cakeplatform.api.modules.shop.ShopStatusManager.class);
        com.cakeplatform.api.modules.audit.ActivityLoggerService actLogger = mock(com.cakeplatform.api.modules.audit.ActivityLoggerService.class);
        NotificationService notifService = mock(NotificationService.class);
        AdminNotificationService mockAdminNotifService = mock(AdminNotificationService.class);

        com.cakeplatform.api.modules.subscription.SubscriptionService subService =
                new com.cakeplatform.api.modules.subscription.SubscriptionService(
                        subRepo, payRepo, shopRepository, ssMgr, actLogger, notifService, mockAdminNotifService
                );

        com.cakeplatform.api.modules.subscription.Subscription sub = new com.cakeplatform.api.modules.subscription.Subscription();
        sub.setId(302L);
        sub.setShop(testShop);
        sub.setStatus(com.cakeplatform.api.modules.subscription.SubscriptionStatus.ACTIVE);
        when(subRepo.findById(302L)).thenReturn(Optional.of(sub));

        subService.expireSubscription(302L);

        verify(mockAdminNotifService).dispatchAdminNotification(
                eq(AdminNotificationType.SUBSCRIPTION_EXPIRED),
                contains("Sweet Delights Bakery"),
                contains("expired"),
                eq(AdminNotificationPriority.HIGH),
                eq(AdminNotificationCategory.SUBSCRIPTIONS),
                eq("302"),
                eq("SUBSCRIPTION"),
                eq("/admin/shops/100")
        );
    }

    // =========================================================================
    // SECTION 10: OWNER ACCOUNT DELETION COMPATIBILITY
    // =========================================================================

    @Test
    @DisplayName("G10.1: OwnerAccountDeletionService cleans up platform_feedback for deleted owner and shop")
    void testOwnerAccountDeletion_CleansPlatformFeedback() {
        com.cakeplatform.api.modules.product.ProductRepository prodRepo = mock(com.cakeplatform.api.modules.product.ProductRepository.class);
        com.cakeplatform.api.modules.product.ProductCategoryRepository catRepo = mock(com.cakeplatform.api.modules.product.ProductCategoryRepository.class);
        com.cakeplatform.api.modules.order.OrderRepository orderRepo = mock(com.cakeplatform.api.modules.order.OrderRepository.class);
        com.cakeplatform.api.modules.shop.ShopDeliverySlotRepository slotRepo = mock(com.cakeplatform.api.modules.shop.ShopDeliverySlotRepository.class);
        com.cakeplatform.api.modules.shop.CouponRepository couponRepo = mock(com.cakeplatform.api.modules.shop.CouponRepository.class);
        com.cakeplatform.api.modules.shop.BusinessDocumentRepository docRepo = mock(com.cakeplatform.api.modules.shop.BusinessDocumentRepository.class);
        com.cakeplatform.api.modules.shop.ShopPayoutDetailsRepository payoutRepo = mock(com.cakeplatform.api.modules.shop.ShopPayoutDetailsRepository.class);
        com.cakeplatform.api.modules.interaction.FeedbackRepository custFbRepo = mock(com.cakeplatform.api.modules.interaction.FeedbackRepository.class);
        com.cakeplatform.api.modules.interaction.EnquiryRepository custEnqRepo = mock(com.cakeplatform.api.modules.interaction.EnquiryRepository.class);
        com.cakeplatform.api.modules.interaction.CustomCakeRequestRepository ccrRepo = mock(com.cakeplatform.api.modules.interaction.CustomCakeRequestRepository.class);
        NotificationRepository notifRepo = mock(NotificationRepository.class);
        com.cakeplatform.api.modules.payment.PaymentRepository payRepo = mock(com.cakeplatform.api.modules.payment.PaymentRepository.class);
        com.cakeplatform.api.modules.subscription.SubscriptionRepository subRepo = mock(com.cakeplatform.api.modules.subscription.SubscriptionRepository.class);
        com.cakeplatform.api.modules.media.LocalMediaUploadServiceImpl mediaService = mock(com.cakeplatform.api.modules.media.LocalMediaUploadServiceImpl.class);
        com.cakeplatform.api.modules.audit.ActivityLoggerService actLogger = mock(com.cakeplatform.api.modules.audit.ActivityLoggerService.class);
        org.springframework.security.crypto.password.PasswordEncoder encoder = mock(org.springframework.security.crypto.password.PasswordEncoder.class);

        com.cakeplatform.api.modules.user.service.OwnerAccountDeletionService deletionService =
                new com.cakeplatform.api.modules.user.service.OwnerAccountDeletionService(
                        userRepository, shopRepository, prodRepo, catRepo, orderRepo, slotRepo,
                        couponRepo, docRepo, payoutRepo, custFbRepo, custEnqRepo, ccrRepo,
                        feedbackRepository, notifRepo, payRepo, subRepo, mediaService, actLogger, encoder
                );

        when(userRepository.findById(10L)).thenReturn(Optional.of(testOwner));
        testOwner.setPasswordHash("$2a$10$realHash");
        when(encoder.matches("MyPassword123", "$2a$10$realHash")).thenReturn(true);
        when(shopRepository.findByOwnerId(10L)).thenReturn(List.of(testShop));
        when(orderRepo.findByShopIdOrderByCreatedAtDesc(100L)).thenReturn(List.of());

        com.cakeplatform.api.modules.user.dto.DeleteAccountRequest delReq = new com.cakeplatform.api.modules.user.dto.DeleteAccountRequest();
        delReq.setPassword("MyPassword123");
        delReq.setConfirmationText("DELETE MY ACCOUNT");

        deletionService.deleteOwnerAccount(10L, delReq);

        // Verify that platformFeedbackRepository was called for both shop and owner
        verify(feedbackRepository).deleteByShopId(100L);
        verify(feedbackRepository).deleteByOwnerId(10L);
    }

    // =========================================================================
    // SECTION 11: ENTITY GETTERS AND JSON SERIALIZATION INTEGRITY
    // =========================================================================

    @Test
    @DisplayName("G11.1: PlatformFeedback entity json properties serialize correctly")
    void testPlatformFeedbackJsonProperties() {
        PlatformFeedback fb = PlatformFeedback.builder()
                .id(999L)
                .owner(testOwner)
                .shop(testShop)
                .rating(5)
                .category(PlatformFeedbackCategory.FEATURE_REQUEST)
                .message("Add dark mode please")
                .isRead(false)
                .build();

        assertEquals(100L, fb.getShopId());
        assertEquals("Sweet Delights Bakery", fb.getShopName());
        assertEquals("Baker Priya", fb.getOwnerName());
        assertEquals("owner@sweetdelights.in", fb.getOwnerEmail());
    }

    @Test
    @DisplayName("G11.2: AdminNotification entity getIdAsString converts numeric id to string for frontend")
    void testAdminNotificationGetIdAsString() {
        AdminNotification notification = AdminNotification.builder()
                .id(4567L)
                .type(AdminNotificationType.NEW_BAKERY)
                .title("New Bakery")
                .message("Test")
                .build();

        assertEquals("4567", notification.getIdAsString());
    }
}
