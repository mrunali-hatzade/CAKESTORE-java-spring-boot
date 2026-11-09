package com.cakeplatform.api.modules.review;

import com.cakeplatform.api.modules.audit.ActivityLog;
import com.cakeplatform.api.modules.audit.ActivityLogRepository;
import com.cakeplatform.api.modules.interaction.Feedback;
import com.cakeplatform.api.modules.interaction.FeedbackRepository;
import com.cakeplatform.api.modules.order.Order;
import com.cakeplatform.api.modules.order.OrderItem;
import com.cakeplatform.api.modules.order.OrderItemRepository;
import com.cakeplatform.api.modules.order.OrderRepository;
import com.cakeplatform.api.modules.product.Product;
import com.cakeplatform.api.modules.product.ProductRepository;
import com.cakeplatform.api.modules.review.dto.AdminReviewModerationRequest;
import com.cakeplatform.api.modules.review.dto.ProductReviewsSummaryResponse;
import com.cakeplatform.api.modules.review.service.ProductReviewService;
import com.cakeplatform.api.modules.shop.Shop;
import com.cakeplatform.api.modules.shop.ShopRepository;
import com.cakeplatform.api.modules.shop.ShopStatus;
import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.modules.user.UserRepository;
import com.cakeplatform.api.modules.user.UserRole;
import com.cakeplatform.api.security.CustomUserDetails;
import com.cakeplatform.api.security.JwtService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class AdminProductReviewControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ShopRepository shopRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private OrderItemRepository orderItemRepository;

    @Autowired
    private ProductReviewRepository productReviewRepository;

    @Autowired
    private ProductReviewService productReviewService;

    @Autowired
    private FeedbackRepository feedbackRepository;

    @Autowired
    private ActivityLogRepository activityLogRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private User adminUser;
    private User ownerUser;
    private User customerUser;

    private String adminToken;
    private String ownerToken;
    private String customerToken;

    private Shop testShop;
    private Product testProduct;
    private Order testOrder;
    private OrderItem testOrderItem1;
    private OrderItem testOrderItem2;

    private final List<Long> createdReviewIds = new ArrayList<>();
    private final List<Long> createdFeedbackIds = new ArrayList<>();
    private final List<Long> createdUserIds = new ArrayList<>();

    @BeforeEach
    void setUp() {
        String uniq = UUID.randomUUID().toString().substring(0, 8);

        // 1. Users
        adminUser = new User();
        adminUser.setFullName("Super Admin " + uniq);
        adminUser.setEmail("superadmin_" + uniq + "@cakestore.com");
        adminUser.setPasswordHash("hash");
        adminUser.setRole(UserRole.ADMIN);
        adminUser = userRepository.save(adminUser);
        createdUserIds.add(adminUser.getId());
        adminToken = jwtService.generateToken(new CustomUserDetails(adminUser));

        ownerUser = new User();
        ownerUser.setFullName("Bakery Owner " + uniq);
        ownerUser.setEmail("owner_" + uniq + "@bakery.com");
        ownerUser.setPasswordHash("hash");
        ownerUser.setRole(UserRole.SHOP_OWNER);
        ownerUser = userRepository.save(ownerUser);
        createdUserIds.add(ownerUser.getId());
        ownerToken = jwtService.generateToken(new CustomUserDetails(ownerUser));

        customerUser = new User();
        customerUser.setFullName("Customer " + uniq);
        customerUser.setEmail("customer_" + uniq + "@gmail.com");
        customerUser.setPasswordHash("hash");
        customerUser.setRole(UserRole.CUSTOMER);
        customerUser = userRepository.save(customerUser);
        createdUserIds.add(customerUser.getId());
        customerToken = jwtService.generateToken(new CustomUserDetails(customerUser));

        // 2. Shop
        testShop = new Shop();
        testShop.setBusinessName("Sweet Paradise " + uniq);
        testShop.setOwner(ownerUser);
        testShop.setStatus(ShopStatus.ACTIVE);
        testShop.setPhone("9876543210");
        testShop = shopRepository.save(testShop);

        // 3. Product
        testProduct = new Product();
        testProduct.setName("Red Velvet Supreme " + uniq);
        testProduct.setShop(testShop);
        testProduct.setPrice(BigDecimal.valueOf(650));
        testProduct = productRepository.save(testProduct);

        // 4. Order
        testOrder = new Order();
        testOrder.setShop(testShop);
        testOrder.setOrderNumber("ORD-REV-" + uniq.toUpperCase());
        testOrder.setCustomerName("Sunita Rao");
        testOrder.setCustomerPhone("9823101111");
        testOrder.setOrderStatus("DELIVERED");
        testOrder.setPaymentStatus("PAID");
        testOrder.setPaymentMethod("RAZORPAY");
        testOrder.setSubtotal(BigDecimal.valueOf(1300));
        testOrder.setDeliveryCharge(BigDecimal.ZERO);
        testOrder.setTotalAmount(BigDecimal.valueOf(1300));
        testOrder.setFulfillmentMethod("HOME_DELIVERY");
        testOrder = orderRepository.save(testOrder);

        // 5. Order Items
        testOrderItem1 = new OrderItem();
        testOrderItem1.setOrder(testOrder);
        testOrderItem1.setProduct(testProduct);
        testOrderItem1.setProductNameSnapshot("Red Velvet Supreme 1");
        testOrderItem1.setQuantity(1);
        testOrderItem1.setUnitPrice(BigDecimal.valueOf(650));
        testOrderItem1.setTotalPrice(BigDecimal.valueOf(650));
        testOrderItem1 = orderItemRepository.save(testOrderItem1);

        testOrderItem2 = new OrderItem();
        testOrderItem2.setOrder(testOrder);
        testOrderItem2.setProduct(testProduct);
        testOrderItem2.setProductNameSnapshot("Red Velvet Supreme 2");
        testOrderItem2.setQuantity(1);
        testOrderItem2.setUnitPrice(BigDecimal.valueOf(650));
        testOrderItem2.setTotalPrice(BigDecimal.valueOf(650));
        testOrderItem2 = orderItemRepository.save(testOrderItem2);
    }

    @AfterEach
    void tearDown() {
        for (Long rId : createdReviewIds) {
            try {
                productReviewRepository.deleteById(rId);
            } catch (Exception ignored) {}
        }
        for (Long fId : createdFeedbackIds) {
            try {
                feedbackRepository.deleteById(fId);
            } catch (Exception ignored) {}
        }
        try {
            if (testOrderItem1 != null && testOrderItem1.getId() != null) orderItemRepository.deleteById(testOrderItem1.getId());
            if (testOrderItem2 != null && testOrderItem2.getId() != null) orderItemRepository.deleteById(testOrderItem2.getId());
            if (testOrder != null && testOrder.getId() != null) orderRepository.deleteById(testOrder.getId());
            if (testProduct != null && testProduct.getId() != null) productRepository.deleteById(testProduct.getId());
            if (testShop != null && testShop.getId() != null) shopRepository.deleteById(testShop.getId());
        } catch (Exception ignored) {}

        for (Long uId : createdUserIds) {
            try {
                jdbcTemplate.update("DELETE FROM users WHERE id = ?", uId);
            } catch (Exception ignored) {}
        }
    }

    private ProductReview createTestReview(OrderItem item, String name, int rating, String text, ReviewModerationStatus status) {
        ProductReview review = ProductReview.builder()
                .shop(testShop)
                .product(testProduct)
                .order(testOrder)
                .orderItem(item)
                .customerName(name)
                .customerPhone("+919823101111")
                .rating(rating)
                .reviewText(text)
                .moderationStatus(status)
                .editToken(UUID.randomUUID().toString())
                .cakeImageUrl("https://cdn.example.com/cake.jpg")
                .cakeVideoUrl("https://cdn.example.com/cake.mp4")
                .build();
        if (status == ReviewModerationStatus.HIDDEN) {
            review.setModerationReason("Initial violation");
            review.setModeratedBy(adminUser);
            review.setModeratedAt(LocalDateTime.now());
        }
        ProductReview saved = productReviewRepository.save(review);
        createdReviewIds.add(saved.getId());
        return saved;
    }

    // ==========================================
    // 1. Security & Role Restriction Tests
    // ==========================================

    @Test
    @DisplayName("1. Unauthenticated requests to /api/admin/reviews receive 401 Unauthorized")
    void testListReviews_Unauthenticated_Returns401() throws Exception {
        mockMvc.perform(get("/api/admin/reviews"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(patch("/api/admin/reviews/1/moderation")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"HIDDEN\",\"reason\":\"Spam\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("2. Authenticated CUSTOMER receives 403 Forbidden on admin review endpoints")
    void testCustomerRole_Receives403() throws Exception {
        mockMvc.perform(get("/api/admin/reviews")
                        .header("Authorization", "Bearer " + customerToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(patch("/api/admin/reviews/1/moderation")
                        .header("Authorization", "Bearer " + customerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"HIDDEN\",\"reason\":\"Spam\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("3. Authenticated SHOP_OWNER receives 403 Forbidden on admin review endpoints")
    void testShopOwnerRole_Receives403() throws Exception {
        mockMvc.perform(get("/api/admin/reviews")
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(patch("/api/admin/reviews/1/moderation")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"HIDDEN\",\"reason\":\"Spam\"}"))
                .andExpect(status().isForbidden());
    }

    // ==========================================
    // 2. Admin Review Listing & Filtering Tests
    // ==========================================

    @Test
    @DisplayName("4. ROLE_ADMIN can list reviews with pagination and safe sorting")
    void testListReviews_AdminRole_Success() throws Exception {
        createTestReview(testOrderItem1, "Aarav Sharma", 5, "Amazing cake!", ReviewModerationStatus.PUBLISHED);

        mockMvc.perform(get("/api/admin/reviews")
                        .header("Authorization", "Bearer " + adminToken)
                        .param("page", "0")
                        .param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", notNullValue()))
                .andExpect(jsonPath("$.content.length()", greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.content[0].id", notNullValue()))
                .andExpect(jsonPath("$.content[0].customerName", notNullValue()))
                .andExpect(jsonPath("$.content[0].rating", notNullValue()))
                .andExpect(jsonPath("$.content[0].moderationStatus", notNullValue()))
                .andExpect(jsonPath("$.totalElements", greaterThanOrEqualTo(1)));
    }

    @Test
    @DisplayName("5. Listing reviews filters accurately by moderation status")
    void testListReviews_FilterByModerationStatus() throws Exception {
        ProductReview revPub = createTestReview(testOrderItem1, "Public Customer", 5, "Delightful!", ReviewModerationStatus.PUBLISHED);
        ProductReview revHid = createTestReview(testOrderItem2, "Hidden Customer", 1, "Rude words!", ReviewModerationStatus.HIDDEN);

        // Filter by PUBLISHED
        mockMvc.perform(get("/api/admin/reviews")
                        .header("Authorization", "Bearer " + adminToken)
                        .param("status", "PUBLISHED")
                        .param("shopId", testShop.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()", is(1)))
                .andExpect(jsonPath("$.content[0].id", is(revPub.getId().intValue())))
                .andExpect(jsonPath("$.content[0].moderationStatus", is("PUBLISHED")));

        // Filter by HIDDEN
        mockMvc.perform(get("/api/admin/reviews")
                        .header("Authorization", "Bearer " + adminToken)
                        .param("status", "HIDDEN")
                        .param("shopId", testShop.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()", is(1)))
                .andExpect(jsonPath("$.content[0].id", is(revHid.getId().intValue())))
                .andExpect(jsonPath("$.content[0].moderationStatus", is("HIDDEN")))
                .andExpect(jsonPath("$.content[0].moderationReason", is("Initial violation")));
    }

    @Test
    @DisplayName("6. Listing reviews filters accurately by shop ID and rating")
    void testListReviews_FilterByShopAndRating() throws Exception {
        ProductReview rev5 = createTestReview(testOrderItem1, "Five Star", 5, "Perfection!", ReviewModerationStatus.PUBLISHED);
        ProductReview rev1 = createTestReview(testOrderItem2, "One Star", 1, "Disappointing", ReviewModerationStatus.PUBLISHED);

        // Filter by rating = 5
        mockMvc.perform(get("/api/admin/reviews")
                        .header("Authorization", "Bearer " + adminToken)
                        .param("shopId", testShop.getId().toString())
                        .param("rating", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()", is(1)))
                .andExpect(jsonPath("$.content[0].id", is(rev5.getId().intValue())));

        // Filter by rating = 1
        mockMvc.perform(get("/api/admin/reviews")
                        .header("Authorization", "Bearer " + adminToken)
                        .param("shopId", testShop.getId().toString())
                        .param("rating", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()", is(1)))
                .andExpect(jsonPath("$.content[0].id", is(rev1.getId().intValue())));
    }

    @Test
    @DisplayName("7. Search matches customer name, product name, review text, or bakery name")
    void testListReviews_SearchQuery() throws Exception {
        createTestReview(testOrderItem1, "Deepa Malik", 5, "Sensational strawberry flavor!", ReviewModerationStatus.PUBLISHED);

        // Search by customer name substring
        mockMvc.perform(get("/api/admin/reviews")
                        .header("Authorization", "Bearer " + adminToken)
                        .param("query", "Deepa"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()", greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.content[0].customerName", containsString("Deepa")));

        // Search by review text substring
        mockMvc.perform(get("/api/admin/reviews")
                        .header("Authorization", "Bearer " + adminToken)
                        .param("search", "strawberry"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()", greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.content[0].reviewText", containsString("strawberry")));
    }

    @Test
    @DisplayName("8. Admin review response strictly omits sensitive customer phone and editToken")
    void testAdminResponse_DoesNotExposeSensitiveData() throws Exception {
        ProductReview review = createTestReview(testOrderItem1, "Private Person", 4, "Good cake", ReviewModerationStatus.PUBLISHED);

        mockMvc.perform(get("/api/admin/reviews")
                        .header("Authorization", "Bearer " + adminToken)
                        .param("shopId", testShop.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id", is(review.getId().intValue())))
                .andExpect(jsonPath("$.content[0].customerPhone").doesNotExist())
                .andExpect(jsonPath("$.content[0].editToken").doesNotExist())
                .andExpect(jsonPath("$.content[0].cakeImageUrl", notNullValue()))
                .andExpect(jsonPath("$.content[0].cakeVideoUrl", notNullValue()));
    }

    // ==========================================
    // 3. Moderation (Hide & Restore) Operations
    // ==========================================

    @Test
    @DisplayName("9. Super Admin can hide a published review with mandatory reason")
    void testHideReview_Success() throws Exception {
        ProductReview review = createTestReview(testOrderItem1, "Unhappy Customer", 1, "Harassing content here", ReviewModerationStatus.PUBLISHED);

        AdminReviewModerationRequest request = AdminReviewModerationRequest.builder()
                .status(ReviewModerationStatus.HIDDEN)
                .reason("Contains harassing or defamatory content")
                .build();

        mockMvc.perform(patch("/api/admin/reviews/" + review.getId() + "/moderation")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(review.getId().intValue())))
                .andExpect(jsonPath("$.moderationStatus", is("HIDDEN")))
                .andExpect(jsonPath("$.moderationReason", is("Contains harassing or defamatory content")))
                .andExpect(jsonPath("$.moderatedById", is(adminUser.getId().intValue())))
                .andExpect(jsonPath("$.moderatedByName", is(adminUser.getFullName())))
                .andExpect(jsonPath("$.moderatedAt", notNullValue()));

        // Verify in database
        ProductReview reloaded = productReviewRepository.findById(review.getId()).orElseThrow();
        assertEquals(ReviewModerationStatus.HIDDEN, reloaded.getModerationStatus());
        assertEquals("Contains harassing or defamatory content", reloaded.getModerationReason());
        assertEquals(adminUser.getId(), reloaded.getModeratedBy().getId());
        assertNotNull(reloaded.getModeratedAt());
    }

    @Test
    @DisplayName("10. Hiding review without reason or with blank reason returns 400 Bad Request")
    void testHideReview_MissingReason_Returns400() throws Exception {
        ProductReview review = createTestReview(testOrderItem1, "Customer A", 2, "Poor quality", ReviewModerationStatus.PUBLISHED);

        // Missing reason (null)
        AdminReviewModerationRequest nullReasonReq = AdminReviewModerationRequest.builder()
                .status(ReviewModerationStatus.HIDDEN)
                .reason(null)
                .build();

        mockMvc.perform(patch("/api/admin/reviews/" + review.getId() + "/moderation")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(nullReasonReq)))
                .andExpect(status().isBadRequest());

        // Blank reason
        AdminReviewModerationRequest blankReasonReq = AdminReviewModerationRequest.builder()
                .status(ReviewModerationStatus.HIDDEN)
                .reason("    ")
                .build();

        mockMvc.perform(patch("/api/admin/reviews/" + review.getId() + "/moderation")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(blankReasonReq)))
                .andExpect(status().isBadRequest());

        // Verify review remained PUBLISHED
        ProductReview reloaded = productReviewRepository.findById(review.getId()).orElseThrow();
        assertEquals(ReviewModerationStatus.PUBLISHED, reloaded.getModerationStatus());
    }

    @Test
    @DisplayName("11. Reason exceeding 500 characters returns 400 Bad Request")
    void testHideReview_ReasonExceeding500Chars_Returns400() throws Exception {
        ProductReview review = createTestReview(testOrderItem1, "Customer B", 2, "Test text", ReviewModerationStatus.PUBLISHED);

        String oversizedReason = "A".repeat(501);
        AdminReviewModerationRequest request = AdminReviewModerationRequest.builder()
                .status(ReviewModerationStatus.HIDDEN)
                .reason(oversizedReason)
                .build();

        mockMvc.perform(patch("/api/admin/reviews/" + review.getId() + "/moderation")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("12. Moderating nonexistent review ID returns 404 Not Found")
    void testModerateReview_NotFound_Returns404() throws Exception {
        AdminReviewModerationRequest request = AdminReviewModerationRequest.builder()
                .status(ReviewModerationStatus.HIDDEN)
                .reason("Test Reason")
                .build();

        mockMvc.perform(patch("/api/admin/reviews/999999999/moderation")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("13. Super Admin can restore a hidden review to PUBLISHED and clear moderation metadata")
    void testRestoreReview_Success() throws Exception {
        ProductReview review = createTestReview(testOrderItem1, "Restored Customer", 4, "False alarm review", ReviewModerationStatus.HIDDEN);

        AdminReviewModerationRequest request = AdminReviewModerationRequest.builder()
                .status(ReviewModerationStatus.PUBLISHED)
                .build();

        mockMvc.perform(patch("/api/admin/reviews/" + review.getId() + "/moderation")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(review.getId().intValue())))
                .andExpect(jsonPath("$.moderationStatus", is("PUBLISHED")))
                .andExpect(jsonPath("$.moderationReason").value(nullValue()))
                .andExpect(jsonPath("$.moderatedById").value(nullValue()))
                .andExpect(jsonPath("$.moderatedAt").value(nullValue()));

        // Verify in database
        ProductReview reloaded = productReviewRepository.findById(review.getId()).orElseThrow();
        assertEquals(ReviewModerationStatus.PUBLISHED, reloaded.getModerationStatus());
        assertNull(reloaded.getModerationReason());
        assertNull(reloaded.getModeratedBy());
        assertNull(reloaded.getModeratedAt());
    }

    // ==========================================
    // 4. Activity Audit Logging Tests
    // ==========================================

    @Test
    @DisplayName("14. Moderation actions (HIDE and RESTORE) generate persistent activity audit logs")
    void testModeration_ActivityAuditLogging() throws Exception {
        ProductReview review = createTestReview(testOrderItem1, "Audit Customer", 1, "Questionable content", ReviewModerationStatus.PUBLISHED);

        // 1. Hide Review
        AdminReviewModerationRequest hideReq = AdminReviewModerationRequest.builder()
                .status(ReviewModerationStatus.HIDDEN)
                .reason("Policy violation #42")
                .build();

        mockMvc.perform(patch("/api/admin/reviews/" + review.getId() + "/moderation")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(hideReq)))
                .andExpect(status().isOk());

        // Wait up to 2 seconds for async activity log
        boolean foundHideLog = false;
        for (int i = 0; i < 20; i++) {
            List<ActivityLog> logs = activityLogRepository.findByShopIdAndEntityTypeInOrderByTimestampDesc(
                    testShop.getId(), List.of("PRODUCT_REVIEW"));
            if (logs.stream().anyMatch(l -> "PRODUCT_REVIEW_HIDDEN".equals(l.getAction()) && l.getEntityId().equals(review.getId()))) {
                foundHideLog = true;
                break;
            }
            Thread.sleep(100);
        }
        assertTrue(foundHideLog, "Activity log for PRODUCT_REVIEW_HIDDEN must be recorded");

        // 2. Restore Review
        AdminReviewModerationRequest restoreReq = AdminReviewModerationRequest.builder()
                .status(ReviewModerationStatus.PUBLISHED)
                .build();

        mockMvc.perform(patch("/api/admin/reviews/" + review.getId() + "/moderation")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(restoreReq)))
                .andExpect(status().isOk());

        boolean foundRestoreLog = false;
        for (int i = 0; i < 20; i++) {
            List<ActivityLog> logs = activityLogRepository.findByShopIdAndEntityTypeInOrderByTimestampDesc(
                    testShop.getId(), List.of("PRODUCT_REVIEW"));
            if (logs.stream().anyMatch(l -> "PRODUCT_REVIEW_RESTORED".equals(l.getAction()) && l.getEntityId().equals(review.getId()))) {
                foundRestoreLog = true;
                break;
            }
            Thread.sleep(100);
        }
        assertTrue(foundRestoreLog, "Activity log for PRODUCT_REVIEW_RESTORED must be recorded");
    }

    // ==========================================
    // 5. Storefront Public Visibility & Rating Safety
    // ==========================================

    @Test
    @DisplayName("15. Hiding review removes it from public storefront and recalculates rating; Restoring brings it back")
    void testPublicVisibilityAndRating_AfterHideAndRestore() throws Exception {
        // Create 5-star published review
        ProductReview rev5 = createTestReview(testOrderItem1, "Priya", 5, "Spectacular cake!", ReviewModerationStatus.PUBLISHED);
        // Create 1-star published review
        ProductReview rev1 = createTestReview(testOrderItem2, "Troll", 1, "Abusive text", ReviewModerationStatus.PUBLISHED);

        // Initially: 2 reviews, average = (5+1)/2 = 3.0
        ProductReviewsSummaryResponse summaryInitial = productReviewService.getProductReviewsSummary(testShop.getId(), testProduct.getId());
        assertEquals(2, summaryInitial.getTotalReviews());
        assertEquals(3.0, summaryInitial.getAverageRating());

        // Admin hides the 1-star abusive review
        AdminReviewModerationRequest hideReq = AdminReviewModerationRequest.builder()
                .status(ReviewModerationStatus.HIDDEN)
                .reason("Abusive language")
                .build();

        mockMvc.perform(patch("/api/admin/reviews/" + rev1.getId() + "/moderation")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(hideReq)))
                .andExpect(status().isOk());

        // Storefront after hide: only 1 review, average rating restored to 5.0
        ProductReviewsSummaryResponse summaryAfterHide = productReviewService.getProductReviewsSummary(testShop.getId(), testProduct.getId());
        assertEquals(1, summaryAfterHide.getTotalReviews());
        assertEquals(5.0, summaryAfterHide.getAverageRating());
        assertEquals(1, summaryAfterHide.getReviews().size());
        assertEquals(rev5.getId(), summaryAfterHide.getReviews().get(0).getId());

        // Admin restores the review
        AdminReviewModerationRequest restoreReq = AdminReviewModerationRequest.builder()
                .status(ReviewModerationStatus.PUBLISHED)
                .build();

        mockMvc.perform(patch("/api/admin/reviews/" + rev1.getId() + "/moderation")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(restoreReq)))
                .andExpect(status().isOk());

        // Storefront after restore: back to 2 reviews, average = 3.0
        ProductReviewsSummaryResponse summaryAfterRestore = productReviewService.getProductReviewsSummary(testShop.getId(), testProduct.getId());
        assertEquals(2, summaryAfterRestore.getTotalReviews());
        assertEquals(3.0, summaryAfterRestore.getAverageRating());
    }

    // ==========================================
    // 6. Legacy Feedback Independence
    // ==========================================

    @Test
    @DisplayName("16. Legacy feedback remains completely unchanged and independent")
    void testLegacyFeedback_RemainsIndependent() {
        Feedback fb = new Feedback();
        fb.setShop(testShop);
        fb.setCustomerDisplayName("Legacy User");
        fb.setRating(5);
        fb.setComment("Legacy comment");
        fb.setIsApproved(true);
        fb = feedbackRepository.save(fb);
        createdFeedbackIds.add(fb.getId());

        Long approvedCount = feedbackRepository.countApprovedByShopId(testShop.getId());
        assertNotNull(approvedCount);
        assertTrue(approvedCount >= 1);

        Double avg = feedbackRepository.calculateAverageRatingByShopId(testShop.getId());
        assertNotNull(avg);
        assertEquals(5.0, avg, 0.01);
    }
}
