package com.cakeplatform.api.modules.shop.service;

import com.cakeplatform.api.modules.auth.dto.AuthResponse;
import com.cakeplatform.api.modules.auth.dto.RegisterRequest;
import com.cakeplatform.api.modules.auth.service.AuthService;
import com.cakeplatform.api.modules.order.InvoiceService;
import com.cakeplatform.api.modules.order.Order;
import com.cakeplatform.api.modules.order.OrderRepository;
import com.cakeplatform.api.modules.shop.*;
import com.cakeplatform.api.modules.shop.dto.ShopSocialLinkRequest;
import com.cakeplatform.api.modules.shop.dto.ShopSocialLinkResponse;
import com.cakeplatform.api.modules.shop.dto.ShopStorefrontSettingsRequest;
import com.cakeplatform.api.modules.storefront.CustomerStorefrontService;
import com.cakeplatform.api.modules.storefront.dto.StorefrontShopResponse;
import com.cakeplatform.api.modules.subscription.Subscription;
import com.cakeplatform.api.modules.subscription.SubscriptionRepository;
import com.cakeplatform.api.modules.subscription.SubscriptionStatus;
import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.modules.user.UserRepository;
import com.cakeplatform.api.modules.user.UserRole;
import com.cakeplatform.api.modules.user.UserStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest
@ActiveProfiles("test")
public class StorefrontPhase2IntegrationTest {

    @Autowired
    private OwnerStorefrontService ownerStorefrontService;

    @Autowired
    private CustomerStorefrontService customerStorefrontService;

    @Autowired
    private InvoiceService invoiceService;

    @Autowired
    private AuthService authService;

    @Autowired
    private ShopRepository shopRepository;

    @Autowired
    private ShopStorefrontSettingsRepository settingsRepo;

    @Autowired
    private ShopSocialLinkRepository socialLinkRepo;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SubscriptionRepository subscriptionRepository;

    @Autowired
    private OrderRepository orderRepository;

    private User owner1;
    private User owner2;
    private Shop shop1;
    private Shop shop2;

    private String generateUniqueMobile(String prefix) {
        for (int i = 0; i < 100; i++) {
            long rand = Math.abs(java.util.UUID.randomUUID().getLeastSignificantBits() % 100000000L);
            String candidate = prefix + String.format("%08d", rand);
            if (userRepository.findByMobileIncludingDeleted(candidate).isEmpty()) {
                return candidate;
            }
        }
        return prefix + String.valueOf(System.nanoTime()).substring(7);
    }

