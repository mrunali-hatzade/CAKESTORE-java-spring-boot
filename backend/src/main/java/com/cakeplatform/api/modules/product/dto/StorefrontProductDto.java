package com.cakeplatform.api.modules.product.dto;

import com.cakeplatform.api.modules.product.ProductHighlight;
import com.cakeplatform.api.modules.product.ProductImage;
import com.cakeplatform.api.modules.product.ProductVariant;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class StorefrontProductDto {
    private Long id;
    private Long shopId;
    private Long categoryId;
    private String categoryName;
    private String name;
    private String description;
    private String ingredients;
    private String allergens;
    private BigDecimal price;
    private BigDecimal originalPrice;
    private Boolean allowEggChoice;
    private String eggPreferenceDefault;
    private BigDecimal egglessPriceDiff;
    private Boolean isEggless;
    private Boolean isVegan;
    private Boolean isGlutenFree;
    private String imageUrl;
    private Boolean availability;
    private String status;

    private Double averageRating;
    private Long reviewCount;

    private List<ProductImage> images;
    private List<ProductHighlight> highlights;
    private List<ProductVariant> variants;
}
