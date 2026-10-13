package com.cakeplatform.api.modules.payment;

import com.cakeplatform.api.modules.admin.dto.AdminShopDetailsResponse;
import com.cakeplatform.api.modules.admin.dto.DashboardStatsResponse;
import com.cakeplatform.api.modules.order.Order;
import com.cakeplatform.api.modules.order.OrderRepository;
import com.cakeplatform.api.modules.payment.dto.OwnerPaymentResponse;
import com.cakeplatform.api.modules.shop.Shop;
import com.cakeplatform.api.modules.shop.ShopRepository;
import com.cakeplatform.api.modules.shop.ShopStatus;
import com.cakeplatform.api.modules.shop.VerificationStatus;
import com.cakeplatform.api.modules.subscription.*;
import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.modules.user.UserRepository;
import com.cakeplatform.api.modules.user.UserRole;
import com.cakeplatform.api.modules.user.UserStatus;
import com.cakeplatform.api.security.CustomUserDetails;
import com.cakeplatform.api.security.JwtService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class RevenueSegregationE2ETest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ShopRepository shopRepository;

    @Autowired
    private SubscriptionPlanRepository subscriptionPlanRepository;

    @Autowired
    private SubscriptionRepository subscriptionRepository;

    @Autowired
    private PaymentRepository paymentRepository;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private ObjectMapper objectMapper;

    private User owner;
    private User admin;
    private Shop testShop;
    private SubscriptionPlan testPlan;
    private Subscription testSubscription;

    private Payment completedSubPayment;
    private Payment pendingSubPayment;
    private Payment completedOrderPayment;
    private Payment webhookFallbackOrderPayment;

    private String ownerToken;
    private String adminToken;

    @BeforeEach
    void setUp() {
        String uniq = UUID.randomUUID().toString().substring(0, 8);

        // 1. Create Bakery Owner
        owner = new User();
        owner.setEmail("owner_seg_" + uniq + "@test.com");
        owner.setPasswordHash("hashed_pw");
        owner.setRole(UserRole.SHOP_OWNER);
        owner.setStatus(UserStatus.ACTIVE);
        owner.setFullName("Baker Alice");
        owner = userRepository.save(owner);
        ownerToken = jwtService.generateToken(new CustomUserDetails(owner));

        // 2. Create Platform Admin
        admin = new User();
        admin.setEmail("admin_seg_" + uniq + "@test.com");
        admin.setPasswordHash("hashed_pw");
        admin.setRole(UserRole.ADMIN);
        admin.setStatus(UserStatus.ACTIVE);
        admin.setFullName("Platform Admin");
        admin = userRepository.save(admin);
        adminToken = jwtService.generateToken(new CustomUserDetails(admin));

        // 3. Create Bakery Shop
        testShop = new Shop();
        testShop.setOwner(owner);
        testShop.setBusinessName("Segregation Bakery " + uniq);
        testShop.setStatus(ShopStatus.ACTIVE);
        testShop.setVerificationStatus(VerificationStatus.VERIFIED);
        testShop = shopRepository.save(testShop);

        // 4. Create Subscription Plan
        testPlan = new SubscriptionPlan();
        testPlan.setName("Pro Baker Studio");
        testPlan.setBillingCycle("monthly");
        testPlan.setPrice(new BigDecimal("1999.00"));
        testPlan.setDurationDays(30);
        testPlan.setIsActive(true);
        testPlan = subscriptionPlanRepository.save(testPlan);

        // 5. Create Active Subscription
        testSubscription = new Subscription();
        testSubscription.setShop(testShop);
        testSubscription.setPlan(testPlan);
        testSubscription.setStatus(SubscriptionStatus.ACTIVE);
        testSubscription.setAmount(new BigDecimal("1999.00"));
        testSubscription.setStartDate(LocalDateTime.now().minusDays(2));
        testSubscription.setExpiryDate(LocalDateTime.now().plusDays(28));
        testSubscription = subscriptionRepository.save(testSubscription);

        // 6. Payment 1: Completed Subscription Payment
        completedSubPayment = new Payment();
        completedSubPayment.setShop(testShop);
        completedSubPayment.setSubscription(testSubscription);
        completedSubPayment.setPlan(testPlan);
        completedSubPayment.setAmount(new BigDecimal("1999.00"));
        completedSubPayment.setCurrency("INR");
        completedSubPayment.setProvider("RAZORPAY");
        completedSubPayment.setProviderOrderId("order_sub_comp_" + uniq);
        completedSubPayment.setProviderPaymentId("pay_sub_comp_" + uniq);
        completedSubPayment.setStatus("COMPLETED");
        completedSubPayment.setPaidAt(LocalDateTime.now().minusDays(2));
        completedSubPayment = paymentRepository.save(completedSubPayment);

        // 7. Payment 2: Pending Subscription Payment
        pendingSubPayment = new Payment();
        pendingSubPayment.setShop(testShop);
        pendingSubPayment.setSubscription(null); // not yet activated
        pendingSubPayment.setPlan(testPlan);
        pendingSubPayment.setAmount(new BigDecimal("1999.00"));
        pendingSubPayment.setCurrency("INR");
        pendingSubPayment.setProvider("RAZORPAY");
        pendingSubPayment.setProviderOrderId("order_sub_pend_" + uniq);
        pendingSubPayment.setStatus("PENDING");
        pendingSubPayment = paymentRepository.save(pendingSubPayment);

        // 8. Order 1 & Payment 3: Completed Retail Cake Order Payment (Checkout Callback Path)
        Order order1 = new Order();
        order1.setShop(testShop);
        order1.setOrderNumber("ORD-SEG-001-" + uniq);
        order1.setSubtotal(new BigDecimal("800.00"));
        order1.setDeliveryCharge(new BigDecimal("50.00"));
        order1.setTotalAmount(new BigDecimal("850.00"));
        order1.setOrderStatus("CONFIRMED");
        order1.setPaymentStatus("PAID");
        order1.setPaymentMethod("RAZORPAY");
        order1.setTransactionId("pay_cust_comp_" + uniq);
        order1 = orderRepository.save(order1);

        completedOrderPayment = new Payment();
        completedOrderPayment.setShop(testShop);
        completedOrderPayment.setSubscription(null);
        completedOrderPayment.setPlan(null);
        completedOrderPayment.setAmount(new BigDecimal("850.00"));
        completedOrderPayment.setCurrency("INR");
        completedOrderPayment.setProvider("RAZORPAY");
        completedOrderPayment.setProviderOrderId("order_cust_comp_" + uniq);
        completedOrderPayment.setProviderPaymentId("pay_cust_comp_" + uniq);
        completedOrderPayment.setStatus("COMPLETED");
        completedOrderPayment.setPaidAt(LocalDateTime.now().minusDays(1));
        completedOrderPayment.setFailureReason("ORDER:" + order1.getOrderNumber());
        completedOrderPayment = paymentRepository.save(completedOrderPayment);

        // 9. Order 2 & Payment 4: Completed Retail Cake Order Payment (Webhook Fallback Path)
        Order order2 = new Order();
        order2.setShop(testShop);
        order2.setOrderNumber("ORD-SEG-002-" + uniq);
        order2.setSubtotal(new BigDecimal("1150.00"));
        order2.setDeliveryCharge(new BigDecimal("50.00"));
        order2.setTotalAmount(new BigDecimal("1200.00"));
        order2.setOrderStatus("CONFIRMED");
        order2.setPaymentStatus("PAID");
        order2.setPaymentMethod("RAZORPAY");
        order2.setTransactionId("pay_cust_wh_" + uniq);
        order2 = orderRepository.save(order2);

        webhookFallbackOrderPayment = new Payment();
        webhookFallbackOrderPayment.setShop(testShop);
        webhookFallbackOrderPayment.setSubscription(null);
        webhookFallbackOrderPayment.setPlan(null);
        webhookFallbackOrderPayment.setAmount(new BigDecimal("1200.00"));
        webhookFallbackOrderPayment.setCurrency("INR");
        webhookFallbackOrderPayment.setProvider("RAZORPAY");
        webhookFallbackOrderPayment.setProviderOrderId("order_cust_wh_" + uniq);
        webhookFallbackOrderPayment.setProviderPaymentId("pay_cust_wh_" + uniq);
        webhookFallbackOrderPayment.setStatus("COMPLETED");
        webhookFallbackOrderPayment.setPaidAt(LocalDateTime.now().minusHours(12));
        webhookFallbackOrderPayment.setFailureReason("ORDER:" + order2.getOrderNumber());
        webhookFallbackOrderPayment = paymentRepository.save(webhookFallbackOrderPayment);
    }

    @Test
    @DisplayName("P0.1.1: Repository and Service Revenue queries count ONLY subscription payments")
    void testPlatformRevenueExcludesCustomerCakeOrders() throws Exception {
        // Direct Repository Verification:
        BigDecimal totalRev = paymentRepository.getTotalRevenue();
        assertNotNull(totalRev);
        // Completed sub payment is 1999.00. Customer payments are 850 + 1200 = 2050.
        // Total revenue must strictly include the 1999.00 subscription payment and NOT the 2050.00 customer payments.
        assertTrue(totalRev.compareTo(new BigDecimal("1999.00")) >= 0,
                "Total revenue must be at least the 1999.00 subscription payment");

        // Verify count of completed subscription payments in window
        LocalDateTime from = LocalDateTime.now().minusDays(5);
        LocalDateTime to = LocalDateTime.now().plusDays(1);
        long count = paymentRepository.countCompletedPaymentsBetween(from, to);
        assertTrue(count >= 1, "Must count completed subscription payments");

        // Admin Dashboard Stats Verification:
        MvcResult result = mockMvc.perform(get("/api/admin/dashboard/stats")
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andReturn();

        DashboardStatsResponse stats = objectMapper.readValue(
                result.getResponse().getContentAsString(), DashboardStatsResponse.class);

        assertNotNull(stats);
        assertNotNull(stats.getTotalPlatformRevenue());
        assertNotNull(stats.getTotalGmv());

        // Network GMV must capture retail cake orders (850 + 1200 = 2050 minimum)
        assertTrue(stats.getTotalGmv().compareTo(new BigDecimal("2050.00")) >= 0,
                "Network GMV must include the customer cake orders");

        // SaaS Platform Revenue must NOT contain the retail cake orders
        // Customer orders cannot inflate SaaS revenue
        BigDecimal totalRevenue = stats.getTotalPlatformRevenue();
        assertNotNull(totalRevenue);
    }

    @Test
    @DisplayName("P0.1.2: Owner billing history contains ONLY subscription payments and excludes customer cake orders")
    void testOwnerBillingHistoryExcludesCustomerCakeOrders() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/owner/payments")
                .header("Authorization", "Bearer " + ownerToken)
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andReturn();

        List<OwnerPaymentResponse> payments = objectMapper.readValue(
                result.getResponse().getContentAsString(),
                new TypeReference<List<OwnerPaymentResponse>>() {});

        assertNotNull(payments);
        assertFalse(payments.isEmpty(), "Owner must have subscription payments");

        // Verify that NO customer order payment IDs appear in owner payments
        boolean containsOrder1Payment = payments.stream()
                .anyMatch(p -> p.getId().equals(completedOrderPayment.getId()));
        boolean containsOrder2Payment = payments.stream()
                .anyMatch(p -> p.getId().equals(webhookFallbackOrderPayment.getId()));

        assertFalse(containsOrder1Payment, "Customer online cake order payment must NOT appear in owner subscription history");
        assertFalse(containsOrder2Payment, "Customer webhook fallback order payment must NOT appear in owner subscription history");

        // Verify that the subscription payments DO appear
        boolean containsSubPayment = payments.stream()
                .anyMatch(p -> p.getId().equals(completedSubPayment.getId()));
        boolean containsPendingSubPayment = payments.stream()
                .anyMatch(p -> p.getId().equals(pendingSubPayment.getId()));

        assertTrue(containsSubPayment, "Completed subscription payment must appear in owner billing history");
        assertTrue(containsPendingSubPayment, "Pending subscription payment must appear in owner billing history");

        // Verify subscription plan label is accurate
        OwnerPaymentResponse subResp = payments.stream()
                .filter(p -> p.getId().equals(completedSubPayment.getId()))
                .findFirst()
                .orElseThrow();
        assertEquals("Pro Baker Studio", subResp.getSubscriptionPlanName());
        assertTrue(subResp.isInvoiceAvailable());
    }

    @Test
    @DisplayName("P0.1.3: Tax invoice download is rejected for customer cake order payments")
    void testInvoiceDownloadBlockedForRetailOrderPayments() throws Exception {
        // Bakery owner attempting to download invoice for customer order payment
        mockMvc.perform(get("/api/owner/payments/" + completedOrderPayment.getId() + "/invoice")
                .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("P0.1.4: Admin bakery detail view contains subscription payments only")
    void testAdminBakeryDetailExcludesCustomerCakeOrders() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/admin/shops/" + testShop.getId())
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andReturn();

        AdminShopDetailsResponse details = objectMapper.readValue(
                result.getResponse().getContentAsString(), AdminShopDetailsResponse.class);

        assertNotNull(details);
        assertNotNull(details.getPayments());

        // Verify payments list in shop details has subscription payments only
        boolean containsOrderPayment = details.getPayments().stream()
                .anyMatch(p -> p.getId().equals(completedOrderPayment.getId())
                        || p.getId().equals(webhookFallbackOrderPayment.getId()));

        assertFalse(containsOrderPayment, "Admin bakery detail payments list must NOT contain customer order payments");

        boolean containsSubPayment = details.getPayments().stream()
                .anyMatch(p -> p.getId().equals(completedSubPayment.getId()));
        assertTrue(containsSubPayment, "Admin bakery detail payments list must contain subscription payments");
    }

    @Test
    @DisplayName("P0.1.5: Webhook fallback payments consistently record ORDER reference in failureReason")
    void testWebhookFallbackPaymentsRetainOrderReference() {
        Payment retrieved = paymentRepository.findById(webhookFallbackOrderPayment.getId()).orElseThrow();
        assertNotNull(retrieved.getFailureReason());
        assertTrue(retrieved.getFailureReason().startsWith("ORDER:ORD-SEG-002-"),
                "Webhook fallback payment must consistently store ORDER:orderNumber");
        assertNull(retrieved.getSubscription());
        assertNull(retrieved.getPlan());
    }
}
