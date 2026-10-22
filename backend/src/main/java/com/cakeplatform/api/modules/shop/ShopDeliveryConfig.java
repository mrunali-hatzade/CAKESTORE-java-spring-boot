package com.cakeplatform.api.modules.shop;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "shop_delivery_configs")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ShopDeliveryConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shop_id", nullable = false, unique = true)
    private Shop shop;

    @Column(name = "delivery_enabled", nullable = false)
    @Builder.Default
    private Boolean deliveryEnabled = true;

    @Column(name = "delivery_charge_type", nullable = false, length = 50)
    @Builder.Default
    private String deliveryChargeType = "FIXED"; // 'FREE' or 'FIXED'

    @Column(name = "fixed_charge_amount", nullable = false)
    @Builder.Default
    private BigDecimal fixedChargeAmount = BigDecimal.valueOf(50.00);

    @Column(name = "min_order_for_free_delivery")
    private BigDecimal minOrderForFreeDelivery;

    @Column(name = "delivery_notes", columnDefinition = "TEXT")
    private String deliveryNotes;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
