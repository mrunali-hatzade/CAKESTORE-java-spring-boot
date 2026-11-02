package com.cakeplatform.api.modules.product.service;

import com.cakeplatform.api.modules.audit.ActivityLoggerService;
import com.cakeplatform.api.modules.product.Product;
import com.cakeplatform.api.modules.product.ProductCategoryRepository;
import com.cakeplatform.api.modules.product.ProductRepository;
import com.cakeplatform.api.modules.product.dto.ProductRequest;
import com.cakeplatform.api.modules.security.ShopAccessValidator;
import com.cakeplatform.api.modules.shop.Shop;
import com.cakeplatform.api.modules.storefront.StorefrontCacheService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
public class ProductDietaryClassificationTest {

    @Mock
    private ProductRepository productRepository;

    @Mock
    private ProductCategoryRepository categoryRepository;

    @Mock
    private ShopAccessValidator shopAccessValidator;

    @Mock
    private ActivityLoggerService activityLogger;

    @Mock
    private StorefrontCacheService storefrontCacheService;

    @InjectMocks
    private ProductService productService;

    private Shop shop;
    private final Long OWNER_ID = 100L;
    private final Long SHOP_ID = 1L;

    @BeforeEach
    void setUp() {
        shop = new Shop();
        shop.setId(SHOP_ID);
        shop.setBusinessName("Artisan Bakes");

        when(shopAccessValidator.getValidShopForOwner(OWNER_ID)).thenReturn(shop);
        when(productRepository.save(any(Product.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    private ProductRequest buildBaseRequest(String name) {
        ProductRequest req = new ProductRequest();
        req.setName(name);
        req.setPrice(new BigDecimal("500.00"));
        return req;
    }

    @Test
    @DisplayName("1. Regular cake without egg customization -> isEggless = false")
    void test1_RegularCakeWithoutEggCustomization() {
        ProductRequest req = buildBaseRequest("Classic Chocolate Sponge");
        req.setEggPreferenceDefault("REGULAR");
        req.setAllowEggChoice(false);
        req.setIsEggless(null);

        Product product = productService.createProduct(OWNER_ID, req);

        assertFalse(product.getIsEggless(), "Regular cake must not be classified as eggless");
        assertEquals("REGULAR", product.getEggPreferenceDefault());
        assertFalse(product.getAllowEggChoice());
    }

    @Test
    @DisplayName("2. Eggless cake -> isEggless = true")
    void test2_EgglessCake() {
        ProductRequest req = buildBaseRequest("Eggless Dark Truffle");
        req.setEggPreferenceDefault("EGGLESS");
        req.setAllowEggChoice(false);
        req.setIsEggless(null);

        Product product = productService.createProduct(OWNER_ID, req);

        assertTrue(product.getIsEggless(), "Eggless default recipe must be classified as eggless");
        assertEquals("EGGLESS", product.getEggPreferenceDefault());
        assertFalse(product.getAllowEggChoice());
    }

    @Test
    @DisplayName("3. Regular cake with allowEggChoice = true -> isEggless = false")
    void test3_RegularCakeWithOptionalEgglessChoice() {
        ProductRequest req = buildBaseRequest("Yellow Sponge with Eggless Option");
        req.setEggPreferenceDefault("REGULAR");
        req.setAllowEggChoice(true);
        req.setIsEggless(null);

        Product product = productService.createProduct(OWNER_ID, req);

        assertFalse(product.getIsEggless(), "Regular cake with optional eggless choice must NOT be marked isEggless=true");
        assertEquals("REGULAR", product.getEggPreferenceDefault());
        assertTrue(product.getAllowEggChoice());
    }

    @Test
    @DisplayName("4. Eggless cake with optional customization -> isEggless = true")
    void test4_EgglessCakeWithOptionalCustomization() {
        ProductRequest req = buildBaseRequest("Eggless Vanilla Celebration");
        req.setEggPreferenceDefault("EGGLESS");
        req.setAllowEggChoice(true);
        req.setIsEggless(null);

        Product product = productService.createProduct(OWNER_ID, req);

        assertTrue(product.getIsEggless(), "Eggless default recipe with optional toggle remains eggless");
        assertEquals("EGGLESS", product.getEggPreferenceDefault());
        assertTrue(product.getAllowEggChoice());
    }

    @Test
    @DisplayName("5. Explicit isEggless = false -> isEggless = false")
    void test5_ExplicitIsEgglessFalse() {
        ProductRequest req = buildBaseRequest("Specialty Cake");
        req.setEggPreferenceDefault("EGGLESS");
        req.setAllowEggChoice(true);
        req.setIsEggless(false);

        Product product = productService.createProduct(OWNER_ID, req);

        assertFalse(product.getIsEggless(), "Explicitly marked isEggless=false must be honored");
    }

    @Test
    @DisplayName("6. Explicit isEggless = true -> isEggless = true")
    void test6_ExplicitIsEgglessTrue() {
        ProductRequest req = buildBaseRequest("Custom Formulation Cake");
        req.setEggPreferenceDefault("REGULAR");
        req.setAllowEggChoice(false);
        req.setIsEggless(true);

        Product product = productService.createProduct(OWNER_ID, req);

        assertTrue(product.getIsEggless(), "Explicitly marked isEggless=true must be honored");
    }

    @Test
    @DisplayName("7. Product update where isEggless is omitted -> preserves recipe classification")
    void test7_ProductUpdateWhereIsEgglessIsOmitted() {
        Product existing = new Product();
        existing.setId(201L);
        existing.setName("Existing Regular Cake");
        existing.setEggPreferenceDefault("REGULAR");
        existing.setAllowEggChoice(true);
        existing.setIsEggless(false);

        when(productRepository.findByIdAndShopId(201L, SHOP_ID)).thenReturn(Optional.of(existing));

        ProductRequest updateReq = buildBaseRequest("Existing Regular Cake Renamed");
        updateReq.setEggPreferenceDefault("REGULAR");
        updateReq.setAllowEggChoice(true);
        updateReq.setIsEggless(null); // omitted

        Product updated = productService.updateProduct(201L, OWNER_ID, updateReq);

        assertFalse(updated.getIsEggless(), "Omitted isEggless on regular cake update must preserve isEggless=false");
    }

    @Test
    @DisplayName("8. Product update where isEggless is explicitly false -> isEggless = false")
    void test8_ProductUpdateWhereIsEgglessIsExplicitlyFalse() {
        Product existing = new Product();
        existing.setId(202L);
        existing.setName("Cake Switching to Regular");
        existing.setEggPreferenceDefault("EGGLESS");
        existing.setIsEggless(true);

        when(productRepository.findByIdAndShopId(202L, SHOP_ID)).thenReturn(Optional.of(existing));

        ProductRequest updateReq = buildBaseRequest("Cake Switching to Regular");
        updateReq.setEggPreferenceDefault("REGULAR");
        updateReq.setIsEggless(false);

        Product updated = productService.updateProduct(202L, OWNER_ID, updateReq);

        assertFalse(updated.getIsEggless(), "Explicit isEggless=false in update must set isEggless to false");
    }

    @Test
    @DisplayName("9. Product update where default recipe changes from REGULAR to EGGLESS -> isEggless = true")
    void test9_ProductUpdateWhereDefaultRecipeChangesFromRegularToEggless() {
        Product existing = new Product();
        existing.setId(203L);
        existing.setName("Recipe Reformulation Cake");
        existing.setEggPreferenceDefault("REGULAR");
        existing.setIsEggless(false);

        when(productRepository.findByIdAndShopId(203L, SHOP_ID)).thenReturn(Optional.of(existing));

        ProductRequest updateReq = buildBaseRequest("Recipe Reformulation Cake");
        updateReq.setEggPreferenceDefault("EGGLESS");
        updateReq.setIsEggless(null); // omitted, derived from recipe change

        Product updated = productService.updateProduct(203L, OWNER_ID, updateReq);

        assertTrue(updated.getIsEggless(), "Changing default recipe to EGGLESS must update isEggless to true");
    }

    @Test
    @DisplayName("10. Product update where default recipe changes from EGGLESS to REGULAR -> isEggless = false")
    void test10_ProductUpdateWhereDefaultRecipeChangesFromEgglessToRegular() {
        Product existing = new Product();
        existing.setId(204L);
        existing.setName("Traditional Sponge Cake");
        existing.setEggPreferenceDefault("EGGLESS");
        existing.setIsEggless(true);

        when(productRepository.findByIdAndShopId(204L, SHOP_ID)).thenReturn(Optional.of(existing));

        ProductRequest updateReq = buildBaseRequest("Traditional Sponge Cake");
        updateReq.setEggPreferenceDefault("REGULAR");
        updateReq.setAllowEggChoice(true); // Optional eggless choice available
        updateReq.setIsEggless(null); // omitted, derived from recipe change

        Product updated = productService.updateProduct(204L, OWNER_ID, updateReq);

        assertFalse(updated.getIsEggless(), "Changing default recipe to REGULAR must set isEggless to false even if allowEggChoice is true");
    }
}

