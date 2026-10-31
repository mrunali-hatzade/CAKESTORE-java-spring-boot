package com.cakeplatform.api.modules.auth;

import com.cakeplatform.api.config.GlobalExceptionHandler;
import com.cakeplatform.api.modules.auth.dto.AuthResponse;
import com.cakeplatform.api.modules.auth.dto.RegisterRequest;
import com.cakeplatform.api.modules.auth.service.AuthService;
import com.cakeplatform.api.modules.media.StorageService;
import com.cakeplatform.api.modules.notification.AdminNotificationService;
import com.cakeplatform.api.modules.shop.*;
import com.cakeplatform.api.modules.storefront.CustomerStorefrontController;
import com.cakeplatform.api.modules.storefront.CustomerStorefrontService;
import com.cakeplatform.api.modules.storefront.dto.StorefrontShopResponse;
import com.cakeplatform.api.modules.subscription.Subscription;
import com.cakeplatform.api.modules.subscription.SubscriptionRepository;
import com.cakeplatform.api.modules.subscription.SubscriptionStatus;
import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.modules.user.UserRepository;
import com.cakeplatform.api.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class BusinessTypeMappingAndPrivacyTest {

    @Nested
    @DisplayName("1. BusinessType Enum Mapping & Normalization Unit Tests")
    class BusinessTypeEnumTests {

        @Test
        @DisplayName("Canonical values resolve correctly (case-insensitive and trimmed)")
        void testCanonicalValues() {
            assertEquals(BusinessType.HOME_BAKERY, BusinessType.fromString("HOME_BAKERY"));
            assertEquals(BusinessType.HOME_BAKERY, BusinessType.fromString("home_bakery"));
            assertEquals(BusinessType.HOME_BAKERY, BusinessType.fromString("  Home_Bakery  "));

            assertEquals(BusinessType.BAKERY_SHOP, BusinessType.fromString("BAKERY_SHOP"));
            assertEquals(BusinessType.BAKERY_SHOP, BusinessType.fromString("bakery_shop"));

            assertEquals(BusinessType.CAKE_STUDIO, BusinessType.fromString("CAKE_STUDIO"));
            assertEquals(BusinessType.CAKE_STUDIO, BusinessType.fromString("cake_studio"));

            assertEquals(BusinessType.ONLINE_CAKE_BUSINESS, BusinessType.fromString("ONLINE_CAKE_BUSINESS"));
            assertEquals(BusinessType.ONLINE_CAKE_BUSINESS, BusinessType.fromString("online_cake_business"));

            assertEquals(BusinessType.OTHER, BusinessType.fromString("OTHER"));
            assertEquals(BusinessType.OTHER, BusinessType.fromString("other"));
        }

        @Test
        @DisplayName("Legacy aliases resolve to correct canonical values")
        void testLegacyAliases() {
            // HOME_BAKER -> HOME_BAKERY
            assertEquals(BusinessType.HOME_BAKERY, BusinessType.fromString("HOME_BAKER"));
            assertEquals(BusinessType.HOME_BAKERY, BusinessType.fromString("home_baker"));
            assertEquals(BusinessType.HOME_BAKERY, BusinessType.fromString("home-baker"));

            // PASTRY_SHOP -> BAKERY_SHOP
            assertEquals(BusinessType.BAKERY_SHOP, BusinessType.fromString("PASTRY_SHOP"));
            assertEquals(BusinessType.BAKERY_SHOP, BusinessType.fromString("pastry_shop"));
            assertEquals(BusinessType.BAKERY_SHOP, BusinessType.fromString("pastry-shop"));

            // CUSTOM_CAKE_STUDIO -> CAKE_STUDIO
            assertEquals(BusinessType.CAKE_STUDIO, BusinessType.fromString("CUSTOM_CAKE_STUDIO"));
            assertEquals(BusinessType.CAKE_STUDIO, BusinessType.fromString("custom_cake_studio"));
            assertEquals(BusinessType.CAKE_STUDIO, BusinessType.fromString("custom-cake-studio"));

            // COMMERCIAL_BAKERY -> ONLINE_CAKE_BUSINESS
            assertEquals(BusinessType.ONLINE_CAKE_BUSINESS, BusinessType.fromString("COMMERCIAL_BAKERY"));
            assertEquals(BusinessType.ONLINE_CAKE_BUSINESS, BusinessType.fromString("commercial_bakery"));
            assertEquals(BusinessType.ONLINE_CAKE_BUSINESS, BusinessType.fromString("commercial-bakery"));
        }

        @Test
        @DisplayName("Null or blank returns null without throwing exception")
        void testNullOrBlank() {
            assertNull(BusinessType.fromString(null));
            assertNull(BusinessType.fromString(""));
            assertNull(BusinessType.fromString("   "));
        }

        @Test
        @DisplayName("Invalid business type throws IllegalArgumentException with descriptive message")
        void testInvalidBusinessType() {
            IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
                BusinessType.fromString("UNSUPPORTED_BUSINESS_TYPE");
            });
            assertTrue(ex.getMessage().contains("Invalid business type: 'UNSUPPORTED_BUSINESS_TYPE'"));
            assertTrue(ex.getMessage().contains("HOME_BAKERY"));
            assertTrue(ex.getMessage().contains("HOME_BAKER"));

            assertThrows(IllegalArgumentException.class, () -> BusinessType.fromString("RANDOM_STRING"));
            assertThrows(IllegalArgumentException.class, () -> BusinessType.fromString("12345"));
        }
    }

    @Nested
    @DisplayName("2. Owner Registration & Persistence Tests")
    class OwnerRegistrationTests {

        @Mock private UserRepository userRepository;
        @Mock private ShopRepository shopRepository;
        @Mock private SubscriptionRepository subscriptionRepository;
        @Mock private PasswordEncoder passwordEncoder;
        @Mock private JwtService jwtService;
        @Mock private AuthenticationManager authenticationManager;
        @Mock private StorageService storageService;
        @Mock private BusinessDocumentRepository businessDocumentRepository;
        @Mock private AdminNotificationService adminNotificationService;
        @Mock private ShopStorefrontSettingsRepository shopStorefrontSettingsRepository;

        private AuthService authService;

        @BeforeEach
        void setUp() {
            authService = new AuthService(
                    userRepository,
                    shopRepository,
                    subscriptionRepository,
                    passwordEncoder,
                    jwtService,
                    authenticationManager,
                    storageService,
                    businessDocumentRepository,
                    adminNotificationService
            );
            authService.setShopStorefrontSettingsRepository(shopStorefrontSettingsRepository);
        }

        private RegisterRequest createValidRequest(String businessType) {
            return RegisterRequest.builder()
                    .fullName("Rohan Patil")
                    .email("rohan@example.com")
                    .password("ValidPass123!")
                    .mobile("9876543210")
                    .businessName("Rohan's Delights")
                    .businessType(businessType)
                    .addressLine1("Flat 101, Residency Road")
                    .addressLine2("Opposite City Center")
                    .area("Kothrud")
                    .city("Pune")
                    .state("Maharashtra")
                    .pincode("411038")
                    .build();
        }

        @Test
        @DisplayName("Register with canonical HOME_BAKERY persists HOME_BAKERY and defaults address privacy to TRUE")
        void testRegister_CanonicalHomeBakery_EnablesPrivacy() {
            RegisterRequest req = createValidRequest("HOME_BAKERY");

            when(userRepository.findByEmail(any())).thenReturn(Optional.empty());
            when(userRepository.existsByEmailIgnoreCase(any())).thenReturn(false);
            when(userRepository.existsByMobile(any())).thenReturn(false);
            when(userRepository.findByMobile(any())).thenReturn(Optional.empty());
            when(passwordEncoder.encode(any())).thenReturn("hashedPassword");

            when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
                User u = invocation.getArgument(0);
                u.setId(10L);
                return u;
            });
            when(shopRepository.existsByOwnerId(10L)).thenReturn(false);

            when(shopRepository.save(any(Shop.class))).thenAnswer(invocation -> {
                Shop s = invocation.getArgument(0);
                s.setId(50L);
                return s;
            });

            when(jwtService.generateToken(any())).thenReturn("mock-jwt-token");

            AuthResponse resp = authService.register(req);
            assertNotNull(resp);

            ArgumentCaptor<Shop> shopCaptor = ArgumentCaptor.forClass(Shop.class);
            verify(shopRepository).save(shopCaptor.capture());
            Shop persistedShop = shopCaptor.getValue();
            assertEquals(BusinessType.HOME_BAKERY, persistedShop.getBusinessType());

            ArgumentCaptor<ShopStorefrontSettings> settingsCaptor = ArgumentCaptor.forClass(ShopStorefrontSettings.class);
            verify(shopStorefrontSettingsRepository).save(settingsCaptor.capture());
            ShopStorefrontSettings settings = settingsCaptor.getValue();
            assertTrue(settings.getHideStreetAddress(), "Home bakery must default to hideStreetAddress = true");
            assertEquals(50L, settings.getShop().getId());
        }

        @Test
        @DisplayName("Register with legacy alias HOME_BAKER resolves to HOME_BAKERY and defaults address privacy to TRUE")
        void testRegister_LegacyHomeBakerAlias_EnablesPrivacy() {
            RegisterRequest req = createValidRequest("HOME_BAKER");

            when(userRepository.findByEmail(any())).thenReturn(Optional.empty());
            when(userRepository.existsByEmailIgnoreCase(any())).thenReturn(false);
            when(userRepository.existsByMobile(any())).thenReturn(false);
            when(userRepository.findByMobile(any())).thenReturn(Optional.empty());
            when(passwordEncoder.encode(any())).thenReturn("hashedPassword");

            when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
                User u = invocation.getArgument(0);
                u.setId(11L);
                return u;
            });
            when(shopRepository.existsByOwnerId(11L)).thenReturn(false);

            when(shopRepository.save(any(Shop.class))).thenAnswer(invocation -> {
                Shop s = invocation.getArgument(0);
                s.setId(51L);
                return s;
            });

            when(jwtService.generateToken(any())).thenReturn("mock-jwt-token");

            authService.register(req);

            ArgumentCaptor<Shop> shopCaptor = ArgumentCaptor.forClass(Shop.class);
            verify(shopRepository).save(shopCaptor.capture());
            assertEquals(BusinessType.HOME_BAKERY, shopCaptor.getValue().getBusinessType());

            ArgumentCaptor<ShopStorefrontSettings> settingsCaptor = ArgumentCaptor.forClass(ShopStorefrontSettings.class);
            verify(shopStorefrontSettingsRepository).save(settingsCaptor.capture());
            assertTrue(settingsCaptor.getValue().getHideStreetAddress());
        }

        @Test
        @DisplayName("Register with BAKERY_SHOP (or legacy PASTRY_SHOP) defaults address privacy to FALSE")
        void testRegister_BakeryShop_LeavesPrivacyFalse() {
            RegisterRequest req = createValidRequest("PASTRY_SHOP");

            when(userRepository.findByEmail(any())).thenReturn(Optional.empty());
            when(userRepository.existsByEmailIgnoreCase(any())).thenReturn(false);
            when(userRepository.existsByMobile(any())).thenReturn(false);
            when(userRepository.findByMobile(any())).thenReturn(Optional.empty());
            when(passwordEncoder.encode(any())).thenReturn("hashedPassword");

            when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
                User u = invocation.getArgument(0);
                u.setId(12L);
                return u;
            });
            when(shopRepository.existsByOwnerId(12L)).thenReturn(false);

            when(shopRepository.save(any(Shop.class))).thenAnswer(invocation -> {
                Shop s = invocation.getArgument(0);
                s.setId(52L);
                return s;
            });

            when(jwtService.generateToken(any())).thenReturn("mock-jwt-token");

            authService.register(req);

            ArgumentCaptor<Shop> shopCaptor = ArgumentCaptor.forClass(Shop.class);
            verify(shopRepository).save(shopCaptor.capture());
            assertEquals(BusinessType.BAKERY_SHOP, shopCaptor.getValue().getBusinessType());

            ArgumentCaptor<ShopStorefrontSettings> settingsCaptor = ArgumentCaptor.forClass(ShopStorefrontSettings.class);
            verify(shopStorefrontSettingsRepository).save(settingsCaptor.capture());
            assertFalse(settingsCaptor.getValue().getHideStreetAddress(), "Commercial / retail shop must retain hideStreetAddress = false");
        }

        @Test
        @DisplayName("Register with unsupported business type throws IllegalArgumentException and prevents shop save")
        void testRegister_InvalidBusinessType_ThrowsExceptionAndRollsBack() {
            RegisterRequest req = createValidRequest("COMPLETELY_INVALID_TYPE");

            when(userRepository.findByEmail(any())).thenReturn(Optional.empty());
            when(userRepository.existsByEmailIgnoreCase(any())).thenReturn(false);
            when(userRepository.existsByMobile(any())).thenReturn(false);
            when(userRepository.findByMobile(any())).thenReturn(Optional.empty());
            when(passwordEncoder.encode(any())).thenReturn("hashedPassword");

            User savedUser = new User();
            savedUser.setId(13L);
            when(userRepository.save(any(User.class))).thenReturn(savedUser);
            when(shopRepository.existsByOwnerId(13L)).thenReturn(false);

            IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
                authService.register(req);
            });

            assertTrue(ex.getMessage().contains("Invalid business type"));
            // Verify shop was never persisted due to exception
            verify(shopRepository, never()).save(any(Shop.class));
            verify(shopStorefrontSettingsRepository, never()).save(any());
        }

        @Test
        @DisplayName("GlobalExceptionHandler maps IllegalArgumentException to HTTP 400 Bad Request")
        void testGlobalExceptionHandler_Returns400() {
            GlobalExceptionHandler handler = new GlobalExceptionHandler();
            IllegalArgumentException ex = new IllegalArgumentException("Invalid business type: 'XYZ'");
            ResponseEntity<Map<String, String>> response = handler.handleIllegalArgumentException(ex);

            assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
            assertNotNull(response.getBody());
            assertEquals("Invalid business type: 'XYZ'", response.getBody().get("error"));
        }
    }

    @Nested
    @DisplayName("3. Public Storefront Address Privacy Enforcement Tests")
    class PublicStorefrontAddressPrivacyTests {

        @Mock private ShopRepository shopRepository;
        @Mock private SubscriptionRepository subscriptionRepository;
        @Mock private ShopStorefrontSettingsRepository shopStorefrontSettingsRepository;
        @Mock private CustomerStorefrontService storefrontService;

        private CustomerStorefrontService realService;

        @BeforeEach
        void setUp() {
            realService = new CustomerStorefrontService(
                    shopRepository,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    shopStorefrontSettingsRepository,
                    null,
                    null,
                    null,
                    subscriptionRepository,
                    null
            );
        }

        private Shop createHomeBakeryShop() {
            Shop shop = new Shop();
            shop.setId(100L);
            shop.setBusinessName("Sweet Nest Home Bakery");
            shop.setBusinessType(BusinessType.HOME_BAKERY);
            shop.setStatus(ShopStatus.ACTIVE);
            shop.setAddressLine1("Flat 402, Sunshine Apartments");
            shop.setAddressLine2("Sector 21");
            shop.setAddress("Flat 402, Sunshine Apartments, Sector 21");
            shop.setArea("Wakad");
            shop.setCity("Pune");
            shop.setDistrict("Pune");
            shop.setState("Maharashtra");
            shop.setPincode("411057");
            shop.setLatitude(18.598);
            shop.setLongitude(73.763);
            return shop;
        }

        private Shop createRetailBakeryShop() {
            Shop shop = new Shop();
            shop.setId(200L);
            shop.setBusinessName("Grand Central Patisserie");
            shop.setBusinessType(BusinessType.BAKERY_SHOP);
            shop.setStatus(ShopStatus.ACTIVE);
            shop.setAddressLine1("Shop 12, Main High Street");
            shop.setAddressLine2("Near Metro Station");
            shop.setAddress("Shop 12, Main High Street, Near Metro Station");
            shop.setArea("FC Road");
            shop.setCity("Pune");
            shop.setDistrict("Pune");
            shop.setState("Maharashtra");
            shop.setPincode("411004");
            shop.setLatitude(18.520);
            shop.setLongitude(73.856);
            return shop;
        }

        private Subscription createActiveSubscription(Long shopId) {
            Subscription sub = new Subscription();
            sub.setId(1L);
            Shop shop = new Shop();
            shop.setId(shopId);
            sub.setShop(shop);
            sub.setStatus(SubscriptionStatus.ACTIVE);
            sub.setExpiryDate(LocalDateTime.now().plusMonths(6));
            return sub;
        }

        @Test
        @DisplayName("Home bakery with hideStreetAddress=true masks residential street address but retains city/area")
        void testGetShopDetails_HomeBakery_WithPrivacySetting_HidesAddress() {
            Shop shop = createHomeBakeryShop();
            when(shopRepository.findById(100L)).thenReturn(Optional.of(shop));
            when(subscriptionRepository.findFirstByShopIdOrderByCreatedAtDesc(100L))
                    .thenReturn(Optional.of(createActiveSubscription(100L)));

            ShopStorefrontSettings ss = ShopStorefrontSettings.builder()
                    .shop(shop)
                    .hideStreetAddress(true)
                    .build();
            when(shopStorefrontSettingsRepository.findByShopId(100L)).thenReturn(Optional.of(ss));

            StorefrontShopResponse details = realService.getShopDetails(100L);

            assertNotNull(details);
            // Residential street address components must be scrubbed
            assertNull(details.getAddress(), "Street address should be null for home bakery with privacy");
            assertNull(details.getAddressLine1(), "AddressLine1 should be null for home bakery with privacy");
            assertNull(details.getAddressLine2(), "AddressLine2 should be null for home bakery with privacy");
            assertNull(details.getLatitude(), "Latitude should be null for home bakery with privacy");
            assertNull(details.getLongitude(), "Longitude should be null for home bakery with privacy");

            // Locality & city information must be preserved for search and delivery validation
            assertEquals("Wakad", details.getArea());
            assertEquals("Pune", details.getCity());
            assertEquals("Maharashtra", details.getState());
            assertEquals("411057", details.getPincode());
        }

        @Test
        @DisplayName("Home bakery WITHOUT storefront settings record still defaults to hiding street address (defense-in-depth)")
        void testGetShopDetails_HomeBakery_WithoutSettingsRow_FallsBackToHidingAddress() {
            Shop shop = createHomeBakeryShop();
            when(shopRepository.findById(100L)).thenReturn(Optional.of(shop));
            when(subscriptionRepository.findFirstByShopIdOrderByCreatedAtDesc(100L))
                    .thenReturn(Optional.of(createActiveSubscription(100L)));

            // No settings row in database (e.g. legacy shop)
            when(shopStorefrontSettingsRepository.findByShopId(100L)).thenReturn(Optional.empty());

            StorefrontShopResponse details = realService.getShopDetails(100L);

            assertNotNull(details);
            assertNull(details.getAddress(), "Street address must be hidden by fallback for HOME_BAKERY");
            assertNull(details.getAddressLine1());
            assertNull(details.getAddressLine2());
            assertNull(details.getLatitude());
            assertNull(details.getLongitude());

            assertEquals("Wakad", details.getArea());
            assertEquals("Pune", details.getCity());
        }

        @Test
        @DisplayName("Retail bakery shop with hideStreetAddress=false retains full street address and coordinates")
        void testGetShopDetails_RetailBakery_RetainsStreetAddress() {
            Shop shop = createRetailBakeryShop();
            when(shopRepository.findById(200L)).thenReturn(Optional.of(shop));
            when(subscriptionRepository.findFirstByShopIdOrderByCreatedAtDesc(200L))
                    .thenReturn(Optional.of(createActiveSubscription(200L)));

            ShopStorefrontSettings ss = ShopStorefrontSettings.builder()
                    .shop(shop)
                    .hideStreetAddress(false)
                    .build();
            when(shopStorefrontSettingsRepository.findByShopId(200L)).thenReturn(Optional.of(ss));

            StorefrontShopResponse details = realService.getShopDetails(200L);

            assertNotNull(details);
            assertEquals("Shop 12, Main High Street, Near Metro Station", details.getAddress());
            assertEquals("Shop 12, Main High Street", details.getAddressLine1());
            assertEquals("Near Metro Station", details.getAddressLine2());
            assertEquals(18.520, details.getLatitude());
            assertEquals(73.856, details.getLongitude());
            assertEquals("FC Road", details.getArea());
            assertEquals("Pune", details.getCity());
        }
    }

    @Nested
    @DisplayName("4. Customer Storefront Controller Search Alias Support")
    class CustomerStorefrontControllerTests {

        @Mock private CustomerStorefrontService storefrontService;
        private CustomerStorefrontController controller;

        @BeforeEach
        void setUp() {
            controller = new CustomerStorefrontController(storefrontService);
        }

        @Test
        @DisplayName("Search with legacy alias HOME_BAKER parses to canonical HOME_BAKERY")
        void testSearch_LegacyAlias_ResolvesToCanonical() {
            when(storefrontService.discoverShops(
                    any(), any(), any(), any(), any(), any(),
                    eq(BusinessType.HOME_BAKERY),
                    any(), any(), any(), any(), any(), any(), any()
            )).thenReturn(Collections.emptyList());

            ResponseEntity<?> resp = controller.searchShops(
                    null, null, null, null, null, null,
                    "HOME_BAKER",
                    null, null, null, null, 10.0, null, null, 20
            );

            assertEquals(HttpStatus.OK, resp.getStatusCode());
            verify(storefrontService).discoverShops(
                    any(), any(), any(), any(), any(), any(),
                    eq(BusinessType.HOME_BAKERY),
                    any(), any(), any(), any(), any(), any(), any()
            );
        }

        @Test
        @DisplayName("Search with invalid business type gracefully returns empty list without error")
        void testSearch_InvalidBusinessType_ReturnsEmptyGracefully() {
            ResponseEntity<?> resp = controller.searchShops(
                    null, null, null, null, null, null,
                    "TOTALLY_INVALID_TYPE",
                    null, null, null, null, 10.0, null, null, 20
            );

            assertEquals(HttpStatus.OK, resp.getStatusCode());
            assertTrue(((java.util.List<?>) resp.getBody()).isEmpty());
            verifyNoInteractions(storefrontService);
        }
    }
}
