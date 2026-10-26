package com.cakeplatform.api.modules.notification;

import com.cakeplatform.api.modules.communication.ContactEnquiry;
import com.cakeplatform.api.modules.communication.PlatformFeedback;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

@Service
@Slf4j
public class EmailService {

    @Value("${mail.admin-notification-email:${app.admin.default-email:admin@cakeplatform.com}}")
    private String adminNotificationEmail;

    @Value("${mail.from-address:${MAIL_FROM_ADDRESS:onboarding@resend.dev}}")
    private String mailFrom;

    @Value("${mail.resend.api-key:${RESEND_API_KEY:}}")
    private String resendApiKey;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    /**
     * Send email notification to configured administrator for public contact enquiry.
     * Guaranteed never to fail or roll back the calling database transaction.
     */
    @Async
    public void sendContactEnquiryEmail(ContactEnquiry enquiry) {
        String subject = String.format("[CakeStore Contact] %s - From %s", enquiry.getSubject(), enquiry.getName());
        String body = String.format(
                "New Contact Us Enquiry Received on CakeStore\n" +
                "----------------------------------------------\n" +
                "Enquiry ID : #%d\n" +
                "Sender Name: %s\n" +
                "Email      : %s\n" +
                "Phone      : %s\n" +
                "Subject    : %s\n" +
                "Received At: %s\n\n" +
                "Message:\n%s\n" +
                "----------------------------------------------\n" +
                "Reply directly by emailing %s",
                enquiry.getId(),
                enquiry.getName(),
                enquiry.getEmail(),
                enquiry.getPhone() != null ? enquiry.getPhone() : "Not provided",
                enquiry.getSubject(),
                enquiry.getCreatedAt(),
                enquiry.getMessage(),
                enquiry.getEmail()
        );

        deliverEmail(adminNotificationEmail, subject, body);
    }

    /**
     * Send email notification to configured administrator for shop owner platform feedback.
     * Guaranteed never to fail or roll back the calling database transaction.
     */
    @Async
    public void sendOwnerFeedbackEmail(PlatformFeedback feedback, String shopName, String ownerEmail) {
        String subject = String.format("[CakeStore Platform Feedback] %d/5 Stars - %s (%s)",
                feedback.getRating(), feedback.getCategory(), shopName != null ? shopName : "Direct Owner");
        String body = String.format(
                "New Platform Feedback Submitted by Shop Owner\n" +
                "----------------------------------------------\n" +
                "Feedback ID : #%d\n" +
                "Bakery      : %s\n" +
                "Owner Email : %s\n" +
                "Rating      : %d / 5 Stars\n" +
                "Category    : %s\n" +
                "Submitted At: %s\n\n" +
                "Feedback Message:\n%s\n" +
                "----------------------------------------------\n" +
                "View and manage in Admin Feedback Center: /admin/feedback",
                feedback.getId(),
                shopName != null ? shopName : "N/A",
                ownerEmail != null ? ownerEmail : "N/A",
                feedback.getRating(),
                feedback.getCategory(),
                feedback.getCreatedAt(),
                feedback.getMessage()
        );

        deliverEmail(adminNotificationEmail, subject, body);
    }

    /**
     * Generic asynchronous email delivery method.
     */
    @Async
    public void sendEmail(String to, String subject, String body) {
        deliverEmail(to, subject, body);
    }

    /**
     * Internal delivery handler supporting Resend API or structured log delivery.
     * Safely traps all exceptions to ensure business operations are never affected by email network failures.
     */
    private void deliverEmail(String to, String subject, String body) {
        if (to == null || to.trim().isEmpty()) {
            log.warn("Email delivery skipped: No recipient specified");
            return;
        }

        try {
            if (resendApiKey != null && !resendApiKey.trim().isEmpty()) {
                sendViaResend(to, subject, body);
            } else {
                // Development/Test fallback with detailed structured log
                log.info("=================================================");
                log.info("📧 [TRANSACTIONAL EMAIL DISPATCHED]");
                log.info("From   : {}", mailFrom);
                log.info("To     : {}", to);
                log.info("Subject: {}", subject);
                log.info("Body:\n{}", maskSensitiveLog(body));
                log.info("=================================================");
            }
        } catch (Exception ex) {
            log.error("Failed to deliver transactional email to {} for subject '{}': {}", to, subject, ex.getMessage(), ex);
        }
    }

    public boolean isConfigured() {
        return resendApiKey != null && !resendApiKey.trim().isEmpty();
    }

    private String maskSensitiveLog(String content) {
        if (content == null) {
            return null;
        }
        String masked = content.replaceAll("(?i)([#?&]token=)[^&\\s]+", "$1[REDACTED]");
        masked = masked.replaceAll("(?i)(\\b(?:code|otp) is:?\\s*)[0-9]{6}", "$1[REDACTED]");
        masked = masked.replaceAll("(?i)(\\b(?:code|otp):?\\s*)[0-9]{6}", "$1[REDACTED]");
        return masked;
    }

    private void sendViaResend(String to, String subject, String body) {
        try {
            String jsonPayload = String.format(
                    "{\"from\":\"%s\",\"to\":[\"%s\"],\"subject\":%s,\"text\":%s}",
                    escapeJson(mailFrom),
                    escapeJson(to),
                    quoteJson(subject),
                    quoteJson(body)
            );

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.resend.com/emails"))
                    .header("Authorization", "Bearer " + resendApiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                log.info("Transactional email successfully sent via Resend to {} (status: {})", to, response.statusCode());
            } else {
                log.warn("Resend API returned non-success response: status={}, body={}", response.statusCode(), response.body());
            }
        } catch (Exception ex) {
            log.error("Resend API HTTP delivery failed: {}", ex.getMessage());
        }
    }

    private String quoteJson(String text) {
        if (text == null) return "\"\"";
        return "\"" + escapeJson(text) + "\"";
    }

    private String escapeJson(String text) {
        if (text == null) return "";
        return text.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\b", "\\b")
                .replace("\f", "\\f")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }
}
