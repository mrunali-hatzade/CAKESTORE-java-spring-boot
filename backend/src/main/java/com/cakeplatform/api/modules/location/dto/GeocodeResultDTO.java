package com.cakeplatform.api.modules.location.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO for address geocoding and place search responses.
 * Clearly distinguishes precise addresses from approximate postal area / pincode centroids.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GeocodeResultDTO {
    private boolean found;
    private Double latitude;
    private Double longitude;
    private String displayName;
    private boolean approximate;
    
    /**
     * Accuracy classification:
     * - "PRECISE_ADDRESS": Building, street, or rooftop resolved by Nominatim
     * - "APPROXIMATE_PINCODE": Post-office centroid or PIN-code area centroid
     * - "NOT_FOUND": Could not resolve coordinates
     */
    private String accuracyType;

    /**
     * Data provider: "NOMINATIM", "LOCAL_PINCODE", "NONE"
     */
    private String provider;
}