    @BeforeEach
    void setUp() {
        String uid1 = java.util.UUID.randomUUID().toString();

        // Create owner 1 & shop 1
        owner1 = new User();
        owner1.setFullName("Owner One");
        owner1.setEmail("owner1_" + uid1 + "@example.com");
        owner1.setMobile(generateUniqueMobile("98"));
        owner1.setPasswordHash("hash");
        owner1.setRole(UserRole.SHOP_OWNER);
        owner1.setStatus(UserStatus.ACTIVE);
        owner1 = userRepository.save(owner1);

        shop1 = new Shop();
        shop1.setOwner(owner1);
        shop1.setBusinessName("Sweet Delights 1");
        shop1.setPhone("9876543210");
        shop1.setStatus(ShopStatus.ACTIVE);
        shop1.setAddress("42 Blossom Lane, Near Clock Tower");
        shop1.setAddressLine1("42 Blossom Lane");
        shop1.setAddressLine2("Near Clock Tower");
        shop1.setArea("Koramangala");
        shop1.setCity("Bengaluru");
        shop1.setDistrict("Bengaluru Urban");
        shop1.setState("Karnataka");
        shop1.setPincode("560034");
        shop1.setLatitude(12.9352);
        shop1.setLongitude(77.6245);
        shop1.setMapLocationUrl("https://maps.google.com/?q=12.9352,77.6245");
        shop1.setBusinessType(BusinessType.HOME_BAKERY);
        shop1 = shopRepository.save(shop1);

        // Subscription for shop 1
        Subscription sub1 = new Subscription();
        sub1.setShop(shop1);
        sub1.setStatus(SubscriptionStatus.ACTIVE);
        sub1.setAmount(BigDecimal.valueOf(100));
        sub1.setStartDate(LocalDateTime.now().minusDays(1));
        sub1.setExpiryDate(LocalDateTime.now().plusMonths(1));
        subscriptionRepository.save(sub1);

        // Settings for shop 1 (default false to verify existing shop compatibility)
        ShopStorefrontSettings s1 = new ShopStorefrontSettings();
        s1.setShop(shop1);
        s1.setHideStreetAddress(false);
        settingsRepo.save(s1);

        // Create owner 2 & shop 2 for tenant isolation verification
        String uid2 = java.util.UUID.randomUUID().toString();
        owner2 = new User();
        owner2.setFullName("Owner Two");
        owner2.setEmail("owner2_" + uid2 + "@example.com");
        owner2.setMobile(generateUniqueMobile("97"));
        owner2.setPasswordHash("hash");
        owner2.setRole(UserRole.SHOP_OWNER);
        owner2.setStatus(UserStatus.ACTIVE);
        owner2 = userRepository.save(owner2);

        shop2 = new Shop();
        shop2.setOwner(owner2);
        shop2.setBusinessName("Downtown Cakes 2");
        shop2.setPhone("9876543211");
        shop2.setStatus(ShopStatus.ACTIVE);
        shop2.setAddress("100 MG Road");
        shop2.setCity("Bengaluru");
        shop2.setState("Karnataka");
        shop2.setPincode("560001");
        shop2.setBusinessType(BusinessType.BAKERY_SHOP);
        shop2 = shopRepository.save(shop2);

        Subscription sub2 = new Subscription();
        sub2.setShop(shop2);
        sub2.setStatus(SubscriptionStatus.ACTIVE);
        sub2.setAmount(BigDecimal.valueOf(100));
        sub2.setStartDate(LocalDateTime.now().minusDays(1));
        sub2.setExpiryDate(LocalDateTime.now().plusMonths(1));
        subscriptionRepository.save(sub2);

        ShopStorefrontSettings s2 = new ShopStorefrontSettings();
        s2.setShop(shop2);
        s2.setHideStreetAddress(false);
        settingsRepo.save(s2);
    }

    // -------------------------------------------------------------------------
    // 1. Social Links CRUD & Platform Validation Tests
    // -------------------------------------------------------------------------

    @Test
    void shouldCreateAndListSocialLinksForOwner() {
        ShopSocialLinkRequest req = new ShopSocialLinkRequest();
        req.setPlatform("INSTAGRAM");
        req.setTitle("Follow our Instagram");
        req.setUrl("https://instagram.com/sweetdelights");
        req.setIsActive(true);
        req.setDisplayOrder(1);

        ShopSocialLinkResponse created = ownerStorefrontService.createSocialLink(owner1.getId(), req);
        assertThat(created.getId()).isNotNull();
        assertThat(created.getPlatform()).isEqualTo("INSTAGRAM");
        assertThat(created.getTitle()).isEqualTo("Follow our Instagram");
        assertThat(created.getUrl()).isEqualTo("https://instagram.com/sweetdelights");
        assertThat(created.getIsActive()).isTrue();

        List<ShopSocialLinkResponse> list = ownerStorefrontService.getSocialLinks(owner1.getId());
        assertThat(list).hasSize(1);
        assertThat(list.get(0).getId()).isEqualTo(created.getId());
    }

    @Test
    void shouldSupportCustomPlatformsAndExternalLinks() {
        ShopSocialLinkRequest req = new ShopSocialLinkRequest();
        req.setPlatform("CUSTOM");
        req.setTitle("Chef's Personal Portfolio");
        req.setUrl("https://chefdelights.blog");
        req.setIsActive(true);

        ShopSocialLinkResponse created = ownerStorefrontService.createSocialLink(owner1.getId(), req);
        assertThat(created.getPlatform()).isEqualTo("CUSTOM");
        assertThat(created.getTitle()).isEqualTo("Chef's Personal Portfolio");
        assertThat(created.getUrl()).isEqualTo("https://chefdelights.blog");
    }

