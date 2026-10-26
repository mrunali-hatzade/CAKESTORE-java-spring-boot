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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import java.time.LocalDateTime;
import java.util.List;

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

    @Test
    void getMyPayments_DefaultPagination_ReturnsPageWithDefaults() throws Exception {
        Payment p1 = new Payment();
        p1.setId(101L);
        p1.setShop(testShop);
        p1.setAmount(new BigDecimal("499.00"));
        p1.setStatus("COMPLETED");
        p1.setProviderPaymentId("pay_101");
        p1.setCreatedAt(LocalDateTime.now().minusDays(1));

        SubscriptionPlan plan = new SubscriptionPlan();
        plan.setId(1L);
        plan.setName("Starter Plan");
        p1.setPlan(plan);

        when(paymentRepository.findSubscriptionPaymentsByShopId(eq(10L), any(Pageable.class)))
                .thenAnswer(inv -> {
                    Pageable pageable = inv.getArgument(1);
                    return new PageImpl<>(List.of(p1), pageable, 1);
                });

        mockMvc.perform(get("/api/owner/payments")
                .with(user(testUser))
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value(101))
                .andExpect(jsonPath("$.content[0].subscriptionPlanName").value("Starter Plan"))
                .andExpect(jsonPath("$.content[0].invoiceAvailable").value(true))
                .andExpect(jsonPath("$.number").value(0))
                .andExpect(jsonPath("$.size").value(10))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.totalPages").value(1))
                .andExpect(jsonPath("$.first").value(true))
                .andExpect(jsonPath("$.last").value(true));

        verify(paymentRepository).findSubscriptionPaymentsByShopId(eq(10L), eq(PageRequest.of(0, 10)));
    }

    @Test
    void getMyPayments_CustomPageAndSize_Honored() throws Exception {
        when(paymentRepository.findSubscriptionPaymentsByShopId(eq(10L), any(Pageable.class)))
                .thenAnswer(inv -> {
                    Pageable pageable = inv.getArgument(1);
                    return new PageImpl<>(List.of(), pageable, 25);
                });

        mockMvc.perform(get("/api/owner/payments?page=2&size=5")
                .with(user(testUser))
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.number").value(2))
                .andExpect(jsonPath("$.size").value(5))
                .andExpect(jsonPath("$.totalElements").value(25))
                .andExpect(jsonPath("$.totalPages").value(5));

        verify(paymentRepository).findSubscriptionPaymentsByShopId(eq(10L), eq(PageRequest.of(2, 5)));
    }

    @Test
    void getMyPayments_PageSizeClampedToMax50() throws Exception {
        when(paymentRepository.findSubscriptionPaymentsByShopId(eq(10L), any(Pageable.class)))
                .thenAnswer(inv -> {
                    Pageable pageable = inv.getArgument(1);
                    return new PageImpl<>(List.of(), pageable, 0);
                });

        mockMvc.perform(get("/api/owner/payments?page=0&size=100")
                .with(user(testUser))
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(50));

        verify(paymentRepository).findSubscriptionPaymentsByShopId(eq(10L), eq(PageRequest.of(0, 50)));
    }

    @Test
    void getMyPayments_PageSizeClampedToMin1() throws Exception {
        when(paymentRepository.findSubscriptionPaymentsByShopId(eq(10L), any(Pageable.class)))
                .thenAnswer(inv -> {
                    Pageable pageable = inv.getArgument(1);
                    return new PageImpl<>(List.of(), pageable, 0);
                });

        mockMvc.perform(get("/api/owner/payments?page=0&size=-5")
                .with(user(testUser))
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(1));

        verify(paymentRepository).findSubscriptionPaymentsByShopId(eq(10L), eq(PageRequest.of(0, 1)));
    }

    @Test
    void getMyPayments_NegativePageClampedToZero() throws Exception {
        when(paymentRepository.findSubscriptionPaymentsByShopId(eq(10L), any(Pageable.class)))
                .thenAnswer(inv -> {
                    Pageable pageable = inv.getArgument(1);
                    return new PageImpl<>(List.of(), pageable, 0);
                });

        mockMvc.perform(get("/api/owner/payments?page=-3&size=10")
                .with(user(testUser))
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.number").value(0));

        verify(paymentRepository).findSubscriptionPaymentsByShopId(eq(10L), eq(PageRequest.of(0, 10)));
    }

    @Test
    void getMyPayments_OutOfRangePage_ReturnsEmptyContentWithMetadata() throws Exception {
        when(paymentRepository.findSubscriptionPaymentsByShopId(eq(10L), any(Pageable.class)))
                .thenAnswer(inv -> {
                    Pageable pageable = inv.getArgument(1);
                    return new PageImpl<>(List.of(), pageable, 10);
                });

        mockMvc.perform(get("/api/owner/payments?page=999&size=10")
                .with(user(testUser))
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isEmpty())
                .andExpect(jsonPath("$.empty").value(true))
                .andExpect(jsonPath("$.number").value(999))
                .andExpect(jsonPath("$.totalElements").value(10))
                .andExpect(jsonPath("$.totalPages").value(1));
    }

    @Test
    void getMyPayments_TenantIsolation_UsesAuthenticatedOwnerShopOnly() throws Exception {
        when(paymentRepository.findSubscriptionPaymentsByShopId(eq(10L), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 10), 0));

        // Attempting to supply another shop ID via param or query has no effect
        mockMvc.perform(get("/api/owner/payments?shopId=999")
                .with(user(testUser))
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());

        // Verified strictly called with testShop ID (10L), never arbitrary shop 999
        verify(paymentRepository).findSubscriptionPaymentsByShopId(eq(10L), any(Pageable.class));
    }
}
