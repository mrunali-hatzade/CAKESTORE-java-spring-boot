package com.cakeplatform.api.modules.location.service;

import java.util.Optional;

/**
 * Service for validating coordinates and geocoding addresses to genuine geographic coordinates.
 */
public interface GeocodingService {

    record Coordinates(double latitude, double longitude) {}

    /**
     * Validates if the given coordinates are mathematically and geographically valid.
     * Latitude must be between -90.0 and 90.0.
     * Longitude must be between -180.0 and 180.0.
     */
    default boolean isValidCoordinates(Double latitude, Double longitude) {
        if (latitude == null || longitude == null) {
            return false;
        }
        if (Double.isNaN(latitude) || Double.isInfinite(latitude) ||
            Double.isNaN(longitude) || Double.isInfinite(longitude)) {
            return false;
        }
        if (Math.abs(latitude) < 0.000001 && Math.abs(longitude) < 0.000001) {
            return false;
        }
        return latitude >= -90.0 && latitude <= 90.0 &&
               longitude >= -180.0 && longitude <= 180.0;
    }

    /**
     * Attempts to geocode a structured address to geographic coordinates.
     * Returns Optional.empty() if geocoding fails, times out, or cannot resolve the address.
     * MUST NEVER return fabricated or default city-center/Akurdi coordinates!
     */
    Optional<Coordinates> geocodeAddress(
            String addressLine1,
            String addressLine2,
            String area,
            String city,
            String district,
            String state,
            String pincode
    );

    /**
     * Performs detailed geocoding distinguishing exact addresses from approximate PIN-code centroids.
     */
    default com.cakeplatform.api.modules.location.dto.GeocodeResultDTO geocodeDetailed(
            String addressLine1,
            String addressLine2,
            String area,
            String city,
            String district,
            String state,
            String pincode,
            String query
    ) {
        Optional<Coordinates> coords = geocodeAddress(addressLine1, addressLine2, area, city, district, state, pincode);
        if (coords.isPresent()) {
            return com.cakeplatform.api.modules.location.dto.GeocodeResultDTO.builder()
                    .found(true)
                    .latitude(coords.get().latitude())
                    .longitude(coords.get().longitude())
                    .approximate(false)
                    .accuracyType("PRECISE_ADDRESS")
                    .provider("GEOCODER")
                    .build();
        }
        return com.cakeplatform.api.modules.location.dto.GeocodeResultDTO.builder()
                .found(false)
                .accuracyType("NOT_FOUND")
                .provider("NONE")
                .build();
    }
}

