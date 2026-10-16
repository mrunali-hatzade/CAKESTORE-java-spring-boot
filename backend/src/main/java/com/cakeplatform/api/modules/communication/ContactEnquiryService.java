package com.cakeplatform.api.modules.communication;

import com.cakeplatform.api.modules.communication.dto.CreateContactEnquiryRequest;
import com.cakeplatform.api.modules.notification.AdminNotificationCategory;
import com.cakeplatform.api.modules.notification.AdminNotificationPriority;
import com.cakeplatform.api.modules.notification.AdminNotificationService;
import com.cakeplatform.api.modules.notification.AdminNotificationType;
import com.cakeplatform.api.modules.notification.EmailService;
import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.modules.user.UserRepository;
import com.cakeplatform.api.modules.audit.ActivityLoggerService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class ContactEnquiryService {

    private final ContactEnquiryRepository enquiryRepository;
    private final UserRepository userRepository;
    private final AdminNotificationService adminNotificationService;
    private final EmailService emailService;
    private final ActivityLoggerService activityLogger;

    /**
     * Submit a contact enquiry from a public visitor or authenticated user.
     * Guaranteed transactional database save + persistent admin notification + isolated transactional email.
     */
    @Transactional
    public ContactEnquiry submitEnquiry(CreateContactEnquiryRequest request, Long optionalUserId) {
        log.info("Processing contact enquiry submission from: {} ({})", request.getName(), request.getEmail());

        User user = null;
        if (optionalUserId != null) {
            user = userRepository.findById(optionalUserId).orElse(null);
        }

        ContactEnquiry enquiry = ContactEnquiry.builder()
                .name(request.getName().trim())
                .email(request.getEmail().trim().toLowerCase())
                .phone(request.getPhone() != null && !request.getPhone().trim().isEmpty() ? request.getPhone().trim() : null)
                .subject(request.getSubject().trim())
                .message(request.getMessage().trim())
                .user(user)
                .isRead(false)
                .build();

        ContactEnquiry saved = enquiryRepository.save(enquiry);
        log.info("Saved contact_enquiry record ID: {}", saved.getId());

        // Dispatch Real ADMIN_NOTIFICATION (type = CONTACT_ENQUIRY)
        String summaryMessage = String.format("From %s (%s): \"%s\"",
                saved.getName(),
                saved.getEmail(),
                truncate(saved.getMessage(), 120)
        );

        adminNotificationService.dispatchAdminNotification(
                AdminNotificationType.CONTACT_ENQUIRY,
                "New Contact Enquiry: " + truncate(saved.getSubject(), 40),
                summaryMessage,
                AdminNotificationPriority.NORMAL,
                AdminNotificationCategory.COMMUNICATION,
                saved.getId().toString(),
                "CONTACT_ENQUIRY",
                "/admin/enquiries"
        );

        // Dispatch transactional email (Safe failure isolation: never rolls back the DB record)
        try {
            emailService.sendContactEnquiryEmail(saved);
        } catch (Exception ex) {
            log.error("Email dispatch error for contact enquiry ID {}: {}", saved.getId(), ex.getMessage());
        }

        return saved;
    }

    /**
     * Retrieve contact enquiries with optional read/unread filter and text search.
     */
    @Transactional(readOnly = true)
    public org.springframework.data.domain.Page<ContactEnquiry> getEnquiries(Boolean isRead, String search, org.springframework.data.domain.Pageable pageable) {
        return enquiryRepository.findWithFilters(isRead, search != null ? search.trim() : "", pageable);
    }

    /**
     * Super Admin reply to a contact enquiry.
     * Guaranteed transactional database save + isolated email dispatch + persistent activity audit log.
     */
    @Transactional
    public void replyToEnquiry(Long id, String replyMessage) {
        replyToEnquiry(id, replyMessage, null);
    }

    @Transactional
    public void replyToEnquiry(Long id, String replyMessage, Long adminUserId) {
        if (replyMessage == null || replyMessage.trim().isEmpty()) {
            throw new IllegalArgumentException("Reply message cannot be empty");
        }

        ContactEnquiry enquiry = enquiryRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Enquiry not found with ID: " + id));

        // 1. Transactional Database Update: persist reply first
        enquiry.setAdminReply(replyMessage.trim());
        enquiry.setRepliedAt(java.time.LocalDateTime.now());
        enquiry.setIsRead(true);
        ContactEnquiry saved = enquiryRepository.save(enquiry);
        log.info("Persisted admin reply to contact enquiry ID {}", saved.getId());

        // 2. Safe Asynchronous Email Dispatch (Isolated: never fails or rolls back DB record)
        try {
            if (enquiry.getEmail() != null && !enquiry.getEmail().trim().isEmpty()) {
                String subject = enquiry.getSubject() != null && !enquiry.getSubject().trim().isEmpty()
                        ? enquiry.getSubject().trim()
                        : "Contact Enquiry";
                emailService.sendEmail(
                        enquiry.getEmail().trim(),
                        "Re: [CakeStore] " + subject,
                        replyMessage.trim()
                );
            } else {
                log.warn("No contact email found to send reply for enquiry ID {}", id);
            }
        } catch (Exception ex) {
            log.error("Failed to dispatch reply email for contact enquiry ID {}: {}", id, ex.getMessage());
        }

        // 3. Activity Audit Trail
        if (activityLogger != null && adminUserId != null) {
            activityLogger.logActivity(
                    adminUserId,
                    null,
                    "CONTACT_ENQUIRY_REPLIED",
                    "CONTACT_ENQUIRY",
                    saved.getId(),
                    String.format("Admin replied to enquiry (#%d) from %s", saved.getId(), saved.getEmail())
            );
        }
    }

    /**
     * Mark a contact enquiry as read.
     */
    @Transactional
    public void markAsRead(Long id) {
        markAsRead(id, null);
    }

    @Transactional
    public void markAsRead(Long id, Long adminUserId) {
        ContactEnquiry enquiry = enquiryRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Enquiry not found with ID: " + id));

        enquiry.setIsRead(true);
        enquiryRepository.save(enquiry);
        log.info("Marked contact enquiry ID {} as read", id);

        if (activityLogger != null && adminUserId != null) {
            activityLogger.logActivity(
                    adminUserId,
                    null,
                    "CONTACT_ENQUIRY_READ",
                    "CONTACT_ENQUIRY",
                    enquiry.getId(),
                    "Admin marked enquiry #" + enquiry.getId() + " as read"
            );
        }
    }

    private String truncate(String str, int maxLen) {
        if (str == null) return "";
        return str.length() <= maxLen ? str : str.substring(0, maxLen) + "...";
    }
}
