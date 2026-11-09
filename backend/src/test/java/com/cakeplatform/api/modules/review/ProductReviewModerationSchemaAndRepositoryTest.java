package com.cakeplatform.api.modules.review;

import com.cakeplatform.api.modules.interaction.Feedback;
import com.cakeplatform.api.modules.interaction.FeedbackRepository;
import com.cakeplatform.api.modules.order.Order;
import com.cakeplatform.api.modules.order.OrderItem;
import com.cakeplatform.api.modules.order.OrderItemRepository;
import com.cakeplatform.api.modules.order.OrderRepository;
import com.cakeplatform.api.modules.product.Product;
import com.cakeplatform.api.modules.product.ProductRepository;
import com.cakeplatform.api.modules.review.dto.ProductReviewsSummaryResponse;
import com.cakeplatform.api.modules.review.service.ProductReviewService;
import com.cakeplatform.api.modules.shop.Shop;
import com.cakeplatform.api.modules.shop.ShopRepository;
import com.cakeplatform.api.modules.shop.ShopStatus;
import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.modules.user.UserRepository;
import com.cakeplatform.api.modules.user.UserRole;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
public class ProductReviewModerationSchemaAndRepositoryTest {

    @Autowired
    private ProductReviewRepository productReviewRepository;

    @Autowired
    private ProductReviewService productReviewService;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private ShopRepository shopRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private OrderItemRepository orderItemRepository;

    @Autowired
    private FeedbackRepository feedbackRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private User testOwner;
    private User testAdmin;
    private Shop testShop;
    private Product testProduct;
    private Order testOrder;
    private OrderItem testOrderItemA;
    private OrderItem testOrderItemB;
    private OrderItem testOrderItemC;

    private final List<Long> createdReviewIds = new ArrayList<>();
    private final List<Long> createdFeedbackIds = new ArrayList<>();
    private final List<Long> createdUserIds = new ArrayList<>();

