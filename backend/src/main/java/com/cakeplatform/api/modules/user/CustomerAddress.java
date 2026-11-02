package com.cakeplatform.api.modules.user;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "customer_addresses")
@Data
public class CustomerAddress {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User customer;

    @Column(nullable = false, length = 50)
    private String label;

    @Column(name = "recipient_name", nullable = false)
    private String recipientName;

    @Column(name = "recipient_phone", nullable = false, length = 50)
    private String recipientPhone;

    @Column(name = "delivery_address", nullable = false, columnDefinition = "TEXT")
    private String deliveryAddress;

    @Column(name = "address_line_1")
    private String addressLine1;

    @Column(name = "address_line_2")
    private String addressLine2;

    @Column(name = "landmark")
    private String landmark;

    @Column(name = "city", length = 100)
    private String city;

    @Column(name = "state", length = 100)
    private String state;

    @Column(name = "pincode", length = 10)
    private String pincode;

    @Enumerated(EnumType.STRING)
    @Column(name = "address_type", length = 20)
    private AddressType addressType = AddressType.HOME;

    @Column(name = "latitude")
    private Double latitude;

    @Column(name = "longitude")
    private Double longitude;

    @Column(name = "is_default", nullable = false)
    private boolean isDefault = false;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    // Helper aliases for naming flexibility
    public String getFullName() {
        return recipientName;
    }

    public void setFullName(String fullName) {
        this.recipientName = fullName;
    }

    public String getMobileNumber() {
        return recipientPhone;
    }

    public void setMobileNumber(String mobileNumber) {
        this.recipientPhone = mobileNumber;
    }

    /**
     * Composes a canonical, human-readable address from structured fields.
     */
    public String getFormattedAddress() {
        StringBuilder sb = new StringBuilder();
        if (addressLine1 != null && !addressLine1.isBlank()) {
            sb.append(addressLine1.trim());
        }
        if (addressLine2 != null && !addressLine2.isBlank()) {
            if (!sb.isEmpty()) sb.append(", ");
            sb.append(addressLine2.trim());
        }
        if (landmark != null && !landmark.isBlank()) {
            if (!sb.isEmpty()) sb.append(", Near ").append(landmark.trim());
        }
        if (city != null && !city.isBlank()) {
            if (!sb.isEmpty()) sb.append(", ").append(city.trim());
        }
        if (state != null && !state.isBlank()) {
            if (!sb.isEmpty()) sb.append(", ").append(state.trim());
        }
        if (pincode != null && !pincode.isBlank()) {
            if (!sb.isEmpty()) sb.append(" - ").append(pincode.trim());
        }
        if (sb.isEmpty()) {
            return deliveryAddress != null ? deliveryAddress : "";
        }
        return sb.toString();
    }

    /**
     * Synchronizes unstructured fields from structured inputs for backward compatibility.
     */
    public void syncFormattedAddress() {
        String formatted = getFormattedAddress();
        if (!formatted.isBlank()) {
            this.deliveryAddress = formatted;
        }
        if (this.label == null || this.label.isBlank()) {
            this.label = (this.addressType != null) ? this.addressType.name() : AddressType.HOME.name();
        }
        if (this.addressLine1 == null && this.deliveryAddress != null) {
            this.addressLine1 = this.deliveryAddress;
        }
    }
}