    @Test
    void shouldUpdateSocialLink() {
        ShopSocialLinkRequest req = new ShopSocialLinkRequest();
        req.setPlatform("YOUTUBE");
        req.setTitle("Watch our Recipes");
        req.setUrl("https://youtube.com/@sweetdelights");
        req.setIsActive(true);

        ShopSocialLinkResponse created = ownerStorefrontService.createSocialLink(owner1.getId(), req);

        ShopSocialLinkRequest updateReq = new ShopSocialLinkRequest();
        updateReq.setPlatform("YOUTUBE");
        updateReq.setTitle("YouTube Channel & Masterclasses");
        updateReq.setUrl("https://youtube.com/@sweetdelights_official");
        updateReq.setIsActive(false);
        updateReq.setDisplayOrder(5);

        ShopSocialLinkResponse updated = ownerStorefrontService.updateSocialLink(owner1.getId(), created.getId(), updateReq);
        assertThat(updated.getTitle()).isEqualTo("YouTube Channel & Masterclasses");
        assertThat(updated.getUrl()).isEqualTo("https://youtube.com/@sweetdelights_official");
        assertThat(updated.getIsActive()).isFalse();
        assertThat(updated.getDisplayOrder()).isEqualTo(5);
    }

    @Test
    void shouldDeleteSocialLink() {
        ShopSocialLinkRequest req = new ShopSocialLinkRequest();
        req.setPlatform("FACEBOOK");
        req.setTitle("Facebook Page");
        req.setUrl("https://facebook.com/sweetdelights");

        ShopSocialLinkResponse created = ownerStorefrontService.createSocialLink(owner1.getId(), req);
        assertThat(ownerStorefrontService.getSocialLinks(owner1.getId())).hasSize(1);

        ownerStorefrontService.deleteSocialLink(owner1.getId(), created.getId());
        assertThat(ownerStorefrontService.getSocialLinks(owner1.getId())).isEmpty();
    }

    @Test
    void shouldRejectDangerousAndInvalidUrls() {
        ShopSocialLinkRequest req1 = new ShopSocialLinkRequest();
        req1.setPlatform("INSTAGRAM");
        req1.setTitle("Hacked Link");
        req1.setUrl("javascript:alert(1)");
        assertThrows(IllegalArgumentException.class, () -> ownerStorefrontService.createSocialLink(owner1.getId(), req1));

        ShopSocialLinkRequest req2 = new ShopSocialLinkRequest();
        req2.setPlatform("CUSTOM");
        req2.setTitle("Data link");
        req2.setUrl("data:text/html,<script>alert(1)</script>");
        assertThrows(IllegalArgumentException.class, () -> ownerStorefrontService.createSocialLink(owner1.getId(), req2));

        ShopSocialLinkRequest req3 = new ShopSocialLinkRequest();
        req3.setPlatform("CUSTOM");
        req3.setTitle("No protocol");
        req3.setUrl("www.google.com");
        assertThrows(IllegalArgumentException.class, () -> ownerStorefrontService.createSocialLink(owner1.getId(), req3));
    }

    @Test
    void shouldEnforceTenantIsolationForSocialLinks() {
        ShopSocialLinkRequest req = new ShopSocialLinkRequest();
        req.setPlatform("INSTAGRAM");
        req.setTitle("Shop 1 Insta");
        req.setUrl("https://instagram.com/shop1");
        ShopSocialLinkResponse created = ownerStorefrontService.createSocialLink(owner1.getId(), req);

        // Owner 2 cannot update shop 1's link
        ShopSocialLinkRequest updateReq = new ShopSocialLinkRequest();
        updateReq.setPlatform("INSTAGRAM");
        updateReq.setTitle("Malicious Overwrite");
        updateReq.setUrl("https://instagram.com/shop2");
        assertThrows(RuntimeException.class, () ->
            ownerStorefrontService.updateSocialLink(owner2.getId(), created.getId(), updateReq)
        );

        // Owner 2 cannot delete shop 1's link
        assertThrows(RuntimeException.class, () ->
            ownerStorefrontService.deleteSocialLink(owner2.getId(), created.getId())
        );

        // Owner 2's list must not contain shop 1's link
        List<ShopSocialLinkResponse> shop2Links = ownerStorefrontService.getSocialLinks(owner2.getId());
        assertThat(shop2Links).isEmpty();
    }

