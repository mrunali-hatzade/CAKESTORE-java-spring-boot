package com.cakeplatform.api.modules.email;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EmailServiceImplTest {

    @Mock
    private JavaMailSender mailSender;

    @Mock
    private DevEmailSink devEmailSink;

    @Mock
    private com.cakeplatform.api.modules.notification.EmailService notificationEmailService;

    private EmailServiceImpl emailService;

    @BeforeEach
    void setUp() {
        emailService = new EmailServiceImpl(mailSender, devEmailSink, notificationEmailService);
    }

    @Test
    @DisplayName("Valid password reset delegates to notification email service")
    void sendPasswordResetEmail_delegatesToNotificationService() {
        String recipient = "owner@bakery.com";
        String link = "https://app.cakestore.com/reset-password#token=secret123";

        emailService.sendPasswordResetEmail(recipient, link);

        // Verify devEmailSink captured the email
        verify(devEmailSink, times(1)).capture(eq(recipient), contains("token=secret123"));

        // Verify notificationEmailService was invoked with expected parameters
        ArgumentCaptor<String> bodyCaptor = ArgumentCaptor.forClass(String.class);
        verify(notificationEmailService, times(1)).sendEmail(
                eq(recipient),
                eq("Password Reset Request"),
                bodyCaptor.capture()
        );
        assertThat(bodyCaptor.getValue()).contains(link);

        // Verify JavaMailSender was not used since notification service handled it
        verify(mailSender, never()).send(any(SimpleMailMessage.class));
    }

    @Test
    @DisplayName("Email provider failure is handled safely without throwing")
    void sendPasswordResetEmail_handlesNotificationServiceFailureGracefully() {
        String recipient = "owner@bakery.com";
        String link = "https://app.cakestore.com/reset-password#token=secret123";

        doThrow(new RuntimeException("Resend API 500 Internal Error"))
                .when(notificationEmailService).sendEmail(anyString(), anyString(), anyString());

        // Should not throw exception
        assertThatCode(() -> emailService.sendPasswordResetEmail(recipient, link))
                .doesNotThrowAnyException();

        // Verify fallback attempted to mailSender if notification service threw
        verify(mailSender, times(1)).send(any(SimpleMailMessage.class));
    }

    @Test
    @DisplayName("Fallback to JavaMailSender when notification email service is null")
    void sendPasswordResetEmail_fallsBackToMailSenderWhenNotificationServiceNull() {
        EmailServiceImpl fallbackService = new EmailServiceImpl(mailSender, devEmailSink, null);
        String recipient = "owner@bakery.com";
        String link = "https://app.cakestore.com/reset-password#token=secret123";

        fallbackService.sendPasswordResetEmail(recipient, link);

        verify(mailSender, times(1)).send(any(SimpleMailMessage.class));
    }

    @Test
    @DisplayName("Does not fail when both notification service and mailSender are null")
    void sendPasswordResetEmail_handlesNullProvidersGracefully() {
        EmailServiceImpl noProviderService = new EmailServiceImpl(null, devEmailSink, null);
        String recipient = "owner@bakery.com";
        String link = "https://app.cakestore.com/reset-password#token=secret123";

        assertThatCode(() -> noProviderService.sendPasswordResetEmail(recipient, link))
                .doesNotThrowAnyException();

        verify(devEmailSink, times(1)).capture(eq(recipient), contains("token=secret123"));
    }
}