    @BeforeEach
    void setUp() {
        String uniq = UUID.randomUUID().toString().substring(0, 8);

        testOwner = new User();
        testOwner.setFullName("Test Baker " + uniq);
        testOwner.setEmail("baker_" + uniq + "@test.com");
        testOwner.setPasswordHash("hash");
        testOwner.setRole(UserRole.SHOP_OWNER);
        testOwner = userRepository.save(testOwner);
        createdUserIds.add(testOwner.getId());

        testAdmin = new User();
        testAdmin.setFullName("Test Admin " + uniq);
        testAdmin.setEmail("admin_" + uniq + "@test.com");
        testAdmin.setPasswordHash("hash");
        testAdmin.setRole(UserRole.ADMIN);
        testAdmin = userRepository.save(testAdmin);
        createdUserIds.add(testAdmin.getId());

        testShop = new Shop();
        testShop.setBusinessName("Moderation Test Bakery " + uniq);
        testShop.setOwner(testOwner);
        testShop.setStatus(ShopStatus.ACTIVE);
        testShop.setPhone("9876543210");
        testShop = shopRepository.save(testShop);

        testProduct = new Product();
        testProduct.setName("Belgian Chocolate Truffle " + uniq);
        testProduct.setShop(testShop);
        testProduct.setPrice(BigDecimal.valueOf(500));
        testProduct = productRepository.save(testProduct);

        testOrder = new Order();
        testOrder.setShop(testShop);
        testOrder.setOrderNumber("ORD-MOD-" + uniq.toUpperCase());
        testOrder.setCustomerName("Priya Customer");
        testOrder.setCustomerPhone("9823100000");
        testOrder.setOrderStatus("DELIVERED");
        testOrder.setPaymentStatus("PAID");
        testOrder.setPaymentMethod("RAZORPAY");
        testOrder.setSubtotal(BigDecimal.valueOf(1500));
        testOrder.setDeliveryCharge(BigDecimal.ZERO);
        testOrder.setTotalAmount(BigDecimal.valueOf(1500));
        testOrder.setFulfillmentMethod("HOME_DELIVERY");
        testOrder = orderRepository.save(testOrder);

        testOrderItemA = new OrderItem();
        testOrderItemA.setOrder(testOrder);
        testOrderItemA.setProduct(testProduct);
        testOrderItemA.setProductNameSnapshot("Item A");
        testOrderItemA.setQuantity(1);
        testOrderItemA.setUnitPrice(BigDecimal.valueOf(500));
        testOrderItemA.setTotalPrice(BigDecimal.valueOf(500));
        testOrderItemA = orderItemRepository.save(testOrderItemA);

        testOrderItemB = new OrderItem();
        testOrderItemB.setOrder(testOrder);
        testOrderItemB.setProduct(testProduct);
        testOrderItemB.setProductNameSnapshot("Item B");
        testOrderItemB.setQuantity(1);
        testOrderItemB.setUnitPrice(BigDecimal.valueOf(500));
        testOrderItemB.setTotalPrice(BigDecimal.valueOf(500));
        testOrderItemB = orderItemRepository.save(testOrderItemB);

        testOrderItemC = new OrderItem();
        testOrderItemC.setOrder(testOrder);
        testOrderItemC.setProduct(testProduct);
        testOrderItemC.setProductNameSnapshot("Item C");
        testOrderItemC.setQuantity(1);
        testOrderItemC.setUnitPrice(BigDecimal.valueOf(500));
        testOrderItemC.setTotalPrice(BigDecimal.valueOf(500));
        testOrderItemC = orderItemRepository.save(testOrderItemC);
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
            if (testOrderItemA != null && testOrderItemA.getId() != null) orderItemRepository.deleteById(testOrderItemA.getId());
            if (testOrderItemB != null && testOrderItemB.getId() != null) orderItemRepository.deleteById(testOrderItemB.getId());
            if (testOrderItemC != null && testOrderItemC.getId() != null) orderItemRepository.deleteById(testOrderItemC.getId());
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

    @Test
    @DisplayName("1. New product review defaults to PUBLISHED with null moderation metadata")
    void testNewReview_DefaultsToPublished() {
        ProductReview review = ProductReview.builder()
                .shop(testShop)
                .product(testProduct)
                .order(testOrder)
                .orderItem(testOrderItemA)
                .customerName("Aarav Patel")
                .rating(5)
                .reviewText("Decadent and delicious!")
                .build();

        ProductReview saved = productReviewRepository.save(review);
        createdReviewIds.add(saved.getId());

        assertNotNull(saved.getId());
        assertEquals(ReviewModerationStatus.PUBLISHED, saved.getModerationStatus());
        assertNull(saved.getModerationReason());
        assertNull(saved.getModeratedBy());
        assertNull(saved.getModeratedAt());

        // Verify from fresh database query
        ProductReview reloaded = productReviewRepository.findById(saved.getId()).orElseThrow();
        assertEquals(ReviewModerationStatus.PUBLISHED, reloaded.getModerationStatus());
    }

    @Test
    @DisplayName("2. Database CHECK constraint rejects invalid moderation status")
    void testCheckConstraint_RejectsInvalidStatus() {
        assertThrows(DataIntegrityViolationException.class, () -> {
            jdbcTemplate.update(
                    "INSERT INTO product_reviews (shop_id, product_id, order_id, order_item_id, customer_name, rating, moderation_status) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?)",
                    testShop.getId(), testProduct.getId(), testOrder.getId(), testOrderItemA.getId(),
                    "Invalid Tester", 4, "PENDING_APPROVAL"
            );
        });
    }

    @Test
    @DisplayName("3. Database CHECK constraint allows both PUBLISHED and HIDDEN")
    void testCheckConstraint_AllowsPublishedAndHidden() {
        ProductReview review = ProductReview.builder()
                .shop(testShop)
                .product(testProduct)
                .order(testOrder)
                .orderItem(testOrderItemA)
                .customerName("Status Check User")
                .rating(4)
                .moderationStatus(ReviewModerationStatus.PUBLISHED)
                .build();
        ProductReview saved = productReviewRepository.save(review);
        createdReviewIds.add(saved.getId());
        assertEquals(ReviewModerationStatus.PUBLISHED, saved.getModerationStatus());

        saved.setModerationStatus(ReviewModerationStatus.HIDDEN);
        saved.setModerationReason("Flagged by automated filter");
        saved.setModeratedBy(testAdmin);
        saved.setModeratedAt(LocalDateTime.now());
        ProductReview updated = productReviewRepository.save(saved);

        ProductReview reloaded = productReviewRepository.findById(updated.getId()).orElseThrow();
        assertEquals(ReviewModerationStatus.HIDDEN, reloaded.getModerationStatus());
        assertEquals("Flagged by automated filter", reloaded.getModerationReason());
        assertEquals(testAdmin.getId(), reloaded.getModeratedBy().getId());
        assertNotNull(reloaded.getModeratedAt());
    }

    @Test
    @DisplayName("4. PUBLISHED repository queries strictly exclude HIDDEN reviews while preserving ratings")
    void testPublishedQueries_ExcludeHiddenReviews() {
        // Review A: PUBLISHED, 5 stars
        ProductReview reviewA = ProductReview.builder()
                .shop(testShop)
                .product(testProduct)
                .order(testOrder)
                .orderItem(testOrderItemA)
                .customerName("Happy Customer")
                .rating(5)
                .reviewText("Outstanding flavour!")
                .moderationStatus(ReviewModerationStatus.PUBLISHED)
                .build();
        reviewA = productReviewRepository.save(reviewA);
        createdReviewIds.add(reviewA.getId());

        // Review B: HIDDEN, 1 star, moderated
        ProductReview reviewB = ProductReview.builder()
                .shop(testShop)
                .product(testProduct)
                .order(testOrder)
                .orderItem(testOrderItemB)
                .customerName("Abusive Spammer")
                .rating(1)
                .reviewText("Defamatory spam content")
                .moderationStatus(ReviewModerationStatus.HIDDEN)
                .moderationReason("Abusive content violated policy")
                .moderatedBy(testAdmin)
                .moderatedAt(LocalDateTime.now())
                .build();
        reviewB = productReviewRepository.save(reviewB);
        createdReviewIds.add(reviewB.getId());

        // Query PUBLISHED only
        List<ProductReview> publishedReviews = productReviewRepository
                .findByProductIdAndModerationStatusOrderByCreatedAtDesc(testProduct.getId(), ReviewModerationStatus.PUBLISHED);
        assertEquals(1, publishedReviews.size());
        assertEquals(reviewA.getId(), publishedReviews.get(0).getId());

        // Query HIDDEN only
        List<ProductReview> hiddenReviews = productReviewRepository
                .findByProductIdAndModerationStatusOrderByCreatedAtDesc(testProduct.getId(), ReviewModerationStatus.HIDDEN);
        assertEquals(1, hiddenReviews.size());
        assertEquals(reviewB.getId(), hiddenReviews.get(0).getId());

        // Average rating calculation: PUBLISHED should be 5.0 (excluding the 1-star hidden review)
        Double publishedAvg = productReviewRepository.calculateAverageRatingByProductIdPublished(testProduct.getId());
        assertNotNull(publishedAvg);
        assertEquals(5.0, publishedAvg, 0.01);

        Double explicitPublishedAvg = productReviewRepository.calculateAverageRatingByProductIdAndModerationStatus(
                testProduct.getId(), ReviewModerationStatus.PUBLISHED);
        assertNotNull(explicitPublishedAvg);
        assertEquals(5.0, explicitPublishedAvg, 0.01);

        Double hiddenAvg = productReviewRepository.calculateAverageRatingByProductIdAndModerationStatus(
                testProduct.getId(), ReviewModerationStatus.HIDDEN);
        assertNotNull(hiddenAvg);
        assertEquals(1.0, hiddenAvg, 0.01);

        // Counts
        assertEquals(1, productReviewRepository.countByProductIdAndModerationStatus(testProduct.getId(), ReviewModerationStatus.PUBLISHED));
        assertEquals(1, productReviewRepository.countByProductIdAndModerationStatus(testProduct.getId(), ReviewModerationStatus.HIDDEN));
        assertEquals(2, productReviewRepository.countByProductId(testProduct.getId()));
    }

    @Test
    @DisplayName("5. HIDDEN reviews remain safely stored in the database")
    void testHiddenReviews_RemainStored() {
        ProductReview review = ProductReview.builder()
                .shop(testShop)
                .product(testProduct)
                .order(testOrder)
                .orderItem(testOrderItemA)
                .customerName("Hidden Record Customer")
                .rating(2)
                .reviewText("Not satisfied")
                .moderationStatus(ReviewModerationStatus.HIDDEN)
                .moderationReason("Disputed by owner, pending investigation")
                .moderatedBy(testAdmin)
                .moderatedAt(LocalDateTime.now())
                .build();
        ProductReview saved = productReviewRepository.save(review);
        createdReviewIds.add(saved.getId());

        assertTrue(productReviewRepository.existsById(saved.getId()));
        ProductReview reloaded = productReviewRepository.findById(saved.getId()).orElseThrow();
        assertEquals(ReviewModerationStatus.HIDDEN, reloaded.getModerationStatus());
        assertEquals("Disputed by owner, pending investigation", reloaded.getModerationReason());
        assertEquals(testAdmin.getId(), reloaded.getModeratedBy().getId());
    }

    @Test
    @DisplayName("6. Public storefront summary excludes HIDDEN reviews from display and rating calculation")
    void testPublicStorefrontSummary_ExcludesHiddenReviews() {
        // 5-star PUBLISHED review
        ProductReview reviewA = ProductReview.builder()
                .shop(testShop)
                .product(testProduct)
                .order(testOrder)
                .orderItem(testOrderItemA)
                .customerName("Ananya Sen")
                .rating(5)
                .reviewText("Best cake ever!")
                .moderationStatus(ReviewModerationStatus.PUBLISHED)
                .build();
        reviewA = productReviewRepository.save(reviewA);
        createdReviewIds.add(reviewA.getId());

        // 1-star HIDDEN review
        ProductReview reviewB = ProductReview.builder()
                .shop(testShop)
                .product(testProduct)
                .order(testOrder)
                .orderItem(testOrderItemB)
                .customerName("Troll User")
                .rating(1)
                .reviewText("Spam comment!")
                .moderationStatus(ReviewModerationStatus.HIDDEN)
                .moderationReason("Abusive spam")
                .moderatedBy(testAdmin)
                .moderatedAt(LocalDateTime.now())
                .build();
        reviewB = productReviewRepository.save(reviewB);
        createdReviewIds.add(reviewB.getId());

        ProductReviewsSummaryResponse summary = productReviewService.getProductReviewsSummary(
                testShop.getId(), testProduct.getId());

        assertNotNull(summary);
        assertEquals(1, summary.getTotalReviews());
        assertEquals(5.0, summary.getAverageRating());
        assertEquals(1, summary.getReviews().size());
        assertEquals(reviewA.getId(), summary.getReviews().get(0).getId());
    }

    @Test
    @DisplayName("7. Admin moderation queries allow listing and filtering by moderation status")
    void testAdminModerationQueries_FilterAndSearch() {
        ProductReview reviewA = ProductReview.builder()
                .shop(testShop)
                .product(testProduct)
                .order(testOrder)
                .orderItem(testOrderItemA)
                .customerName("Public User")
                .rating(5)
                .moderationStatus(ReviewModerationStatus.PUBLISHED)
                .build();
        reviewA = productReviewRepository.save(reviewA);
        createdReviewIds.add(reviewA.getId());

        ProductReview reviewB = ProductReview.builder()
                .shop(testShop)
                .product(testProduct)
                .order(testOrder)
                .orderItem(testOrderItemB)
                .customerName("Hidden Abuser")
                .rating(1)
                .moderationStatus(ReviewModerationStatus.HIDDEN)
                .moderationReason("Policy violation")
                .moderatedBy(testAdmin)
                .moderatedAt(LocalDateTime.now())
                .build();
        reviewB = productReviewRepository.save(reviewB);
        createdReviewIds.add(reviewB.getId());

        // Admin search by HIDDEN
        Page<ProductReview> hiddenPage = productReviewRepository.searchAllReviewsForAdmin(
                ReviewModerationStatus.HIDDEN, testShop.getId(), null, null, PageRequest.of(0, 10));
        assertEquals(1, hiddenPage.getTotalElements());
        assertEquals(reviewB.getId(), hiddenPage.getContent().get(0).getId());

        // Admin search by PUBLISHED
        Page<ProductReview> publishedPage = productReviewRepository.searchAllReviewsForAdmin(
                ReviewModerationStatus.PUBLISHED, testShop.getId(), null, null, PageRequest.of(0, 10));
        assertEquals(1, publishedPage.getTotalElements());
        assertEquals(reviewA.getId(), publishedPage.getContent().get(0).getId());

        // Admin search all (status == null)
        Page<ProductReview> allPage = productReviewRepository.searchAllReviewsForAdmin(
                null, testShop.getId(), null, null, PageRequest.of(0, 10));
        assertEquals(2, allPage.getTotalElements());
    }

    @Test
    @DisplayName("8. Foreign key on moderated_by sets NULL upon user deletion")
    void testModeratedBy_ForeignKeyOnDeleteSetNull() {
        String uniq = UUID.randomUUID().toString().substring(0, 8);
        User tempModerator = new User();
        tempModerator.setFullName("Temp Mod " + uniq);
        tempModerator.setEmail("tempmod_" + uniq + "@test.com");
        tempModerator.setPasswordHash("hash");
        tempModerator.setRole(UserRole.ADMIN);
        tempModerator = userRepository.save(tempModerator);
        Long tempModId = tempModerator.getId();

        ProductReview review = ProductReview.builder()
                .shop(testShop)
                .product(testProduct)
                .order(testOrder)
                .orderItem(testOrderItemA)
                .customerName("Mod FK Test")
                .rating(3)
                .moderationStatus(ReviewModerationStatus.HIDDEN)
                .moderationReason("Test reason")
                .moderatedBy(tempModerator)
                .moderatedAt(LocalDateTime.now())
                .build();
        review = productReviewRepository.save(review);
        createdReviewIds.add(review.getId());

        // Hard-delete the temporary admin user using raw SQL to trigger the foreign key ON DELETE SET NULL
        jdbcTemplate.update("DELETE FROM users WHERE id = ?", tempModId);

        ProductReview reloaded = productReviewRepository.findById(review.getId()).orElseThrow();
        assertNull(reloaded.getModeratedBy(), "moderated_by must be set to NULL when user is deleted");
        assertEquals(ReviewModerationStatus.HIDDEN, reloaded.getModerationStatus());
        assertEquals("Test reason", reloaded.getModerationReason());
    }

    @Test
    @DisplayName("9. Existing legacy feedback behavior remains completely unchanged")
    void testLegacyFeedback_RemainsUnchanged() {
        Feedback fb = new Feedback();
        fb.setShop(testShop);
        fb.setCustomerDisplayName("Legacy Reviewer");
        fb.setRating(5);
        fb.setComment("Great legacy feedback");
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
