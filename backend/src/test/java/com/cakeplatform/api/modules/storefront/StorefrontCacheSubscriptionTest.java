package com.cakeplatform.api.modules.storefront;

import com.cakeplatform.api.modules.product.Product;
import com.cakeplatform.api.modules.product.ProductRepository;
import com.cakeplatform.api.modules.shop.Shop;
import com.cakeplatform.api.modules.shop.ShopRepository;
import com.cakeplatform.api.modules.shop.ShopStatus;
import com.cakeplatform.api.modules.storefront.dto.StorefrontShopResponse;
import com.cakeplatform.api.modules.subscription.Subscription;
import com.cakeplatform.api.modules.subscription.SubscriptionRepository;
import com.cakeplatform.api.modules.subscription.SubscriptionStatus;
import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.modules.user.UserRepository;
import com.cakeplatform.api.modules.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cache.CacheManager;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
public class StorefrontCacheSubscriptionTest {

    @Autowired
    private CustomerStorefrontService storefrontService;

    @Autowired
    private ShopRepository shopRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private SubscriptionRepository subscriptionRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CacheManager cacheManager;

    @Autowired
    private StorefrontCacheService storefrontCacheService;

    private Shop shop1;
    private Shop shop2;
    private Product product1;

    @BeforeEach
    void setUp() {
        // Clear caches
        if (cacheManager.getCache("shopDetails") != null) {
            cacheManager.getCache("shopDetails").clear();
        }
        if (cacheManager.getCache("shopProducts") != null) {
            cacheManager.getCache("shopProducts").clear();
        }

        User owner1 = new User();
        owner1.setEmail("cache_owner1_" + UUID.randomUUID() + "@test.com");
        owner1.setFullName("Cache Test Owner 1");
        owner1.setMobile(String.valueOf(System.currentTimeMillis()).substring(4));
        owner1.setPasswordHash("hash");
        owner1.setRole(UserRole.SHOP_OWNER);
        owner1 = userRepository.save(owner1);

        User owner2 = new User();
        owner2.setEmail("cache_owner2_" + UUID.randomUUID() + "@test.com");
        owner2.setFullName("Cache Test Owner 2");
        owner2.setMobile(String.valueOf(System.currentTimeMillis() + 1).substring(4));
        owner2.setPasswordHash("hash");
        owner2.setRole(UserRole.SHOP_OWNER);
        owner2 = userRepository.save(owner2);

        shop1 = new Shop();
        shop1.setOwner(owner1);
        shop1.setBusinessName("Cache Bakery 1");
        shop1.setStatus(ShopStatus.ACTIVE);
        shop1 = shopRepository.save(shop1);

        shop2 = new Shop();
        shop2.setOwner(owner2);
        shop2.setBusinessName("Cache Bakery 2");
        shop2.setStatus(ShopStatus.ACTIVE);
        shop2 = shopRepository.save(shop2);

        product1 = new Product();
        product1.setShop(shop1);
        product1.setName("Cache Cake");
        product1.setPrice(BigDecimal.valueOf(450));
        product1.setAvailability(true);
        product1.setStatus("ACTIVE");
        product1 = productRepository.save(product1);
    }

    @Test
    @DisplayName("Cache Runtime: Valid subscription populates cache; expired subscription blocks cached response")
    void testCache_BlocksExpiredSubscriptionEvenIfPreviouslyCached() {
        // 1. Give shop1 an ACTIVE subscription with 30-day validity
        Subscription sub = new Subscription();
        sub.setShop(shop1);
        sub.setStatus(SubscriptionStatus.ACTIVE);
        sub.setAmount(BigDecimal.ZERO);
        sub.setStartDate(LocalDateTime.now());
        sub.setExpiryDate(LocalDateTime.now().plusDays(30));
        sub = subscriptionRepository.save(sub);

        // 2. First call: populates cache
        StorefrontShopResponse details = storefrontService.getShopDetails(shop1.getId());
        assertNotNull(details);
        assertEquals("Cache Bakery 1", details.getBusinessName());

        // Verify it was stored in cache
        assertNotNull(cacheManager.getCache("shopDetails").get(shop1.getId()));

        // Also test getShopProducts caching
        List<Product> products = storefrontService.getShopProducts(shop1.getId());
        assertFalse(products.isEmpty());
        assertNotNull(cacheManager.getCache("shopProducts").get(shop1.getId()));

        // 3. Subscription expires (time passes or update to EXPIRED)
        sub.setStatus(SubscriptionStatus.EXPIRED);
        sub.setExpiryDate(LocalDateTime.now().minusMinutes(1));
        subscriptionRepository.save(sub);

        // 4. Calling getShopDetails must NOT return the cached value!
        // Spring evaluates condition="#root.target.isShopSubscriptionValid(#shopId)" which returns false,
        // bypassing cache lookup and triggering activeShop validation which throws.
        RuntimeException exDetails = assertThrows(RuntimeException.class, () -> {
            storefrontService.getShopDetails(shop1.getId());
        });
        assertTrue(exDetails.getMessage().contains("expired subscription"));

        // 5. Calling getShopProducts must also NOT return the cached products
        RuntimeException exProducts = assertThrows(RuntimeException.class, () -> {
            storefrontService.getShopProducts(shop1.getId());
        });
        assertTrue(exProducts.getMessage().contains("expired subscription"));
    }

