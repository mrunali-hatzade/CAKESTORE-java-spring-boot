package com.cakeplatform.api.modules.payment.controller;

import com.cakeplatform.api.modules.payment.Payment;
import com.cakeplatform.api.modules.payment.RazorpayService;
import com.cakeplatform.api.modules.security.ShopAccessValidator;
import com.cakeplatform.api.modules.shop.Shop;
import com.cakeplatform.api.modules.subscription.SubscriptionPlan;
import com.cakeplatform.api.modules.subscription.SubscriptionPlanRepository;
import com.cakeplatform.api.modules.subscription.SubscriptionService;
import com.cakeplatform.api.security.CustomUserDetails;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class OwnerPaymentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ShopAccessValidator shopAccessValidator;

    @MockBean
    private SubscriptionPlanRepository planRepository;

    @MockBean
    private SubscriptionService subscriptionService;

    @MockBean
    private RazorpayService razorpayService;

    @MockBean
    private com.cakeplatform.api.modules.payment.PaymentRepository paymentRepository;

    @Autowired
    private ObjectMapper objectMapper;

    private CustomUserDetails testUser;
    private Shop testShop;

    @BeforeEach
    void setUp() {
        com.cakeplatform.api.modules.user.User u = new com.cakeplatform.api.modules.user.User();
        u.setId(1L);
        u.setEmail("owner@test.com");
        u.setPasswordHash("password");
        u.setRole(com.cakeplatform.api.modules.user.UserRole.SHOP_OWNER);
        testUser = new CustomUserDetails(u);
        testShop = new Shop();
        testShop.setId(10L);
        testShop.setBusinessName("Test Shop");
        
        when(shopAccessValidator.getShopByOwnerId(1L)).thenReturn(testShop);
        when(shopAccessValidator.validateBillingAccess(1L)).thenReturn(testShop);
        when(razorpayService.getKeyId()).thenReturn("test_key");
        when(razorpayService.isConfigured()).thenReturn(true);
        when(razorpayService.createSubscriptionOrder(any(), any(), any(), any())).thenReturn("order_test_123");
        when(paymentRepository.save(any(com.cakeplatform.api.modules.payment.Payment.class))).thenAnswer(inv -> {
            com.cakeplatform.api.modules.payment.Payment p = inv.getArgument(0);
            if (p.getId() == null) p.setId(1L);
            return p;
        });
    }

    @Test
    void initiatePayment_UsesDBPrice() throws Exception {
        SubscriptionPlan plan = new SubscriptionPlan();
        plan.setId(99L);
        plan.setPrice(new BigDecimal("399.00"));
        plan.setDurationDays(30);
        plan.setIsActive(true);

        when(planRepository.findById(99L)).thenReturn(Optional.of(plan));

        Map<String, Object> payload = Map.of("planId", 99L);

        mockMvc.perform(post("/api/owner/payments/initiate-subscription")
                .with(user(testUser))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.amount").value(399.00))
                .andExpect(jsonPath("$.durationDays").value(30));
    }

    @Test
    void initiatePayment_RejectsUnknownPlan() throws Exception {
        when(planRepository.findById(99L)).thenReturn(Optional.empty());

        Map<String, Object> payload = Map.of("planId", 99L);

        mockMvc.perform(post("/api/owner/payments/initiate-subscription")
                .with(user(testUser))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void initiatePayment_RejectsInactivePlan() throws Exception {
        SubscriptionPlan plan = new SubscriptionPlan();
        plan.setId(99L);
        plan.setIsActive(false); // Inactive!

        when(planRepository.findById(99L)).thenReturn(Optional.of(plan));

        Map<String, Object> payload = Map.of("planId", 99L);

        mockMvc.perform(post("/api/owner/payments/initiate-subscription")
                .with(user(testUser))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isBadRequest()); // IllegalStateException is mapped to 400
    }

    @Test
    void verifyPayment_SignatureEnforcement_UnconfiguredAndWrongSignature() throws Exception {
        when(razorpayService.isConfigured()).thenReturn(false);
        // It must throw if signature is NOT "simulated_test_sig"
        Map<String, Object> payload = Map.of(
                "planId", 99L,
                "razorpayOrderId", "order_1",
                "razorpayPaymentId", "pay_1",
                "razorpaySignature", "bad_signature"
        );
        SubscriptionPlan plan = new SubscriptionPlan();
        plan.setId(99L);
        plan.setIsActive(true);
        when(planRepository.findById(99L)).thenReturn(Optional.of(plan));

        mockMvc.perform(post("/api/owner/payments/verify-subscription")
                .with(user(testUser))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void verifyPayment_SignatureEnforcement_ConfiguredAndWrongSignature() throws Exception {
        when(razorpayService.isConfigured()).thenReturn(true);
        when(razorpayService.verifyPaymentSignature(any(), any(), any())).thenReturn(false);

        Map<String, Object> payload = Map.of(
                "planId", 99L,
                "razorpayOrderId", "order_1",
                "razorpayPaymentId", "pay_1",
                "razorpaySignature", "bad_signature"
        );
        SubscriptionPlan plan = new SubscriptionPlan();
        plan.setId(99L);
        plan.setIsActive(true);
        when(planRepository.findById(99L)).thenReturn(Optional.of(plan));

        mockMvc.perform(post("/api/owner/payments/verify-subscription")
                .with(user(testUser))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void verifyPayment_RazorpayAmountMismatch() throws Exception {
        when(razorpayService.isConfigured()).thenReturn(true);
        when(razorpayService.verifyPaymentSignature(any(), any(), any())).thenReturn(true);
        
        // Throw mismatch from verifyOrderDetails
        org.mockito.Mockito.doThrow(new IllegalArgumentException("Payment verification failed. Amount mismatch from provider."))
                .when(razorpayService).verifyOrderDetails(any(), any(), any());

        Map<String, Object> payload = Map.of(
                "planId", 99L,
                "razorpayOrderId", "order_1",
                "razorpayPaymentId", "pay_1",
                "razorpaySignature", "good_signature"
        );
        SubscriptionPlan plan = new SubscriptionPlan();
        plan.setId(99L);
        plan.setIsActive(true);
        when(planRepository.findById(99L)).thenReturn(Optional.of(plan));

        mockMvc.perform(post("/api/owner/payments/verify-subscription")
                .with(user(testUser))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isBadRequest());
    }
}
