package com.cakeplatform.api.modules.storefront;

import com.cakeplatform.api.modules.auth.entity.OtpVerification;
import com.cakeplatform.api.modules.auth.repository.OtpVerificationRepository;
import com.cakeplatform.api.modules.auth.service.GuestOtpService;
import com.cakeplatform.api.modules.order.Order;
import com.cakeplatform.api.modules.order.OrderRepository;
import com.cakeplatform.api.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import com.cakeplatform.api.modules.notification.SmsService;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class GuestTrackingTest {

    @Mock
    private OtpVerificationRepository otpRepository;
    @Mock
    private SmsService smsService;
    @Mock
    private com.cakeplatform.api.modules.notification.EmailService emailService;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private JwtService jwtService;
    @Mock
    private OrderRepository orderRepository;
    @Mock
    private com.cakeplatform.api.modules.user.UserRepository userRepository;

    @InjectMocks
    private GuestOtpService guestOtpService;

    @BeforeEach
    void setUp() {
    }

    @Test
    void testRequestOtp_NewPhone() {
        when(otpRepository.findTopByPhoneNumberOrderByCreatedAtDesc(any())).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("hashed_otp");
        
        guestOtpService.requestOtp("9876543210");
        
        verify(otpRepository).save(any(OtpVerification.class));
        verify(smsService).sendSms(eq("+919876543210"), contains("code is:"));
    }

    @Test
    void testRequestOtp_ResendCooldown() {
        OtpVerification recentOtp = new OtpVerification();
        recentOtp.setCreatedAt(LocalDateTime.now().minusSeconds(30)); // Inside 60s cooldown
        
        when(otpRepository.findTopByPhoneNumberOrderByCreatedAtDesc(any())).thenReturn(Optional.of(recentOtp));
        
        assertThrows(RuntimeException.class, () -> guestOtpService.requestOtp("9876543210"));
    }

    @Test
    void testRequestOtp_PreviousOtpInvalidation() {
        OtpVerification oldOtp = new OtpVerification();
        oldOtp.setCreatedAt(LocalDateTime.now().minusSeconds(120)); // Past cooldown
        oldOtp.setExpiresAt(LocalDateTime.now().plusMinutes(10));
        
        when(otpRepository.findTopByPhoneNumberOrderByCreatedAtDesc(any())).thenReturn(Optional.of(oldOtp));
        when(passwordEncoder.encode(anyString())).thenReturn("hashed_otp");
        
        guestOtpService.requestOtp("9876543210");
        
        assertTrue(oldOtp.getExpiresAt().isBefore(LocalDateTime.now().plusSeconds(1))); // Invalidated
        verify(otpRepository, times(2)).save(any(OtpVerification.class)); // 1 update, 1 create
    }

    @Test
    void testVerifyOtp_SuccessSingleUse() {
        OtpVerification otp = new OtpVerification();
        otp.setOtpHash("hashed_otp");
        otp.setExpiresAt(LocalDateTime.now().plusMinutes(5));
        
        when(otpRepository.findTopByPhoneNumberOrderByCreatedAtDesc(any())).thenReturn(Optional.of(otp));
        when(passwordEncoder.matches("123456", "hashed_otp")).thenReturn(true);
        when(userRepository.findByMobileIncludingDeleted("9876543210")).thenReturn(Optional.empty());
        
        com.cakeplatform.api.modules.user.User savedUser = new com.cakeplatform.api.modules.user.User();
        savedUser.setMobile("9876543210");
        when(userRepository.save(any())).thenReturn(savedUser);
        when(jwtService.generateToken(any(), any())).thenReturn("jwt_token");
        
        String token = guestOtpService.verifyOtp("9876543210", "123456");
        
        assertEquals("jwt_token", token);
        assertTrue(otp.getExpiresAt().isBefore(LocalDateTime.now().plusSeconds(1))); // Expiry updated to now
    }

    @Test
    void testVerifyOtp_WrongOtp() {
        OtpVerification otp = new OtpVerification();
        otp.setOtpHash("hashed_otp");
        otp.setExpiresAt(LocalDateTime.now().plusMinutes(5));
        
        when(otpRepository.findTopByPhoneNumberOrderByCreatedAtDesc(any())).thenReturn(Optional.of(otp));
        when(passwordEncoder.matches("111111", "hashed_otp")).thenReturn(false);
        
        assertThrows(RuntimeException.class, () -> guestOtpService.verifyOtp("9876543210", "111111"));
        assertEquals(1, otp.getAttempts());
        verify(otpRepository).save(otp);
    }

    @Test
    void testVerifyOtp_TooManyAttempts() {
        OtpVerification otp = new OtpVerification();
        otp.setAttempts(3);
        otp.setExpiresAt(LocalDateTime.now().plusMinutes(5));
        
        when(otpRepository.findTopByPhoneNumberOrderByCreatedAtDesc(any())).thenReturn(Optional.of(otp));
        
        assertThrows(RuntimeException.class, () -> guestOtpService.verifyOtp("9876543210", "123456"));
    }

    @Test
    void testVerifyOtp_Expired() {
        OtpVerification otp = new OtpVerification();
        otp.setExpiresAt(LocalDateTime.now().minusMinutes(1)); // Expired
        
        when(otpRepository.findTopByPhoneNumberOrderByCreatedAtDesc(any())).thenReturn(Optional.of(otp));
        
        assertThrows(RuntimeException.class, () -> guestOtpService.verifyOtp("9876543210", "123456"));
    }

    @Test
    void testRequestOtp_EmailFallback_WhenSmsUnconfigured() {
        when(otpRepository.findTopByPhoneNumberOrderByCreatedAtDesc(any())).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("hashed_otp");
        when(smsService.isConfigured()).thenReturn(false);
        when(emailService.isConfigured()).thenReturn(true);
        when(userRepository.findByMobileIncludingDeleted("9876543210")).thenReturn(Optional.empty());

        com.cakeplatform.api.modules.auth.dto.OtpDeliveryResponse response =
                guestOtpService.requestOtp("9876543210", "customer@example.com");

        assertNotNull(response);
        assertEquals("EMAIL", response.getChannel());
        assertFalse(response.isSmsConfigured());
        assertTrue(response.isEmailConfigured());
        assertTrue(response.getEmailMasked().contains("***"));
        assertEquals("We've sent a 6-digit verification code to your email.", response.getMessage());

        verify(emailService).sendEmail(eq("customer@example.com"), eq("[CakeStore] Your Verification Code"), contains("code is:"));
    }

    @Test
    void testRequestOtp_BothChannels_WhenSmsAndEmailConfigured() {
        when(otpRepository.findTopByPhoneNumberOrderByCreatedAtDesc(any())).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("hashed_otp");
        when(smsService.isConfigured()).thenReturn(true);
        when(emailService.isConfigured()).thenReturn(true);
        when(userRepository.findByMobileIncludingDeleted("9876543210")).thenReturn(Optional.empty());

        com.cakeplatform.api.modules.auth.dto.OtpDeliveryResponse response =
                guestOtpService.requestOtp("9876543210", "buyer@domain.com");

        assertNotNull(response);
        assertEquals("SMS_AND_EMAIL", response.getChannel());
        assertTrue(response.isSmsConfigured());
        assertTrue(response.isEmailConfigured());
        assertEquals("We've sent a 6-digit verification code to your mobile and email.", response.getMessage());

        verify(smsService).sendSms(eq("+919876543210"), contains("code is:"));
        verify(emailService).sendEmail(eq("buyer@domain.com"), eq("[CakeStore] Your Verification Code"), contains("code is:"));
    }

    @Test
    void testRequestOtp_ReusesTrustedAccountEmail_DoesNotOverrideWithUntrusted() {
        com.cakeplatform.api.modules.user.User trustedUser = new com.cakeplatform.api.modules.user.User();
        trustedUser.setMobile("9876543210");
        trustedUser.setEmail("trusted.customer@example.com");

        when(otpRepository.findTopByPhoneNumberOrderByCreatedAtDesc(any())).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("hashed_otp");
        when(smsService.isConfigured()).thenReturn(false);
        when(emailService.isConfigured()).thenReturn(true);
        when(userRepository.findByMobileIncludingDeleted("9876543210")).thenReturn(Optional.of(trustedUser));

        com.cakeplatform.api.modules.auth.dto.OtpDeliveryResponse response =
                guestOtpService.requestOtp("9876543210", "attacker.supplied@evil.com");

        assertNotNull(response);
        // Trusted email was used, NOT attacker.supplied@evil.com
        verify(emailService).sendEmail(eq("trusted.customer@example.com"), eq("[CakeStore] Your Verification Code"), anyString());
        verify(emailService, never()).sendEmail(eq("attacker.supplied@evil.com"), anyString(), anyString());
    }

    @Test
    void testRequestOtp_InvalidEmailHandledSafely() {
        when(otpRepository.findTopByPhoneNumberOrderByCreatedAtDesc(any())).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("hashed_otp");
        when(smsService.isConfigured()).thenReturn(false);
        when(userRepository.findByMobileIncludingDeleted("9876543210")).thenReturn(Optional.empty());

        com.cakeplatform.api.modules.auth.dto.OtpDeliveryResponse response =
                guestOtpService.requestOtp("9876543210", "not-a-valid-email");

        assertNotNull(response);
        assertEquals("MOCK_SMS", response.getChannel());
        verify(emailService, never()).sendEmail(anyString(), anyString(), anyString());
    }
}