    @Test
    @DisplayName("Cache Runtime: Fixed clock transition disables cache lookup at exact boundary")
    void testCache_ClockBoundaryDisablesCache() {
        Instant baseInstant = Instant.parse("2026-10-10T12:00:00Z");
        ZoneId zone = ZoneId.of("UTC");
        storefrontService.setClock(Clock.fixed(baseInstant, zone));

        // Subscription valid until 10 seconds in future
        Subscription sub = new Subscription();
        sub.setShop(shop1);
        sub.setStatus(SubscriptionStatus.ACTIVE);
        sub.setAmount(BigDecimal.ZERO);
        sub.setStartDate(LocalDateTime.ofInstant(baseInstant.minusSeconds(3600), zone));
        sub.setExpiryDate(LocalDateTime.ofInstant(baseInstant.plusSeconds(10), zone));
        subscriptionRepository.save(sub);

        // Caches details before boundary
        StorefrontShopResponse response = storefrontService.getShopDetails(shop1.getId());
        assertNotNull(response);

        // Advance clock to exact expiry boundary
        storefrontService.setClock(Clock.fixed(baseInstant.plusSeconds(10), zone));

        // Must reject access despite cache presence
        assertThrows(RuntimeException.class, () -> storefrontService.getShopDetails(shop1.getId()));
    }

    @Test
    @DisplayName("Cache Runtime: Tenant isolation preserves Shop 2 cache while Shop 1 is expired")
    void testCache_TenantIsolation() {
        // Shop 1 active
        Subscription sub1 = new Subscription();
        sub1.setShop(shop1);
        sub1.setStatus(SubscriptionStatus.ACTIVE);
        sub1.setAmount(BigDecimal.ZERO);
        sub1.setExpiryDate(LocalDateTime.now().plusDays(30));
        subscriptionRepository.save(sub1);

        // Shop 2 active
        Subscription sub2 = new Subscription();
        sub2.setShop(shop2);
        sub2.setStatus(SubscriptionStatus.ACTIVE);
        sub2.setAmount(BigDecimal.ZERO);
        sub2.setExpiryDate(LocalDateTime.now().plusDays(30));
        subscriptionRepository.save(sub2);

        // Both cached
        assertNotNull(storefrontService.getShopDetails(shop1.getId()));
        assertNotNull(storefrontService.getShopDetails(shop2.getId()));

        // Expire Shop 1 only
        sub1.setStatus(SubscriptionStatus.EXPIRED);
        subscriptionRepository.save(sub1);

        // Shop 1 blocked
        assertThrows(RuntimeException.class, () -> storefrontService.getShopDetails(shop1.getId()));

        // Shop 2 remains accessible and served from cache
        StorefrontShopResponse shop2Details = storefrontService.getShopDetails(shop2.getId());
        assertNotNull(shop2Details);
        assertEquals("Cache Bakery 2", shop2Details.getBusinessName());
    }

    @Test
    @DisplayName("Cache Runtime: Eviction helper clears cache entries")
    void testCache_EvictionHelper() {
        Subscription sub = new Subscription();
        sub.setShop(shop1);
        sub.setStatus(SubscriptionStatus.ACTIVE);
        sub.setAmount(BigDecimal.ZERO);
        sub.setExpiryDate(LocalDateTime.now().plusDays(30));
        subscriptionRepository.save(sub);

        storefrontService.getShopDetails(shop1.getId());
        storefrontService.getShopProducts(shop1.getId());

        assertNotNull(cacheManager.getCache("shopDetails").get(shop1.getId()));
        assertNotNull(cacheManager.getCache("shopProducts").get(shop1.getId()));

        storefrontCacheService.evictShopDetails(shop1.getId());
        storefrontCacheService.evictShopProducts(shop1.getId());

        assertNull(cacheManager.getCache("shopDetails").get(shop1.getId()));
        assertNull(cacheManager.getCache("shopProducts").get(shop1.getId()));
    }

    @Test
    @DisplayName("Subscription Validation: isShopSubscriptionValid returns false safely on null or invalid shopId")
    void testIsShopSubscriptionValid_SafeHandling() {
        assertDoesNotThrow(() -> {
            boolean nullResult = storefrontService.isShopSubscriptionValid(null);
            assertFalse(nullResult);

            boolean nonExistentResult = storefrontService.isShopSubscriptionValid(999999L);
            assertFalse(nonExistentResult);
        });
    }
}
