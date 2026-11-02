package com.cakeplatform.api.modules.product;

import com.cakeplatform.api.modules.shop.Shop;
import jakarta.persistence.*;
import lombok.Data;
import com.fasterxml.jackson.annotation.JsonIgnore;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "products")
@Data
@org.hibernate.annotations.SQLDelete(sql = "UPDATE products SET is_deleted = true WHERE id=?")
@org.hibernate.annotations.SQLRestriction("is_deleted=false")
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "is_deleted", nullable = false)
    private boolean isDeleted = false;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shop_id", nullable = false)
    private Shop shop;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private ProductCategory category;

    @Column(nullable = false)
    private String name;

    private String description;

    @Column(columnDefinition = "TEXT")
    private String ingredients;

    @Column(columnDefinition = "TEXT")
    private String allergens;

    @Column(nullable = false)
    private BigDecimal price;

    @Column(name = "original_price")
    private BigDecimal originalPrice;

    @Column(name = "allow_egg_choice", nullable = false)
    private Boolean allowEggChoice = false;

    @Column(name = "egg_preference_default")
    private String eggPreferenceDefault = "EGGLESS";

    @Column(name = "eggless_price_diff")
    private BigDecimal egglessPriceDiff = BigDecimal.ZERO;

    @Column(name = "is_eggless", nullable = false)
    private Boolean isEggless = false;

    @Column(name = "is_vegan", nullable = false)
    private Boolean isVegan = false;

    @Column(name = "is_gluten_free", nullable = false)
    private Boolean isGlutenFree = false;

    @Column(name = "image_url")
    private String imageUrl;

    @Column(nullable = false)
    private Boolean availability = true;

    @Column(nullable = false)
    private String status = "ACTIVE";

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("displayOrder ASC, createdAt ASC")
    private List<ProductImage> images = new ArrayList<>();

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("displayOrder ASC, createdAt ASC")
    private List<ProductHighlight> highlights = new ArrayList<>();

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("displayOrder ASC, id ASC")
    private List<ProductVariant> variants = new ArrayList<>();

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ProductAddon> addons = new ArrayList<>();

    @Transient
    @com.fasterxml.jackson.annotation.JsonProperty("categoryId")
    public Long getCategoryId() {
        return category != null ? category.getId() : null;
    }

    @Transient
    @com.fasterxml.jackson.annotation.JsonProperty("categoryName")
    public String getCategoryName() {
        return category != null ? category.getName() : null;
    }

    @Transient
    @com.fasterxml.jackson.annotation.JsonProperty("shopId")
    public Long getShopId() {
        return shop != null ? shop.getId() : null;
    }
}
