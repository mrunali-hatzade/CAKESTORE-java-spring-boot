package com.cakeplatform.api.modules.user.dto;

import com.cakeplatform.api.modules.user.AddressType;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class CustomerAddressResponse {
    private Long id;
    private String label;
    private String recipientName;
    private String fullName;
    private String recipientPhone;
    private String mobileNumber;
    private String addressLine1;
    private String addressLine2;
    private String landmark;
    private String city;
    private String state;
    private String pincode;
    private AddressType addressType;
    private String deliveryAddress;
    private String formattedAddress;

    private boolean isDefault;

    public boolean isDefault() {
        return isDefault;
    }

    public void setIsDefault(boolean isDefault) {
        this.isDefault = isDefault;
    }

    public void setDefault(boolean isDefault) {
        this.isDefault = isDefault;
    }

    @JsonProperty("default")
    public boolean getDefaultAlias() {
        return isDefault;
    }

    @JsonProperty("default")
    public void setDefaultAlias(boolean def) {
        this.isDefault = def;
    }

    private Double latitude;
    private Double longitude;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
