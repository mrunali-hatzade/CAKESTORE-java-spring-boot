package com.cakeplatform.api.modules.auth.service;

import com.cakeplatform.api.modules.auth.entity.OtpVerification;
import com.cakeplatform.api.modules.auth.repository.OtpVerificationRepository;
import com.cakeplatform.api.modules.notification.SmsService;
import com.cakeplatform.api.security.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class GuestOtpService {

    private final OtpVerificationRepository otpRepository;
    private final SmsService smsService;
    private final com.cakeplatform.api.modules.notification.EmailService emailService;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final com.cakeplatform.api.modules.user.UserRepository userRepository;

    private static final int OTP_LENGTH = 6;
    private static final int OTP_EXPIRY_MINUTES = 10;
    private static final int RESEND_COOLDOWN_SECONDS = 60;
    private static final int MAX_ATTEMPTS = 3;
    private static final java.util.regex.Pattern EMAIL_PATTERN =
            java.util.regex.Pattern.compile("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");
    private final SecureRandom secureRandom = new SecureRandom();

    private String normalizePhone(String phone) {
        return com.cakeplatform.api.modules.auth.service.AuthService.normalizeIndianMobile(phone);
    }

    private boolean isValidEmail(String email) {
        return email != null && EMAIL_PATTERN.matcher(email.trim()).matches();
    }

    private String maskPhone(String phone) {
        if (phone == null || phone.length() < 4) return "****";
        return "+91 " + phone.substring(0, 2) + "*****" + phone.substring(phone.length() - 3);
    }

    private String maskEmail(String email) {
        if (email == null || !email.contains("@")) return null;
        String[] parts = email.split("@", 2);
        String name = parts[0];
        String domain = parts[1];
        if (name.length() <= 2) {
            return name.charAt(0) + "***@" + domain;
        }
        return name.charAt(0) + "***" + name.charAt(name.length() - 1) + "@" + domain;
    }

    @Transactional
    public void requestOtp(String phoneNumber) {
        requestOtp(phoneNumber, null);
    }

    @Transactional
    public com.cakeplatform.api.modules.auth.dto.OtpDeliveryResponse requestOtp(String phoneNumber, String candidateEmail) {
        String normalizedPhone = normalizePhone(phoneNumber);
        if (normalizedPhone == null) throw new RuntimeException("Invalid phone number");
        
        // Prevent revealing if user has orders or not in the HTTP response.
        // For rate limiting and resend cooldown:
        Optional<OtpVerification> existing = otpRepository.findTopByPhoneNumberOrderByCreatedAtDesc(normalizedPhone);
        if (existing.isPresent()) {
            OtpVerification otp = existing.get();
            if (otp.getCreatedAt().plusSeconds(RESEND_COOLDOWN_SECONDS).isAfter(LocalDateTime.now())) {
                long secondsLeft = java.time.Duration.between(LocalDateTime.now(), otp.getCreatedAt().plusSeconds(RESEND_COOLDOWN_SECONDS)).getSeconds();
                throw new RuntimeException("Please wait " + secondsLeft + " seconds before requesting a new OTP.");
            }
            // Invalidate old OTP by setting expiry to now
            otp.setExpiresAt(LocalDateTime.now());
            otpRepository.save(otp);
        }

        // Determine trusted customer email if account already exists
        String resolvedEmail = null;
        com.cakeplatform.api.modules.user.User existingUser = userRepository.findByMobileIncludingDeleted(normalizedPhone).orElse(null);
        if (existingUser != null && existingUser.getEmail() != null && !existingUser.getEmail().isBlank()) {
            // Reuse trusted email associated with the authenticated customer account
            resolvedEmail = existingUser.getEmail().trim().toLowerCase();
        } else if (candidateEmail != null && !candidateEmail.isBlank()) {
            String trimmed = candidateEmail.trim().toLowerCase();
            if (isValidEmail(trimmed)) {
                resolvedEmail = trimmed;
            }
        }

        String rawOtp = generateOtp();
        String otpHash = passwordEncoder.encode(rawOtp);

        OtpVerification verification = new OtpVerification();
        verification.setPhoneNumber(normalizedPhone); // Store 10 digit number in DB
        verification.setOtpHash(otpHash);
        verification.setExpiresAt(LocalDateTime.now().plusMinutes(OTP_EXPIRY_MINUTES));
        otpRepository.save(verification);

        boolean smsConfigured = smsService != null && smsService.isConfigured();
        boolean emailConfigured = emailService != null && emailService.isConfigured();
        boolean hasEmail = (resolvedEmail != null && !resolvedEmail.isBlank());

        String channel;
        String deliveryTarget;
        String userMessage;

        if (smsConfigured && emailConfigured && hasEmail) {
            channel = "SMS_AND_EMAIL";
            deliveryTarget = "mobile and email";
            userMessage = "We've sent a 6-digit verification code to your mobile and email.";
        } else if (smsConfigured) {
            channel = "SMS";
            deliveryTarget = "mobile (" + maskPhone(normalizedPhone) + ")";
            userMessage = "We've sent a 6-digit verification code to your mobile.";
        } else if (hasEmail) {
            channel = "EMAIL";
            deliveryTarget = "email (" + maskEmail(resolvedEmail) + ")";
            userMessage = "We've sent a 6-digit verification code to your email.";
        } else {
            channel = "MOCK_SMS";
            deliveryTarget = "mock mobile (" + maskPhone(normalizedPhone) + ")";
            userMessage = "SMS service is operating in mock development mode. Please enter an email address to receive your verification code.";
        }

        // Dispatch SMS
        String smsPhone = "+91" + normalizedPhone;
        String smsMessage = String.format("Your CakeStore order tracking code is: %s.", rawOtp);
        if (smsService != null) {
            smsService.sendSms(smsPhone, smsMessage);
        }

        // Dispatch Email if email was resolved
        if (hasEmail && emailService != null) {
            String emailSubject = "[CakeStore] Your Verification Code";
            String emailBody = String.format(
                    "Hello,\n\n" +
                    "Your CakeStore verification code is: %s\n\n" +
                    "This code is valid for %d minutes and can only be used once.\n" +
                    "If you did not request this verification code, please ignore this email.\n\n" +
                    "Best regards,\nCakeStore Team",
                    rawOtp,
                    OTP_EXPIRY_MINUTES
            );
            emailService.sendEmail(resolvedEmail, emailSubject, emailBody);
        }

        log.info("Dispatched verification OTP for phone {} via channel {}", maskPhone(normalizedPhone), channel);

        return com.cakeplatform.api.modules.auth.dto.OtpDeliveryResponse.builder()
                .channel(channel)
                .deliveryTarget(deliveryTarget)
                .smsConfigured(smsConfigured)
                .emailConfigured(emailConfigured)
                .phoneMasked(maskPhone(normalizedPhone))
                .emailMasked(maskEmail(resolvedEmail))
                .message(userMessage)
                .build();
    }

    @Transactional
    public String verifyOtp(String phoneNumber, String otp) {
        String normalizedPhone = normalizePhone(phoneNumber);
        if (normalizedPhone == null) throw new RuntimeException("Invalid phone number");
        
        OtpVerification verification = otpRepository.findTopByPhoneNumberOrderByCreatedAtDesc(normalizedPhone)
                .orElseThrow(() -> new RuntimeException("Invalid or expired OTP"));

        if (verification.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new RuntimeException("Invalid or expired OTP");
        }

        if (verification.getAttempts() >= MAX_ATTEMPTS) {
            throw new RuntimeException("Maximum verification attempts exceeded. Please request a new OTP.");
        }

        verification.setAttempts(verification.getAttempts() + 1);

        if (!passwordEncoder.matches(otp, verification.getOtpHash())) {
            otpRepository.save(verification); // Save attempt increment
            throw new RuntimeException("Invalid or expired OTP");
        }

        // Success: Invalidate OTP
        verification.setExpiresAt(LocalDateTime.now());
        otpRepository.save(verification);

        // Hydrate Customer Account
        com.cakeplatform.api.modules.user.User user = userRepository.findByMobileIncludingDeleted(normalizedPhone).orElse(null);
        if (user == null) {
            user = new com.cakeplatform.api.modules.user.User();
            user.setMobile(normalizedPhone);
            user.setRole(com.cakeplatform.api.modules.user.UserRole.CUSTOMER);
            user = userRepository.save(user);
        } else if (user.isDeleted()) {
            user.setDeleted(false);
            user = userRepository.save(user);
        }

        // Issue CUSTOMER JWT
        com.cakeplatform.api.security.CustomUserDetails userDetails = new com.cakeplatform.api.security.CustomUserDetails(user);
        java.util.Map<String, Object> extraClaims = new java.util.HashMap<>();
        extraClaims.put("granted_role", "CUSTOMER");
        return jwtService.generateToken(extraClaims, userDetails);
    }

    private String generateOtp() {
        StringBuilder otp = new StringBuilder(OTP_LENGTH);
        for (int i = 0; i < OTP_LENGTH; i++) {
            otp.append(secureRandom.nextInt(10));
        }
        return otp.toString();
    }
}
