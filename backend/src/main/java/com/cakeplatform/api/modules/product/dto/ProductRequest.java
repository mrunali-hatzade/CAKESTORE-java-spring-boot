package com.cakeplatform.api.modules.product.dto;

import lombok.Data;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.List;

@Data
public class ProductRequest {
    @NotBlank
    private String name;
    
    private String description;
    private String ingredients;
    private String allergens;
    
    @NotNull
    private BigDecimal price;

    private BigDecimal originalPrice;
    
    private String imageUrl;
    
    private Boolean availability = true;
    
    private Long categoryId;

    private Boolean allowEggChoice = false;
    private String eggPreferenceDefault = "EGGLESS";
    private BigDecimal egglessPriceDiff = BigDecimal.ZERO;
    private Boolean isEggless;
    private Boolean isVegan;
    private Boolean isGlutenFree;
    
    private List<ImageDto> images;
    private List<HighlightDto> highlights;
    private List<VariantDto> variants;
    private List<AddonDto> addons;

    @Data
    public static class ImageDto {
        private Long id;
        @NotBlank private String imageUrl;
        private Integer displayOrder = 0;
        private String altText;
    }

    @Data
    public static class HighlightDto {
        private Long id;
        @NotBlank private String highlightText;
        private Integer displayOrder = 0;
    }

    @Data
    public static class VariantDto {
        private Long id;
        @NotBlank private String name;
        @NotNull private BigDecimal price;
        private BigDecimal originalPrice;
        private String imageUrl;
        private String description;
        private Integer displayOrder = 0;
        private String variantType = "FLAVOUR";
        private Boolean isAvailable = true;
    }

    @Data
    public static class AddonDto {
        private Long id;
        @NotBlank private String name;
        @NotNull private BigDecimal price;
        private Boolean isAvailable = true;
    }
}