    @Test
    void shouldExposeOnlyActiveLinksInPublicStorefront() {
        ShopSocialLinkRequest activeReq = new ShopSocialLinkRequest();
        activeReq.setPlatform("INSTAGRAM");
        activeReq.setTitle("Active Insta");
        activeReq.setUrl("https://instagram.com/active");
        activeReq.setIsActive(true);
        ownerStorefrontService.createSocialLink(owner1.getId(), activeReq);

        ShopSocialLinkRequest inactiveReq = new ShopSocialLinkRequest();
        inactiveReq.setPlatform("YOUTUBE");
        inactiveReq.setTitle("Inactive YouTube");
        inactiveReq.setUrl("https://youtube.com/inactive");
        inactiveReq.setIsActive(false);
        ownerStorefrontService.createSocialLink(owner1.getId(), inactiveReq);

        StorefrontShopResponse publicResponse = customerStorefrontService.getShopDetails(shop1.getId());
        assertThat(publicResponse.getSocialLinks()).hasSize(1);
        assertThat(publicResponse.getSocialLinks().get(0).getPlatform()).isEqualTo("INSTAGRAM");
    }

    // -------------------------------------------------------------------------
    // 2. Home-Baker Address Privacy Tests
    // -------------------------------------------------------------------------

    @Test
    void shouldRetainPreviousBehaviorForExistingShopsByDefault() {
        // When hideStreetAddress is false, public response exposes street address and coordinates
        StorefrontShopResponse publicResponse = customerStorefrontService.getShopDetails(shop1.getId());
        assertThat(publicResponse.getAddress()).isEqualTo("42 Blossom Lane, Near Clock Tower");
        assertThat(publicResponse.getAddressLine1()).isEqualTo("42 Blossom Lane");
        assertThat(publicResponse.getMapLocationUrl()).isNotNull();
        assertThat(publicResponse.getLatitude()).isNotNull();
    }

    @Test
    void shouldRedactStreetAddressAndPreciseCoordinatesWhenPrivacyEnabled() {
        // Enable privacy for shop1
        ShopStorefrontSettingsRequest settingsReq = new ShopStorefrontSettingsRequest();
        settingsReq.setHideStreetAddress(true);

        ownerStorefrontService.updateStorefrontSettings(owner1.getId(), settingsReq);

        // Check public response
        StorefrontShopResponse publicResponse = customerStorefrontService.getShopDetails(shop1.getId());

        // Private residential street address & coordinates must be completely redacted
        assertThat(publicResponse.getAddress()).isNull();
        assertThat(publicResponse.getAddressLine1()).isNull();
        assertThat(publicResponse.getAddressLine2()).isNull();
        assertThat(publicResponse.getMapLocationUrl()).isNull();
        assertThat(publicResponse.getLatitude()).isNull();
        assertThat(publicResponse.getLongitude()).isNull();

        // Locality fields remain available for customer delivery & pickup area clarity
        assertThat(publicResponse.getArea()).isEqualTo("Koramangala");
        assertThat(publicResponse.getCity()).isEqualTo("Bengaluru");
        assertThat(publicResponse.getDistrict()).isEqualTo("Bengaluru Urban");
        assertThat(publicResponse.getState()).isEqualTo("Karnataka");
        assertThat(publicResponse.getPincode()).isEqualTo("560034");

        // Internal / authorized database record remains fully intact
        Shop internalShop = shopRepository.findById(shop1.getId()).orElseThrow();
        assertThat(internalShop.getAddress()).isEqualTo("42 Blossom Lane, Near Clock Tower");
        assertThat(internalShop.getAddressLine1()).isEqualTo("42 Blossom Lane");
        assertThat(internalShop.getLatitude()).isNotNull();
    }

