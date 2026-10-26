package com.cakeplatform.api.modules.notification;

import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import com.twilio.Twilio;
import com.twilio.rest.api.v2010.account.Message;
import com.twilio.type.PhoneNumber;
import jakarta.annotation.PostConstruct;

@Service
@Slf4j
public class SmsService {

    @Value("${twilio.account-sid:#{null}}")
    private String accountSid;

    @Value("${twilio.auth-token:#{null}}")
    private String authToken;

    @Value("${twilio.phone-number:#{null}}")
    private String fromPhoneNumber;

    @Value("${app.sms.log-payloads:false}")
    private boolean logPayloads;

    private boolean isConfigured = false;

    public boolean isConfigured() {
        return isConfigured;
    }

    @PostConstruct
    public void init() {
        if (accountSid != null && authToken != null && fromPhoneNumber != null && !accountSid.isBlank()) {
            Twilio.init(accountSid, authToken);
            isConfigured = true;
            log.info("Twilio SMS Service successfully configured.");
        } else {
            log.warn("Twilio SMS credentials are not fully configured. SMS will NOT be sent. Please configure twilio.account-sid, twilio.auth-token, and twilio.phone-number in application.yml.");
        }
    }

    @Async
    public void sendSms(String toPhoneNumber, String messageBody) {
        if (!isConfigured) {
            if (logPayloads) {
                log.warn("Mock SMS (Local Dev): To {}, Message: {}", toPhoneNumber, messageBody);
            } else {
                log.warn("Mock SMS: Cannot send to {} because Twilio is not configured. Message would have been: [Hidden for Security]", toPhoneNumber);
            }
            return;
        }

        try {
            Message message = Message.creator(
                    new PhoneNumber(toPhoneNumber),
                    new PhoneNumber(fromPhoneNumber),
                    messageBody
            ).create();
            log.info("Sent SMS to {}. SID: {}", toPhoneNumber, message.getSid());
        } catch (Exception e) {
            log.error("Failed to send SMS to {}: {}", toPhoneNumber, e.getMessage());
        }
    }
}
