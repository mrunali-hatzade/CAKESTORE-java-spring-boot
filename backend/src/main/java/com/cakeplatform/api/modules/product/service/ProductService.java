package com.cakeplatform.api.modules.product.service;

import com.cakeplatform.api.modules.audit.ActivityLoggerService;
import com.cakeplatform.api.modules.product.Product;
import com.cakeplatform.api.modules.product.ProductHighlight;
import com.cakeplatform.api.modules.product.ProductImage;
import com.cakeplatform.api.modules.product.ProductRepository;
import com.cakeplatform.api.modules.product.dto.ProductRequest;
import com.cakeplatform.api.modules.shop.Shop;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;
    private final com.cakeplatform.api.modules.product.ProductCategoryRepository categoryRepository;
    private final com.cakeplatform.api.modules.security.ShopAccessValidator shopAccessValidator;
    private final ActivityLoggerService activityLogger;
    private final com.cakeplatform.api.modules.storefront.StorefrontCacheService storefrontCacheService;

    private Shop getShopByOwnerId(Long ownerId) {
        return shopAccessValidator.getValidShopForOwner(ownerId);
    }

    public org.springframework.data.domain.Page<Product> getProductsByUserId(Long userId, String search, Long categoryId, org.springframework.data.domain.Pageable pageable) {
        Shop shop = getShopByOwnerId(userId);
        return productRepository.findByShopIdWithFilters(shop.getId(), search, categoryId, pageable);
    }

    @Transactional
    public Product createProduct(Long userId, ProductRequest request) {
        Shop shop = getShopByOwnerId(userId);

        Product product = new Product();
        product.setShop(shop);
        applyBasicProductFields(product, request, shop);

        // Images (Max 3 alternative images enforced by backend)
        applyProductImages(product, request.getImages());

        // Highlights
        applyProductHighlights(product, request.getHighlights());

        // Variants / Flavours
        applyProductVariants(product, request.getVariants());

        // Addons
        applyProductAddons(product, request.getAddons());

        Product saved = productRepository.save(product);
        if (storefrontCacheService != null) {
            storefrontCacheService.evictShopProducts(shop.getId());
        }
        activityLogger.logActivity(userId, shop.getId(), "PRODUCT_CREATED", "PRODUCT", saved.getId(), "Name: " + saved.getName());
        return saved;
    }

    @Transactional
    public Product updateProduct(Long productId, Long userId, ProductRequest request) {
        Shop shop = getShopByOwnerId(userId);

        Product product = productRepository.findByIdAndShopId(productId, shop.getId())
                .orElseThrow(() -> new RuntimeException("Product not found or unauthorized"));

        applyBasicProductFields(product, request, shop);

        if (request.getImages() != null) {
            product.getImages().clear();
            applyProductImages(product, request.getImages());
        }

        if (request.getHighlights() != null) {
            product.getHighlights().clear();
            applyProductHighlights(product, request.getHighlights());
        }

        if (request.getVariants() != null) {
            product.getVariants().clear();
            applyProductVariants(product, request.getVariants());
        }

        if (request.getAddons() != null) {
            product.getAddons().clear();
            applyProductAddons(product, request.getAddons());
        }

        Product updated = productRepository.save(product);
        if (storefrontCacheService != null) {
            storefrontCacheService.evictShopProducts(shop.getId());
        }
        activityLogger.logActivity(userId, shop.getId(), "PRODUCT_UPDATED", "PRODUCT", updated.getId(), "Name: " + updated.getName());
        return updated;
    }

    private void applyBasicProductFields(Product product, ProductRequest request, Shop shop) {
        product.setName(request.getName().trim());
        product.setDescription(request.getDescription());
        product.setIngredients(request.getIngredients());
        product.setAllergens(request.getAllergens());
        product.setPrice(request.getPrice());
        product.setOriginalPrice(request.getOriginalPrice());
        product.setImageUrl(request.getImageUrl());
        product.setAvailability(request.getAvailability() != null ? request.getAvailability() : true);
        product.setStatus("ACTIVE");
        product.setAllowEggChoice(Boolean.TRUE.equals(request.getAllowEggChoice()));

        String eggPreferenceDefault = request.getEggPreferenceDefault();
        if (eggPreferenceDefault == null && product.getEggPreferenceDefault() != null) {
            eggPreferenceDefault = product.getEggPreferenceDefault();
        } else if (eggPreferenceDefault == null) {
            eggPreferenceDefault = "EGGLESS";
        }
        product.setEggPreferenceDefault(eggPreferenceDefault);
        product.setEgglessPriceDiff(request.getEgglessPriceDiff() != null ? request.getEgglessPriceDiff() : java.math.BigDecimal.ZERO);

        // Classification Rule:
        // 1. If isEggless is explicitly specified (true or false), honor the explicit setting.
        // 2. Otherwise (omitted/null), classify as eggless only if default recipe is EGGLESS.
        // allowEggChoice does NOT independently make a product eggless.
        boolean eggless;
        if (request.getIsEggless() != null) {
            eggless = request.getIsEggless();
        } else {
            eggless = "EGGLESS".equalsIgnoreCase(eggPreferenceDefault);
        }
        product.setIsEggless(eggless);
        product.setIsVegan(Boolean.TRUE.equals(request.getIsVegan()));
        product.setIsGlutenFree(Boolean.TRUE.equals(request.getIsGlutenFree()));

        if (request.getCategoryId() != null) {
            com.cakeplatform.api.modules.product.ProductCategory category = categoryRepository.findByIdAndShopId(request.getCategoryId(), shop.getId())
                    .orElseThrow(() -> new IllegalArgumentException("Category not found or does not belong to your shop"));
            product.setCategory(category);
        } else {
            product.setCategory(null);
        }
    }

    private void applyProductImages(Product product, List<ProductRequest.ImageDto> imageDtos) {
        if (imageDtos == null) return;
        if (imageDtos.size() > 3) {
            throw new IllegalArgumentException("A product can have a maximum of 3 alternative images");
        }
        for (int i = 0; i < imageDtos.size(); i++) {
            ProductRequest.ImageDto dto = imageDtos.get(i);
            if (dto.getImageUrl() != null && !dto.getImageUrl().trim().isEmpty()) {
                ProductImage img = new ProductImage();
                img.setProduct(product);
                img.setImageUrl(dto.getImageUrl().trim());
                img.setDisplayOrder(dto.getDisplayOrder() != null ? dto.getDisplayOrder() : i + 1);
                img.setAltText(dto.getAltText());
                product.getImages().add(img);
            }
        }
    }

    private void applyProductHighlights(Product product, List<ProductRequest.HighlightDto> highlightDtos) {
        if (highlightDtos == null) return;
        for (int i = 0; i < highlightDtos.size(); i++) {
            ProductRequest.HighlightDto dto = highlightDtos.get(i);
            if (dto.getHighlightText() != null && !dto.getHighlightText().trim().isEmpty()) {
                ProductHighlight ph = new ProductHighlight();
                ph.setProduct(product);
                ph.setHighlightText(dto.getHighlightText().trim());
                ph.setDisplayOrder(dto.getDisplayOrder() != null ? dto.getDisplayOrder() : i + 1);
                product.getHighlights().add(ph);
            }
        }
    }

    private void applyProductVariants(Product product, List<ProductRequest.VariantDto> variantDtos) {
        if (variantDtos == null) return;
        for (int i = 0; i < variantDtos.size(); i++) {
            ProductRequest.VariantDto vDto = variantDtos.get(i);
            com.cakeplatform.api.modules.product.ProductVariant variant = new com.cakeplatform.api.modules.product.ProductVariant();
            variant.setName(vDto.getName().trim());
            variant.setPrice(vDto.getPrice());
            variant.setOriginalPrice(vDto.getOriginalPrice());
            variant.setImageUrl(vDto.getImageUrl());
            variant.setDescription(vDto.getDescription());
            variant.setDisplayOrder(vDto.getDisplayOrder() != null ? vDto.getDisplayOrder() : i + 1);
            variant.setVariantType(vDto.getVariantType() != null ? vDto.getVariantType() : "FLAVOUR");
            variant.setIsAvailable(vDto.getIsAvailable() != null ? vDto.getIsAvailable() : true);
            variant.setProduct(product);
            product.getVariants().add(variant);
        }
    }

    private void applyProductAddons(Product product, List<ProductRequest.AddonDto> addonDtos) {
        if (addonDtos == null) return;
        for (ProductRequest.AddonDto aDto : addonDtos) {
            com.cakeplatform.api.modules.product.ProductAddon addon = new com.cakeplatform.api.modules.product.ProductAddon();
            addon.setName(aDto.getName().trim());
            addon.setPrice(aDto.getPrice());
            addon.setIsAvailable(aDto.getIsAvailable() != null ? aDto.getIsAvailable() : true);
            addon.setProduct(product);
            product.getAddons().add(addon);
        }
    }

    @Transactional
    public void deleteProduct(Long productId, Long userId) {
        Shop shop = getShopByOwnerId(userId);

        Product product = productRepository.findByIdAndShopId(productId, shop.getId())
                .orElseThrow(() -> new RuntimeException("Product not found or unauthorized"));

        productRepository.delete(product);
        if (storefrontCacheService != null) {
            storefrontCacheService.evictShopProducts(shop.getId());
        }
        activityLogger.logActivity(userId, shop.getId(), "PRODUCT_DELETED", "PRODUCT", productId, "Name: " + product.getName());
    }
}
