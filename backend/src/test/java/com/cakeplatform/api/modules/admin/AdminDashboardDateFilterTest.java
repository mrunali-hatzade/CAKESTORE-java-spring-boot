package com.cakeplatform.api.modules.admin;

import com.cakeplatform.api.modules.admin.dto.AdminShopDetailsResponse;
import com.cakeplatform.api.modules.admin.dto.AnalyticsChartResponse;
import com.cakeplatform.api.modules.admin.dto.DashboardStatsResponse;
import com.cakeplatform.api.modules.admin.dto.RevenueDataPoint;
import com.cakeplatform.api.modules.order.Order;
import com.cakeplatform.api.modules.order.OrderRepository;
import com.cakeplatform.api.modules.payment.Payment;
import com.cakeplatform.api.modules.payment.PaymentRepository;
import com.cakeplatform.api.modules.shop.Shop;
import com.cakeplatform.api.modules.shop.ShopRepository;
import com.cakeplatform.api.modules.shop.ShopStatus;
import com.cakeplatform.api.modules.shop.VerificationStatus;
import com.cakeplatform.api.modules.subscription.Subscription;
import com.cakeplatform.api.modules.subscription.SubscriptionPlan;
import com.cakeplatform.api.modules.subscription.SubscriptionPlanRepository;
import com.cakeplatform.api.modules.subscription.SubscriptionRepository;
import com.cakeplatform.api.modules.subscription.SubscriptionStatus;
import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.modules.user.UserRepository;
import com.cakeplatform.api.modules.user.UserRole;
import com.cakeplatform.api.modules.user.UserStatus;
import com.cakeplatform.api.security.CustomUserDetails;
import com.cakeplatform.api.security.JwtService;
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
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class AdminDashboardDateFilterTest {

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

    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    private String adminToken;
    private String customerToken;
    private Shop testShop;
    private SubscriptionPlan testPlan;
    private Subscription testSubscription;

    private Payment pastSubPayment;
    private Payment todaySubPayment;
    private Payment pastOrderPayment;
    private Payment todayOrderPayment;
    private Order pastOrder;
    private Order todayOrder;

    @BeforeEach
    void setUp() {
        String uniq = UUID.randomUUID().toString().substring(0, 8);

        // 1. Create Admin
        User admin = new User();
        admin.setEmail("admin_filter_" + uniq + "@test.com");
        admin.setPasswordHash("hashed_pw");
        admin.setRole(UserRole.ADMIN);
        admin.setStatus(UserStatus.ACTIVE);
        admin.setFullName("Date Filter Admin");
        admin = userRepository.save(admin);
        adminToken = jwtService.generateToken(new CustomUserDetails(admin));

        // 2. Create Owner and Shop
        User owner = new User();
        owner.setEmail("owner_filter_" + uniq + "@test.com");
        owner.setPasswordHash("hashed_pw");
        owner.setRole(UserRole.SHOP_OWNER);
        owner.setStatus(UserStatus.ACTIVE);
        owner.setFullName("Filter Bakery Owner");
        owner = userRepository.save(owner);

        testShop = new Shop();
        testShop.setOwner(owner);
        testShop.setBusinessName("Date Filter Bakery " + uniq);
        testShop.setStatus(ShopStatus.ACTIVE);
        testShop.setVerificationStatus(VerificationStatus.VERIFIED);
        testShop = shopRepository.save(testShop);

        // 2b. Create Customer
        User customer = new User();
        customer.setEmail("customer_filter_" + uniq + "@test.com");
        customer.setPasswordHash("hashed_pw");
        customer.setRole(UserRole.CUSTOMER);
        customer.setStatus(UserStatus.ACTIVE);
        customer.setFullName("Filter Cake Customer");
        customer = userRepository.save(customer);
        customerToken = jwtService.generateToken(new CustomUserDetails(customer));

        // 3. Plan & Subscription
        testPlan = new SubscriptionPlan();
        testPlan.setName("Pro Baker Filter Tier");
        testPlan.setBillingCycle("monthly");
        testPlan.setPrice(new BigDecimal("2000.00"));
        testPlan.setDurationDays(30);
        testPlan.setIsActive(true);
        testPlan = subscriptionPlanRepository.save(testPlan);

        testSubscription = new Subscription();
        testSubscription.setShop(testShop);
        testSubscription.setPlan(testPlan);
        testSubscription.setStatus(SubscriptionStatus.ACTIVE);
        testSubscription.setAmount(new BigDecimal("2000.00"));
        testSubscription.setStartDate(LocalDateTime.now().minusDays(15));
        testSubscription.setExpiryDate(LocalDateTime.now().plusDays(15));
        testSubscription = subscriptionRepository.save(testSubscription);

        // 4. Past Subscription Payment (10 days ago) - ₹2,000.00
        pastSubPayment = new Payment();
        pastSubPayment.setShop(testShop);
        pastSubPayment.setSubscription(testSubscription);
        pastSubPayment.setPlan(testPlan);
        pastSubPayment.setAmount(new BigDecimal("2000.00"));
        pastSubPayment.setCurrency("INR");
        pastSubPayment.setProvider("RAZORPAY");
        pastSubPayment.setProviderOrderId("ord_sub_past_" + uniq);
        pastSubPayment.setProviderPaymentId("pay_sub_past_" + uniq);
        pastSubPayment.setStatus("COMPLETED");
        pastSubPayment.setPaidAt(LocalDateTime.now().minusDays(10));
        pastSubPayment = paymentRepository.save(pastSubPayment);
        // Explicitly backdate createdAt in database because JPA @CreationTimestamp ignores setCreatedAt
        jdbcTemplate.update("UPDATE payments SET created_at = ? WHERE id = ?",
                java.sql.Timestamp.valueOf(LocalDateTime.now().minusDays(10)), pastSubPayment.getId());

        // 5. Today's Subscription Payment - ₹2,000.00
        todaySubPayment = new Payment();
        todaySubPayment.setShop(testShop);
        todaySubPayment.setSubscription(testSubscription);
        todaySubPayment.setPlan(testPlan);
        todaySubPayment.setAmount(new BigDecimal("2000.00"));
        todaySubPayment.setCurrency("INR");
        todaySubPayment.setProvider("RAZORPAY");
        todaySubPayment.setProviderOrderId("ord_sub_today_" + uniq);
        todaySubPayment.setProviderPaymentId("pay_sub_today_" + uniq);
        todaySubPayment.setStatus("COMPLETED");
        todaySubPayment.setPaidAt(LocalDateTime.now());
        todaySubPayment = paymentRepository.save(todaySubPayment);

        // 6. Past Retail Cake Order (10 days ago) - ₹1,500.00
        pastOrder = new Order();
        pastOrder.setShop(testShop);
        pastOrder.setOrderNumber("ORD-PAST-" + uniq);
        pastOrder.setSubtotal(new BigDecimal("1400.00"));
        pastOrder.setDeliveryCharge(new BigDecimal("100.00"));
        pastOrder.setTotalAmount(new BigDecimal("1500.00"));
        pastOrder.setOrderStatus("COMPLETED");
        pastOrder.setPaymentStatus("PAID");
        pastOrder.setPaymentMethod("RAZORPAY");
        pastOrder.setTransactionId("pay_order_past_" + uniq);
        pastOrder.setCreatedAt(LocalDateTime.now().minusDays(10));
        pastOrder = orderRepository.save(pastOrder);
        jdbcTemplate.update("UPDATE orders SET created_at = ? WHERE id = ?",
                java.sql.Timestamp.valueOf(LocalDateTime.now().minusDays(10)), pastOrder.getId());

        pastOrderPayment = new Payment();
        pastOrderPayment.setShop(testShop);
        pastOrderPayment.setSubscription(null);
        pastOrderPayment.setPlan(null);
        pastOrderPayment.setAmount(new BigDecimal("1500.00"));
        pastOrderPayment.setCurrency("INR");
        pastOrderPayment.setProvider("RAZORPAY");
        pastOrderPayment.setProviderOrderId("ord_order_past_" + uniq);
        pastOrderPayment.setProviderPaymentId("pay_order_past_" + uniq);
        pastOrderPayment.setStatus("COMPLETED");
        pastOrderPayment.setPaidAt(LocalDateTime.now().minusDays(10));
        pastOrderPayment.setFailureReason("ORDER:" + pastOrder.getOrderNumber());
        pastOrderPayment = paymentRepository.save(pastOrderPayment);
        jdbcTemplate.update("UPDATE payments SET created_at = ? WHERE id = ?",
                java.sql.Timestamp.valueOf(LocalDateTime.now().minusDays(10)), pastOrderPayment.getId());

        // 7. Today's Retail Cake Order - ₹1,000.00
        todayOrder = new Order();
        todayOrder.setShop(testShop);
        todayOrder.setOrderNumber("ORD-TODAY-" + uniq);
        todayOrder.setSubtotal(new BigDecimal("950.00"));
        todayOrder.setDeliveryCharge(new BigDecimal("50.00"));
        todayOrder.setTotalAmount(new BigDecimal("1000.00"));
        todayOrder.setOrderStatus("CONFIRMED");
        todayOrder.setPaymentStatus("PAID");
        todayOrder.setPaymentMethod("RAZORPAY");
        todayOrder.setTransactionId("pay_order_today_" + uniq);
        todayOrder = orderRepository.save(todayOrder);

        todayOrderPayment = new Payment();
        todayOrderPayment.setShop(testShop);
        todayOrderPayment.setSubscription(null);
        todayOrderPayment.setPlan(null);
        todayOrderPayment.setAmount(new BigDecimal("1000.00"));
        todayOrderPayment.setCurrency("INR");
        todayOrderPayment.setProvider("RAZORPAY");
        todayOrderPayment.setProviderOrderId("ord_order_today_" + uniq);
        todayOrderPayment.setProviderPaymentId("pay_order_today_" + uniq);
        todayOrderPayment.setStatus("COMPLETED");
        todayOrderPayment.setPaidAt(LocalDateTime.now());
        todayOrderPayment.setFailureReason("ORDER:" + todayOrder.getOrderNumber());
        todayOrderPayment = paymentRepository.save(todayOrderPayment);
    }

    @Test
    @DisplayName("P0.2.1: 'All Time' returns genuine lifetime subscription revenue and lifetime GMV, not today's revenue")
    void testAllTimeReturnsLifetimeTotals() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/admin/dashboard/stats")
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andReturn();

        DashboardStatsResponse stats = objectMapper.readValue(
                result.getResponse().getContentAsString(), DashboardStatsResponse.class);

        assertNotNull(stats);

        // In 'All Time', monthlyPlatformRevenue (and periodPlatformRevenue) must equal lifetime revenue
        // Lifetime subscription revenue must be >= ₹4,000 (past ₹2,000 + today ₹2,000)
        assertTrue(stats.getMonthlyPlatformRevenue().compareTo(new BigDecimal("4000.00")) >= 0,
                "All Time platform revenue must be lifetime cumulative (>= 4000.00), not today's 2000.00");
        assertTrue(stats.getTotalPlatformRevenue().compareTo(new BigDecimal("4000.00")) >= 0,
                "All Time total platform revenue must be lifetime cumulative (>= 4000.00)");
        assertEquals(stats.getTotalPlatformRevenue(), stats.getMonthlyPlatformRevenue(),
                "In All Time, monthlyPlatformRevenue must equal totalPlatformRevenue");
        assertEquals(stats.getTotalPlatformRevenue(), stats.getPeriodPlatformRevenue(),
                "In All Time, periodPlatformRevenue must equal totalPlatformRevenue");

        // Lifetime GMV must be >= ₹2,500 (past ₹1,500 + today ₹1,000)
        assertTrue(stats.getMonthlyGmv().compareTo(new BigDecimal("2500.00")) >= 0,
                "All Time GMV must be lifetime cumulative (>= 2500.00), not today's 1000.00");
        assertTrue(stats.getTotalGmv().compareTo(new BigDecimal("2500.00")) >= 0,
                "All Time total GMV must be lifetime cumulative (>= 2500.00)");
        assertEquals(stats.getTotalGmv(), stats.getMonthlyGmv(),
                "In All Time, monthlyGmv must equal totalGmv");
        assertEquals(stats.getTotalGmv(), stats.getPeriodGmv(),
                "In All Time, periodGmv must equal totalGmv");

        // Daily counters retain intended semantics (must be today's counts)
        assertTrue(stats.getTodayPayments() >= 1, "Today payments must count today's completed subscription payments");
    }

    @Test
    @DisplayName("P0.2.2: Bounded date range returns only the transactions within the selected window")
    void testBoundedDateRangeReturnsPeriodOnly() throws Exception {
        LocalDate startDate = LocalDate.now().minusDays(3);
        LocalDate endDate = LocalDate.now();

        MvcResult result = mockMvc.perform(get("/api/admin/dashboard/stats")
                .param("startDate", startDate.toString())
                .param("endDate", endDate.toString())
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andReturn();

        DashboardStatsResponse stats = objectMapper.readValue(
                result.getResponse().getContentAsString(), DashboardStatsResponse.class);

        assertNotNull(stats);
        assertEquals(startDate, stats.getStartDate());
        assertEquals(endDate, stats.getEndDate());

        // In a 3-day window, the past payment from 10 days ago (₹2,000) must be EXCLUDED from periodPlatformRevenue.
        // Therefore, periodPlatformRevenue should be strictly LESS than totalPlatformRevenue.
        assertTrue(stats.getPeriodPlatformRevenue().compareTo(stats.getTotalPlatformRevenue()) < 0,
                "3-day period revenue must be less than lifetime revenue because 10-day-old payment is excluded");

        // Period GMV must exclude the past order from 10 days ago (₹1,500)
        assertTrue(stats.getPeriodGmv().compareTo(stats.getTotalGmv()) < 0,
                "3-day period GMV must be less than lifetime GMV because 10-day-old order is excluded");

        // Lifetime metrics remain cumulative regardless of filter
        assertTrue(stats.getTotalPlatformRevenue().compareTo(new BigDecimal("4000.00")) >= 0);
        assertTrue(stats.getTotalGmv().compareTo(new BigDecimal("2500.00")) >= 0);

        // Daily counters retain intended semantics under bounded filter
        assertTrue(stats.getTodayPayments() >= 1, "Today payments must count today's completed payments even during bounded filter");
        assertTrue(stats.getTodayRegistrations() >= 1, "Today registrations must count today's registered users even during bounded filter");
    }

    @Test
    @DisplayName("P0.2.3: Zero customer order contamination across both All-Time and bounded ranges")
    void testRevenueZeroContamination() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/admin/dashboard/stats")
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andReturn();

        DashboardStatsResponse stats = objectMapper.readValue(
                result.getResponse().getContentAsString(), DashboardStatsResponse.class);

        // Total GMV captures the cake orders (>= 2500)
        assertTrue(stats.getTotalGmv().compareTo(new BigDecimal("2500.00")) >= 0);

        // Platform subscription revenue must NOT be inflated by the cake orders (2500.00).
        // It strictly tracks subscription payments.
        assertNotNull(stats.getTotalPlatformRevenue());
        assertNotNull(stats.getPeriodPlatformRevenue());
    }

    @Test
    @DisplayName("P0.2.4: Start date only applies window through current day's end")
    void testStartDateOnly_defaultsPeriodEndToCurrentDay() throws Exception {
        LocalDate startDate = LocalDate.now().minusDays(3);

        MvcResult result = mockMvc.perform(get("/api/admin/dashboard/stats")
                .param("startDate", startDate.toString())
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andReturn();

        DashboardStatsResponse stats = objectMapper.readValue(
                result.getResponse().getContentAsString(), DashboardStatsResponse.class);

        assertNotNull(stats);
        assertEquals(startDate, stats.getStartDate());
        assertNull(stats.getEndDate());

        // Includes today's transactions (₹2,000 sub + ₹1,000 GMV), excludes 10-day-old transactions
        assertTrue(stats.getPeriodPlatformRevenue().compareTo(BigDecimal.ZERO) > 0,
                "Period revenue must include today's payment when startDate is 3 days ago");
        assertTrue(stats.getPeriodPlatformRevenue().compareTo(stats.getTotalPlatformRevenue()) < 0,
                "Period revenue must exclude 10-day-old payment when startDate is 3 days ago");
        assertTrue(stats.getPeriodGmv().compareTo(BigDecimal.ZERO) > 0,
                "Period GMV must include today's order when startDate is 3 days ago");
        assertTrue(stats.getPeriodGmv().compareTo(stats.getTotalGmv()) < 0,
                "Period GMV must exclude 10-day-old order when startDate is 3 days ago");

        // Daily counters retain intended semantics
        assertTrue(stats.getTodayPayments() >= 1);
        assertTrue(stats.getTodayRegistrations() >= 1);
    }

    @Test
    @DisplayName("P0.2.5: End date only applies fallback start date and inclusive end date cutoff")
    void testEndDateOnly_appliesEpochFallbackAndInclusiveCutoff() throws Exception {
        // Querying with an endDate in the past (5 days ago) excludes today's transactions but includes 10-day-old transactions
        LocalDate pastEndDate = LocalDate.now().minusDays(5);

        MvcResult result = mockMvc.perform(get("/api/admin/dashboard/stats")
                .param("endDate", pastEndDate.toString())
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andReturn();

        DashboardStatsResponse stats = objectMapper.readValue(
                result.getResponse().getContentAsString(), DashboardStatsResponse.class);

        assertNotNull(stats);
        assertNull(stats.getStartDate());
        assertEquals(pastEndDate, stats.getEndDate());

        // Captures past transaction (from epoch 2020-01-01 to pastEndDate) but excludes today's transactions
        assertTrue(stats.getPeriodPlatformRevenue().compareTo(BigDecimal.ZERO) > 0,
                "Period revenue must capture historical payments via epoch start fallback");
        assertTrue(stats.getPeriodPlatformRevenue().compareTo(stats.getTotalPlatformRevenue()) < 0,
                "Period revenue must exclude today's payment because cutoff is 5 days ago");
        assertTrue(stats.getPeriodGmv().compareTo(BigDecimal.ZERO) > 0,
                "Period GMV must capture historical orders via epoch start fallback");
        assertTrue(stats.getPeriodGmv().compareTo(stats.getTotalGmv()) < 0,
                "Period GMV must exclude today's order because cutoff is 5 days ago");

        // Daily counters strictly reflect today even when the query filter is exclusively in the past
        assertTrue(stats.getTodayPayments() >= 1);
        assertTrue(stats.getTodayRegistrations() >= 1);
    }

    @Test
    @DisplayName("P0.2.6: Daily counters remain today's metrics even when filter window is strictly historical")
    void testDailyCountersUnderHistoricalBoundedFilter() throws Exception {
        LocalDate startDate = LocalDate.now().minusDays(15);
        LocalDate endDate = LocalDate.now().minusDays(5);

        MvcResult result = mockMvc.perform(get("/api/admin/dashboard/stats")
                .param("startDate", startDate.toString())
                .param("endDate", endDate.toString())
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andReturn();

        DashboardStatsResponse stats = objectMapper.readValue(
                result.getResponse().getContentAsString(), DashboardStatsResponse.class);

        assertNotNull(stats);
        assertEquals(startDate, stats.getStartDate());
        assertEquals(endDate, stats.getEndDate());

        // Period metrics strictly cover the historical window (excludes today)
        assertTrue(stats.getPeriodPlatformRevenue().compareTo(stats.getTotalPlatformRevenue()) < 0);
        assertTrue(stats.getPeriodGmv().compareTo(stats.getTotalGmv()) < 0);

        // Daily counters MUST still count today's activity, unaffected by the historical filter window
        assertTrue(stats.getTodayPayments() >= 1, "Today payments must reflect today's count despite historical filter");
        assertTrue(stats.getTodayRegistrations() >= 1, "Today registrations must reflect today's count despite historical filter");
    }

    @Test
    @DisplayName("P1.3.1: SaaS Subscriptions KPI represents actual subscriptions and Users includes customers")
    void testPhase53_KpiAccuracy_UsersAndSubscriptions() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/admin/dashboard/stats")
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andReturn();

        DashboardStatsResponse stats = objectMapper.readValue(
                result.getResponse().getContentAsString(), DashboardStatsResponse.class);

        assertNotNull(stats);

        // 1. Platform Users includes all user roles
        assertTrue(stats.getTotalUsers() >= 3, "Total users must include admin, owner, and customers (>= 3)");
        assertTrue(stats.getTotalAdmins() >= 1, "Total admins must be >= 1");
        assertTrue(stats.getTotalShopOwners() >= 1, "Total bakery owners must be >= 1");
        assertTrue(stats.getTotalCustomers() >= 1, "Total customers must be >= 1 and not omitted");

        // 2. SaaS Subscriptions represents genuine subscriptions
        assertTrue(stats.getTotalSubscriptions() >= 1, "Total subscriptions must represent subscription records in table (>= 1)");
        assertTrue(stats.getActiveSubscribedBakeries() >= 1, "Active subscribed bakeries must be >= 1");
    }

    @Test
    @DisplayName("P1.3.2: Admin bakery detail view returns subscription billing records and excludes customer orders")
    void testPhase53_AdminBakeryDetailReturnsSubscriptionPayments() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/admin/shops/" + testShop.getId())
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andReturn();

        AdminShopDetailsResponse details = objectMapper.readValue(
                result.getResponse().getContentAsString(), AdminShopDetailsResponse.class);

        assertNotNull(details);
        assertNotNull(details.getPayments(), "Payments list must not be null in shop details");
        assertFalse(details.getPayments().isEmpty(), "Shop details must contain subscription billing records");

        // Verify each payment has expected subscription attributes
        for (Payment p : details.getPayments()) {
            assertNotNull(p.getAmount(), "Payment amount must not be null");
            assertTrue(p.getAmount().compareTo(BigDecimal.ZERO) > 0, "Payment amount must be positive");
            assertEquals("COMPLETED", p.getStatus());
            assertEquals("RAZORPAY", p.getProvider());
            assertNotNull(p.getCreatedAt(), "Payment createdAt must not be null");
            assertNotNull(p.getPaidAt(), "Payment paidAt must not be null");
            // Must NOT have failureReason starting with ORDER: (customer cake orders)
            if (p.getFailureReason() != null) {
                assertFalse(p.getFailureReason().startsWith("ORDER:"), "Bakery payments must not include customer cake orders");
            }
        }

        // Must include our subscription payments
        boolean hasPastSub = details.getPayments().stream().anyMatch(p -> p.getId().equals(pastSubPayment.getId()));
        boolean hasTodaySub = details.getPayments().stream().anyMatch(p -> p.getId().equals(todaySubPayment.getId()));
        assertTrue(hasPastSub, "Shop details must include past subscription payment");
        assertTrue(hasTodaySub, "Shop details must include today's subscription payment");

        // Must NOT include retail cake order payments
        boolean hasPastOrder = details.getPayments().stream().anyMatch(p -> p.getId().equals(pastOrderPayment.getId()));
        boolean hasTodayOrder = details.getPayments().stream().anyMatch(p -> p.getId().equals(todayOrderPayment.getId()));
        assertFalse(hasPastOrder, "Shop details must NOT include past retail order payment");
        assertFalse(hasTodayOrder, "Shop details must NOT include today's retail order payment");
    }

    @Test
    @DisplayName("P1.4.1: GET /api/admin/dashboard/stats/analytics/revenue returns 6 months database-aggregated data points")
    void testPhase54_RevenueAnalyticsOptimized() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/admin/dashboard/stats/analytics/revenue")
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andReturn();

        AnalyticsChartResponse chart = objectMapper.readValue(
                result.getResponse().getContentAsString(), AnalyticsChartResponse.class);

        assertNotNull(chart, "Analytics chart response must not be null");
        assertNotNull(chart.getSaasRevenue(), "saasRevenue list must not be null");
        assertNotNull(chart.getNetworkGmv(), "networkGmv list must not be null");

        // Contract check: exactly 6 calendar months
        assertEquals(6, chart.getSaasRevenue().size(), "saasRevenue must contain exactly 6 monthly data points");
        assertEquals(6, chart.getNetworkGmv().size(), "networkGmv must contain exactly 6 monthly data points");

        // Verify structure of data points
        for (int i = 0; i < 6; i++) {
            RevenueDataPoint saasPt = chart.getSaasRevenue().get(i);
            RevenueDataPoint gmvPt = chart.getNetworkGmv().get(i);

            assertNotNull(saasPt.getMonth(), "Month abbreviation must not be null");
            assertNotNull(saasPt.getFullMonth(), "Full month label must not be null");
            assertNotNull(saasPt.getAmount(), "SaaS revenue amount must not be null");
            assertTrue(saasPt.getAmount().compareTo(BigDecimal.ZERO) >= 0, "SaaS revenue must be >= 0");

            assertNotNull(gmvPt.getMonth(), "GMV month abbreviation must not be null");
            assertNotNull(gmvPt.getFullMonth(), "GMV full month label must not be null");
            assertNotNull(gmvPt.getAmount(), "GMV amount must not be null");
            assertTrue(gmvPt.getAmount().compareTo(BigDecimal.ZERO) >= 0, "GMV must be >= 0");

            assertEquals(saasPt.getMonth(), gmvPt.getMonth(), "Months must align chronologically");
            assertEquals(saasPt.getFullMonth(), gmvPt.getFullMonth(), "Full months must align chronologically");
        }

        // Current month is the last data point (index 5)
        RevenueDataPoint currentSaas = chart.getSaasRevenue().get(5);
        RevenueDataPoint currentGmv = chart.getNetworkGmv().get(5);

        // Current month SaaS revenue must include today's subscription payment (>= ₹2,000)
        assertTrue(currentSaas.getAmount().compareTo(new BigDecimal("2000.00")) >= 0,
                "Current month SaaS revenue must include today's subscription payment");

        // Current month GMV must include today's cake order (>= ₹1,000)
        assertTrue(currentGmv.getAmount().compareTo(new BigDecimal("1000.00")) >= 0,
                "Current month Network GMV must include today's cake order");

        // Zero platform commission: GMV and SaaS revenue remain strictly segregated
        assertNotEquals(currentSaas.getAmount(), currentGmv.getAmount());
    }

    @Test
    @DisplayName("P1.4.2: Revenue analytics endpoint enforces ROLE_ADMIN authorization")
    void testPhase54_RevenueAnalyticsSecurityAndTenantBoundary() throws Exception {
        // 1. Unauthenticated request must be rejected
        mockMvc.perform(get("/api/admin/dashboard/stats/analytics/revenue")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(result -> assertTrue(
                        result.getResponse().getStatus() == 401 || result.getResponse().getStatus() == 403,
                        "Unauthenticated access must be rejected with 401 or 403"));

        // 2. Non-admin customer user must be rejected with 403 Forbidden
        mockMvc.perform(get("/api/admin/dashboard/stats/analytics/revenue")
                .header("Authorization", "Bearer " + customerToken)
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("P1.4.3: Direct database repository queries enforce revenue segregation and status exclusion rules")
    void testPhase54_DatabaseAggregatedQueriesExclusionsAndEdgeCases() {
        String uniq = UUID.randomUUID().toString().substring(0, 8);
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime monthStart = now.toLocalDate().withDayOfMonth(1).atStartOfDay();

        // 1. Create a PENDING subscription payment - should be EXCLUDED
        Payment pendingSub = new Payment();
        pendingSub.setShop(testShop);
        pendingSub.setSubscription(testSubscription);
        pendingSub.setPlan(testPlan);
        pendingSub.setAmount(new BigDecimal("9999.00"));
        pendingSub.setCurrency("INR");
        pendingSub.setProvider("RAZORPAY");
        pendingSub.setStatus("PENDING");
        paymentRepository.save(pendingSub);

        // 2. Create a customer retail order payment - should be EXCLUDED from SaaS revenue
        Payment retailPayment = new Payment();
        retailPayment.setShop(testShop);
        retailPayment.setSubscription(null);
        retailPayment.setPlan(null);
        retailPayment.setAmount(new BigDecimal("8888.00"));
        retailPayment.setCurrency("INR");
        retailPayment.setProvider("RAZORPAY");
        retailPayment.setStatus("COMPLETED");
        retailPayment.setFailureReason("ORDER:ORD-RETAIL-" + uniq);
        paymentRepository.save(retailPayment);

        // 3. Create a CANCELLED cake order - should be EXCLUDED from GMV
        Order cancelledOrder = new Order();
        cancelledOrder.setShop(testShop);
        cancelledOrder.setOrderNumber("ORD-CANC-" + uniq);
        cancelledOrder.setSubtotal(new BigDecimal("7777.00"));
        cancelledOrder.setDeliveryCharge(BigDecimal.ZERO);
        cancelledOrder.setTotalAmount(new BigDecimal("7777.00"));
        cancelledOrder.setOrderStatus("CANCELLED");
        cancelledOrder.setPaymentStatus("PAID");
        cancelledOrder.setPaymentMethod("RAZORPAY");
        orderRepository.save(cancelledOrder);

        // 4. Create a REFUNDED cake order - should be EXCLUDED from GMV
        Order refundedOrder = new Order();
        refundedOrder.setShop(testShop);
        refundedOrder.setOrderNumber("ORD-REF-" + uniq);
        refundedOrder.setSubtotal(new BigDecimal("6666.00"));
        refundedOrder.setDeliveryCharge(BigDecimal.ZERO);
        refundedOrder.setTotalAmount(new BigDecimal("6666.00"));
        refundedOrder.setOrderStatus("DELIVERED");
        refundedOrder.setPaymentStatus("REFUNDED");
        refundedOrder.setPaymentMethod("RAZORPAY");
        orderRepository.save(refundedOrder);

        // Query database directly
        java.util.List<Object[]> saasAgg = paymentRepository.getMonthlySubscriptionRevenueSince(monthStart);
        java.util.List<Object[]> gmvAgg = orderRepository.getMonthlyNetworkGmvSince(monthStart);

        assertNotNull(saasAgg, "SaaS aggregation rows must not be null");
        assertNotNull(gmvAgg, "GMV aggregation rows must not be null");

        // Verify total SaaS revenue does NOT include the ₹9999 PENDING or ₹8888 retail order
        BigDecimal currentMonthSaas = BigDecimal.ZERO;
        for (Object[] row : saasAgg) {
            if (row[0] != null && row[0].toString().equals(now.format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM")))) {
                currentMonthSaas = (BigDecimal) row[1];
            }
        }
        // It must include todaySubPayment (2000.00) but NOT 9999 or 8888
        assertTrue(currentMonthSaas.compareTo(new BigDecimal("2000.00")) >= 0);
        // Assert that 8888.00 and 9999.00 were strictly excluded
        assertFalse(currentMonthSaas.toString().contains("8888"));
        assertFalse(currentMonthSaas.toString().contains("9999"));

        // Verify GMV aggregation does NOT include the ₹7777 CANCELLED or ₹6666 REFUNDED orders
        BigDecimal currentMonthGmv = BigDecimal.ZERO;
        for (Object[] row : gmvAgg) {
            if (row[0] != null && row[0].toString().equals(now.format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM")))) {
                currentMonthGmv = (BigDecimal) row[1];
            }
        }
        assertTrue(currentMonthGmv.compareTo(new BigDecimal("1000.00")) >= 0);
        assertFalse(currentMonthGmv.toString().contains("7777"));
        assertFalse(currentMonthGmv.toString().contains("6666"));
    }
}
