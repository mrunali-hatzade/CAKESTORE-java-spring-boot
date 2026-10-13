package com.cakeplatform.api.modules.admin;

import com.cakeplatform.api.modules.order.Order;
import com.cakeplatform.api.modules.order.OrderItem;
import com.cakeplatform.api.modules.order.OrderRepository;
import com.cakeplatform.api.modules.payment.Payment;
import com.cakeplatform.api.modules.payment.PaymentRepository;
import com.cakeplatform.api.modules.shop.Shop;
import com.cakeplatform.api.modules.shop.ShopRepository;
import com.cakeplatform.api.modules.subscription.SubscriptionPlan;
import com.cakeplatform.api.modules.subscription.SubscriptionPlanRepository;
import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.modules.user.UserRepository;
import com.cakeplatform.api.modules.user.UserRole;
import com.cakeplatform.api.modules.user.UserStatus;
import com.cakeplatform.api.security.CustomUserDetails;
import com.cakeplatform.api.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class AdminLedgerSecurityE2ETest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ShopRepository shopRepository;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private PaymentRepository paymentRepository;

    @Autowired
    private SubscriptionPlanRepository subscriptionPlanRepository;

    @Autowired
    private JwtService jwtService;

    private String adminToken;
    private String ownerToken;
    private String customerToken;

    private Shop testShop;
    private Order testOrder;
    private Payment testPayment;

    @BeforeEach
    void setUp() {
        String uniq = UUID.randomUUID().toString().substring(0, 8);

        // 1. Admin
        User admin = new User();
        admin.setEmail("admin_ledger_" + uniq + "@test.com");
        admin.setPasswordHash("hashed_pw");
        admin.setRole(UserRole.ADMIN);
        admin.setStatus(UserStatus.ACTIVE);
        admin = userRepository.save(admin);
        adminToken = jwtService.generateToken(new CustomUserDetails(admin));

        // 2. Shop Owner
        User owner = new User();
        owner.setEmail("owner_ledger_" + uniq + "@test.com");
        owner.setPasswordHash("hashed_pw");
        owner.setRole(UserRole.SHOP_OWNER);
        owner.setStatus(UserStatus.ACTIVE);
        owner = userRepository.save(owner);
        ownerToken = jwtService.generateToken(new CustomUserDetails(owner));

        // 3. Customer
        User customer = new User();
        customer.setEmail("customer_ledger_" + uniq + "@test.com");
        customer.setPasswordHash("hashed_pw");
        customer.setRole(UserRole.CUSTOMER);
        customer.setStatus(UserStatus.ACTIVE);
        customer = userRepository.save(customer);
        customerToken = jwtService.generateToken(new CustomUserDetails(customer));

        // 4. Shop
        testShop = new Shop();
        testShop.setBusinessName("Sweet Delights " + uniq);
        testShop.setOwner(owner);
        testShop.setPhone("+91 9876543210");
        testShop.setEmail("sweet_" + uniq + "@test.com");
        testShop = shopRepository.save(testShop);

        // 5. Order
        testOrder = new Order();
        testOrder.setShop(testShop);
        testOrder.setOrderNumber("ORD-" + uniq.toUpperCase());
        testOrder.setSubtotal(new BigDecimal("1200.00"));
        testOrder.setTotalAmount(new BigDecimal("1250.00"));
        testOrder.setDeliveryCharge(new BigDecimal("50.00"));
        testOrder.setOrderStatus("CONFIRMED");
        testOrder.setPaymentStatus("PAID");
        testOrder.setPaymentMethod("RAZORPAY");
        testOrder.setTransactionId("pay_" + uniq);
        testOrder.setCustomerName("Rohan Sharma");
        testOrder.setCustomerPhone("+91 9876548910");
        testOrder.setCustomerEmail("rohan." + uniq + "@gmail.com");
        testOrder.setDeliveryAddress("Flat 402, Royal Palms, Pune 411001");
        testOrder.setDeliveryDate(LocalDate.now().plusDays(2));
        testOrder = orderRepository.save(testOrder);

        // 6. Payment linked to order
        testPayment = new Payment();
        testPayment.setShop(testShop);
        testPayment.setAmount(new BigDecimal("1250.00"));
        testPayment.setCurrency("INR");
        testPayment.setProvider("RAZORPAY");
        testPayment.setProviderPaymentId("pay_" + uniq);
        testPayment.setStatus("COMPLETED");
        testPayment.setPaidAt(LocalDateTime.now());
        testPayment = paymentRepository.save(testPayment);
    }

    @Test
    @DisplayName("Admin can query cross-shop orders list successfully")
    void testAdmin_CanAccessOrdersList() throws Exception {
        mockMvc.perform(get("/api/admin/orders")
                        .header("Authorization", "Bearer " + adminToken)
                        .param("page", "0")
                        .param("size", "20")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", notNullValue()))
                .andExpect(jsonPath("$.content[?(@.orderNumber == '" + testOrder.getOrderNumber() + "')].customerPhoneMasked", hasItem("+91******8910")))
                .andExpect(jsonPath("$.content[?(@.orderNumber == '" + testOrder.getOrderNumber() + "')].customerEmailMasked", hasItem(startsWith("r***@gmail.com"))))
                // Confirm delivery address is NOT in list response
                .andExpect(jsonPath("$.content[?(@.orderNumber == '" + testOrder.getOrderNumber() + "')].deliveryAddress").doesNotExist());
    }

    @Test
    @DisplayName("Admin can view order details with full address and unmasked fields")
    void testAdmin_CanAccessOrderDetail() throws Exception {
        mockMvc.perform(get("/api/admin/orders/" + testOrder.getId())
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(testOrder.getId().intValue())))
                .andExpect(jsonPath("$.orderNumber", is(testOrder.getOrderNumber())))
                .andExpect(jsonPath("$.customerPhone", is("+91 9876548910")))
                .andExpect(jsonPath("$.deliveryAddress", containsString("Flat 402, Royal Palms")));
    }

    @Test
    @DisplayName("Admin can query cross-shop payments ledger with 3-tier classification")
    void testAdmin_CanAccessPaymentsList() throws Exception {
        mockMvc.perform(get("/api/admin/payments")
                        .header("Authorization", "Bearer " + adminToken)
                        .param("page", "0")
                        .param("size", "20")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", notNullValue()))
                .andExpect(jsonPath("$.content[?(@.id == " + testPayment.getId() + ")].transactionType", hasItem("RETAIL_ORDER")))
                .andExpect(jsonPath("$.content[?(@.id == " + testPayment.getId() + ")].financialClassification", hasItem("NETWORK_GMV_ZERO_COMMISSION")))
                .andExpect(jsonPath("$.content[?(@.id == " + testPayment.getId() + ")].associationState", hasItem("ORDER_MATCHED")))
                .andExpect(jsonPath("$.content[?(@.id == " + testPayment.getId() + ")].relatedOrderNumber", hasItem(testOrder.getOrderNumber())));
    }

    @Test
    @DisplayName("Admin can view payment details with nested order snapshot")
    void testAdmin_CanAccessPaymentDetail() throws Exception {
        mockMvc.perform(get("/api/admin/payments/" + testPayment.getId())
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(testPayment.getId().intValue())))
                .andExpect(jsonPath("$.transactionType", is("RETAIL_ORDER")))
                .andExpect(jsonPath("$.orderDetails.orderNumber", is(testOrder.getOrderNumber())))
                .andExpect(jsonPath("$.orderDetails.orderStatus", is("CONFIRMED")))
                .andExpect(jsonPath("$.subscriptionDetails").doesNotExist());
    }

    @Test
    @DisplayName("Unauthenticated requests return 401 Unauthorized")
    void testUnauthenticated_ReturnsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/admin/orders"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/admin/orders/" + testOrder.getId()))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/admin/payments"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/admin/payments/" + testPayment.getId()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Shop owner role receives 403 Forbidden")
    void testShopOwner_ReturnsForbidden() throws Exception {
        mockMvc.perform(get("/api/admin/orders")
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/admin/orders/" + testOrder.getId())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/admin/payments")
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/admin/payments/" + testPayment.getId())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Customer role receives 403 Forbidden")
    void testCustomer_ReturnsForbidden() throws Exception {
        mockMvc.perform(get("/api/admin/orders")
                        .header("Authorization", "Bearer " + customerToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/admin/orders/" + testOrder.getId())
                        .header("Authorization", "Bearer " + customerToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/admin/payments")
                        .header("Authorization", "Bearer " + customerToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/admin/payments/" + testPayment.getId())
                        .header("Authorization", "Bearer " + customerToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Missing order or payment returns 404 Not Found")
    void testNotFound_Returns404() throws Exception {
        mockMvc.perform(get("/api/admin/orders/999999")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/admin/payments/999999")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Oversized page size is bounded to 50")
    void testOversizedPageSize_BoundedTo50() throws Exception {
        mockMvc.perform(get("/api/admin/orders")
                        .header("Authorization", "Bearer " + adminToken)
                        .param("size", "200"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.size", is(50)));

        mockMvc.perform(get("/api/admin/payments")
                        .header("Authorization", "Bearer " + adminToken)
                        .param("size", "200"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.size", is(50)));
    }
}