    @Test
    void shouldAutoEnablePrivacyForNewlyRegisteredHomeBaker() {
        String uid = java.util.UUID.randomUUID().toString();
        String email = "ananya_" + uid + "@example.com";
        RegisterRequest regReq = RegisterRequest.builder()
                .fullName("Chef Ananya")
                .email(email)
                .mobile(generateUniqueMobile("96"))
                .password("Password@123")
                .businessName("Ananya's Home Treats " + uid.substring(0, 8))
                .businessType("HOME_BAKERY")
                .addressLine1("Flat 201, Rosewood Apts")
                .state("Maharashtra")
                .district("Pune")
                .city("Pimpri-Chinchwad")
                .area("Akurdi")
                .pincode("411035")
                .build();

        authService.register(regReq);

        User registeredUser = userRepository.findByEmail(email).orElseThrow();
        Shop registeredShop = shopRepository.findByOwnerId(registeredUser.getId()).get(0);

        ShopStorefrontSettings settings = settingsRepo.findByShopId(registeredShop.getId()).orElseThrow();
        assertThat(settings.getHideStreetAddress())
                .as("Newly registered HOME_BAKERY must have hideStreetAddress enabled by default")
                .isTrue();

        // Activate shop and subscription to test public response
        registeredShop.setStatus(ShopStatus.ACTIVE);
        registeredShop = shopRepository.save(registeredShop);

        Subscription sub = new Subscription();
        sub.setShop(registeredShop);
        sub.setStatus(SubscriptionStatus.ACTIVE);
        sub.setAmount(BigDecimal.valueOf(100));
        sub.setStartDate(LocalDateTime.now().minusDays(1));
        sub.setExpiryDate(LocalDateTime.now().plusMonths(1));
        subscriptionRepository.save(sub);

        StorefrontShopResponse publicShop = customerStorefrontService.getShopDetails(registeredShop.getId());
        assertThat(publicShop.getAddress()).isNull();
        assertThat(publicShop.getAddressLine1()).isNull();
    }

    @Test
    void shouldNotAutoEnablePrivacyForCommercialBakeryRegistration() {
        String uid = java.util.UUID.randomUUID().toString();
        String email = "vikram_" + uid + "@example.com";
        RegisterRequest regReq = RegisterRequest.builder()
                .fullName("Chef Vikram")
                .email(email)
                .mobile(generateUniqueMobile("95"))
                .password("Password@123")
                .businessName("Vikram's Bakehouse " + uid.substring(0, 8))
                .businessType("BAKERY_SHOP")
                .addressLine1("Shop 12, Commercial Road")
                .state("Maharashtra")
                .district("Pune")
                .city("Pimpri-Chinchwad")
                .area("Chinchwad")
                .pincode("411033")
                .build();

        authService.register(regReq);

        User registeredUser = userRepository.findByEmail(email).orElseThrow();
        Shop registeredShop = shopRepository.findByOwnerId(registeredUser.getId()).get(0);

        ShopStorefrontSettings settings = settingsRepo.findByShopId(registeredShop.getId()).orElse(null);
        assertThat(settings == null || Boolean.FALSE.equals(settings.getHideStreetAddress()))
                .as("Newly registered commercial bakery must retain default privacy disabled")
                .isTrue();
    }

    // -------------------------------------------------------------------------
    // 3. Customer-Facing Invoice Address Masking Tests
    // -------------------------------------------------------------------------

    @Test
    void shouldMaskAddressInCustomerInvoiceWhenPrivacyEnabled() throws Exception {
        // Create an order for shop1
        Order order = new Order();
        order.setOrderNumber("ORD-TEST-" + System.currentTimeMillis());
        order.setShop(shop1);
        order.setCustomerName("Rohit Verma");
        order.setCustomerEmail("rohit@example.com");
        order.setCustomerPhone("9988776655");
        order.setDeliveryAddress("Flat 101, Test Appt");
        order.setOrderStatus("PAID");
        order.setPaymentStatus("SUCCESS");
        order.setSubtotal(BigDecimal.valueOf(500));
        order.setTotalAmount(BigDecimal.valueOf(500));
        order.setCreatedAt(LocalDateTime.now());
        order = orderRepository.save(order);

        // Case 1: hideStreetAddress is false -> invoice generated with full address
        byte[] pdfWithoutPrivacy = invoiceService.generateInvoice(order);
        assertThat(pdfWithoutPrivacy).isNotNull();
        assertThat(pdfWithoutPrivacy.length).isGreaterThan(0);

        // Case 2: hideStreetAddress is true -> invoice generated with masked address
        ShopStorefrontSettings settings = settingsRepo.findByShopId(shop1.getId()).orElseThrow();
        settings.setHideStreetAddress(true);
        settingsRepo.save(settings);
        shop1.setStorefrontSettings(settings);

        byte[] pdfWithPrivacy = invoiceService.generateInvoice(order);
        assertThat(pdfWithPrivacy).isNotNull();
        assertThat(pdfWithPrivacy.length).isGreaterThan(0);
    }
}
