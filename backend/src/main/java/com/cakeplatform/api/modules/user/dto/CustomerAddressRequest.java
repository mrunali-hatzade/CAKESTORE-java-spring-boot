package com.cakeplatform.api.modules.user.dto;

import com.cakeplatform.api.modules.user.AddressType;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class CustomerAddressRequest {

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

    @Pattern(regexp = "^$|^[1-9][0-9]{5}$", message = "PIN code must be a valid 6-digit Indian PIN code")
    private String pincode;

    private AddressType addressType;

    private String deliveryAddress;

    private boolean isDefault;

    public boolean isDefault() {
        return isDefault;
    }

    public void setIsDefault(boolean isDefault) {
        this.isDefault = isDefault;
    }

    @JsonProperty("default")
    public void setDefaultAlias(boolean def) {
        this.isDefault = def;
    }

    @JsonProperty("default")
    public boolean getDefaultAlias() {
        return this.isDefault;
    }

    private Double latitude;

    private Double longitude;

    /**
     * Resolves effective full name.
     */
    public String getEffectiveName() {
        if (fullName != null && !fullName.isBlank()) {
            return fullName.trim();
        }
        if (recipientName != null && !recipientName.isBlank()) {
            return recipientName.trim();
        }
        return null;
    }

    /**
     * Resolves effective mobile number.
     */
    public String getEffectivePhone() {
        if (mobileNumber != null && !mobileNumber.isBlank()) {
            return mobileNumber.trim();
        }
        if (recipientPhone != null && !recipientPhone.isBlank()) {
            return recipientPhone.trim();
        }
        return null;
    }

    /**
     * Resolves effective address line 1.
     */
    public String getEffectiveAddressLine1() {
        if (addressLine1 != null && !addressLine1.isBlank()) {
            return addressLine1.trim();
        }
        if (deliveryAddress != null && !deliveryAddress.isBlank()) {
            return deliveryAddress.trim();
        }
        return null;
    }

    /**
     * Resolves effective address type.
     */
    public AddressType getEffectiveAddressType() {
        if (addressType != null) {
            return addressType;
        }
        if (label != null && !label.isBlank()) {
            String upper = label.trim().toUpperCase();
            if (upper.contains("WORK") || upper.contains("OFFICE")) return AddressType.WORK;
            if (upper.contains("OTHER")) return AddressType.OTHER;
            return AddressType.HOME;
        }
        return AddressType.HOME;
    }
}
