package com.cakeplatform.api.modules.email;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class EmailServiceImpl implements EmailService {

    private final JavaMailSender mailSender;
    private final DevEmailSink devEmailSink;
    private final com.cakeplatform.api.modules.notification.EmailService notificationEmailService;

    @Value("${MAIL_FROM_ADDRESS:noreply@cakeplatform.com}")
    private String fromEmail;

    public EmailServiceImpl(
            @Autowired(required = false) JavaMailSender mailSender,
            @Autowired(required = false) DevEmailSink devEmailSink) {
        this(mailSender, devEmailSink, null);
    }

    @Autowired
    public EmailServiceImpl(
            @Autowired(required = false) JavaMailSender mailSender,
            @Autowired(required = false) DevEmailSink devEmailSink,
            @Autowired(required = false) com.cakeplatform.api.modules.notification.EmailService notificationEmailService) {
        this.mailSender = mailSender;
        this.devEmailSink = devEmailSink;
        this.notificationEmailService = notificationEmailService;
    }

    @Override
    public void sendPasswordResetEmail(String to, String resetLink) {
        String body = "To reset your password, please click the following link:\n\n" +
                      resetLink + "\n\nIf you did not request this, please ignore this email.";

        if (devEmailSink != null) {
            devEmailSink.capture(to, body);
            // In dev/test, we might not have a mailSender configured, but we captured it.
        }

        if (notificationEmailService != null) {
            try {
                notificationEmailService.sendEmail(to, "Password Reset Request", body);
                log.info("Password reset email dispatched to {} via notification email service", to);
                return;
            } catch (Exception e) {
                log.error("Failed to dispatch password reset email to {} via notification email service: {}", to, e.getMessage(), e);
            }
        }

        if (mailSender == null) {
            // DO NOT log the raw resetLink here for security reasons.
            log.warn("No mail delivery provider configured. Email to {} was not sent.", to);
            return;
        }

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromEmail);
            message.setTo(to);
            message.setSubject("Password Reset Request");
            message.setText(body);

            mailSender.send(message);
            log.info("Password reset email sent to {} via JavaMailSender", to);
        } catch (Exception e) {
            log.error("Failed to send password reset email to {}", to, e);
        }
    }
}
