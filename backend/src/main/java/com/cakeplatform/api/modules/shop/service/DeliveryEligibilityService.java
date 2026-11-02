package com.cakeplatform.api.modules.shop.service;

import com.cakeplatform.api.modules.location.dto.GeocodeResultDTO;
import com.cakeplatform.api.modules.location.service.GeocodingService;
import com.cakeplatform.api.modules.shop.Shop;
import com.cakeplatform.api.modules.shop.ShopDeliveryConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Reusable server-side delivery eligibility evaluation service.
 * Enforces configured maximum delivery radius and serviceable PIN codes.
 * Hardened in Phase 2.1.1 to prevent client-side coordinate and PIN code spoofing.
 */
@Service
@Slf4j
public class DeliveryEligibilityService {

    public static final Pattern PINCODE_PATTERN = Pattern.compile("^[1-9][0-9]{5}$");
    public static final Pattern ADDRESS_PINCODE_EXTRACTOR = Pattern.compile("\\b([1-9][0-9]{5})\\b");

    /**
     * Default maximum allowable distance tolerance between client-submitted coordinates
     * and authoritative server-geocoded coordinates (500 meters = 0.5 km).
     */
    public static final double DEFAULT_COORDINATE_TOLERANCE_KM = 0.5;

    private final GeocodingService geocodingService;
    private final double coordinateToleranceKm;

    @Autowired
    public DeliveryEligibilityService(@Autowired(required = false) GeocodingService geocodingService) {
        this(geocodingService, DEFAULT_COORDINATE_TOLERANCE_KM);
    }

    public DeliveryEligibilityService(GeocodingService geocodingService, double coordinateToleranceKm) {
        this.geocodingService = geocodingService;
        this.coordinateToleranceKm = coordinateToleranceKm > 0 ? coordinateToleranceKm : DEFAULT_COORDINATE_TOLERANCE_KM;
    }

    public double getCoordinateToleranceKm() {
        return coordinateToleranceKm;
    }

    public record DeliveryEligibilityResult(
            boolean eligible,
            String rejectionReason,
            Double calculatedDistanceKm,
            Double maxAllowedRadiusKm,
            boolean pincodeRestricted,
            boolean radiusRestricted
    ) {
        public static DeliveryEligibilityResult allowed(Double distanceKm, Double maxRadiusKm) {
            return new DeliveryEligibilityResult(true, null, distanceKm, maxRadiusKm, false, false);
        }

        public static DeliveryEligibilityResult denied(String reason, Double distanceKm, Double maxRadiusKm) {
            return new DeliveryEligibilityResult(false, reason, distanceKm, maxRadiusKm, false, false);
        }
    }

    /**
     * Authoritative geodesic distance calculation (Spherical Law of Cosines / Haversine)
     * Identical formula to native PostgreSQL query in ShopRepository.
     */
    public static double calculateHaversineDistanceKm(double lat1, double lng1, double lat2, double lng2) {
        double rLat1 = Math.toRadians(lat1);
        double rLat2 = Math.toRadians(lat2);
        double rDeltaLng = Math.toRadians(lng2 - lng1);

        double cosSum = Math.cos(rLat1) * Math.cos(rLat2) * Math.cos(rDeltaLng) + Math.sin(rLat1) * Math.sin(rLat2);
        double clamped = Math.min(1.0, Math.max(-1.0, cosSum));
        return 6371.0 * Math.acos(clamped);
    }

    /**
     * Extracts all unique Indian 6-digit PIN codes from unstructured address text.
     */
    public static List<String> extractAllPincodes(String text) {
        if (text == null || text.isBlank()) {
            return Collections.emptyList();
        }
        Matcher matcher = ADDRESS_PINCODE_EXTRACTOR.matcher(text);
        Set<String> uniquePins = new LinkedHashSet<>();
        while (matcher.find()) {
            uniquePins.add(matcher.group(1));
        }
        return new ArrayList<>(uniquePins);
    }

    /**
     * Extracts an Indian 6-digit PIN code from unstructured address text.
     * Returns null if no PIN code or multiple conflicting PIN codes are present.
     */
    public static String extractPincode(String text) {
        List<String> pins = extractAllPincodes(text);
        return pins.size() == 1 ? pins.get(0) : null;
    }

    /**
     * Validates and sanitizes a comma/whitespace-separated PIN code list.
     * Ensures every entry is a valid 6-digit Indian PIN code.
     */
    public static String sanitizePincodes(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String[] tokens = raw.split("[,;\\s\\n]+");
        Set<String> validPins = new TreeSet<>();
        for (String token : tokens) {
            String trimmed = token.trim();
            if (trimmed.isEmpty()) continue;
            if (!PINCODE_PATTERN.matcher(trimmed).matches()) {
                throw new IllegalArgumentException("Invalid PIN code: '" + trimmed + "'. Each PIN code must be a 6-digit number starting with 1-9.");
            }
            validPins.add(trimmed);
        }
        return validPins.isEmpty() ? null : String.join(", ", validPins);
    }

    /**
     * Parses stored serviceable PIN codes into a Set for O(1) lookups.
     */
    public static Set<String> parsePincodes(String serviceablePincodes) {
        if (serviceablePincodes == null || serviceablePincodes.isBlank()) {
            return Collections.emptySet();
        }
        return Arrays.stream(serviceablePincodes.split("[,;\\s\\n]+"))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toSet());
    }

    /**
     * Evaluates delivery eligibility for a customer order or quotation.
     * Enforces server-authoritative coordinate verification and PIN code reconciliation.
     */
    public DeliveryEligibilityResult evaluateEligibility(
            Shop shop,
            ShopDeliveryConfig deliveryConfig,
            String fulfillmentMethod,
            String deliveryAddress,
            String deliveryPincode,
            Double deliveryLat,
            Double deliveryLng
    ) {
        boolean isSelfPickup = fulfillmentMethod != null && (
                "SELF_PICKUP".equalsIgnoreCase(fulfillmentMethod)
                || "STORE_PICKUP".equalsIgnoreCase(fulfillmentMethod)
                || "PICKUP".equalsIgnoreCase(fulfillmentMethod)
        );

        // Store pickup is ALWAYS allowed regardless of radius or pincode restrictions
        if (isSelfPickup) {
            return DeliveryEligibilityResult.allowed(null, null);
        }

        // 1. Check if home delivery is enabled
        boolean deliveryEnabled = deliveryConfig != null && !Boolean.FALSE.equals(deliveryConfig.getDeliveryEnabled());
        if (!deliveryEnabled) {
            return DeliveryEligibilityResult.denied(
                    "Home delivery is currently unavailable. You can choose store pickup if available.",
                    null, null
            );
        }

        // 2. Validate delivery address presence
        if (deliveryAddress == null || deliveryAddress.trim().isEmpty()) {
            return DeliveryEligibilityResult.denied(
                    "Please provide a valid delivery location to check availability.",
                    null, null
            );
        }

        // 3. P1 Hardening: Strict PIN Code Extraction & Reconciliation
        List<String> addressPins = extractAllPincodes(deliveryAddress);
        if (addressPins.size() > 1) {
            return DeliveryEligibilityResult.denied(
                    "The delivery address contains conflicting or ambiguous PIN codes. Please provide a clear delivery address.",
                    null, null
            );
        }

        String addressPin = !addressPins.isEmpty() ? addressPins.get(0) : null;
        String submittedPin = null;

        if (deliveryPincode != null && !deliveryPincode.isBlank()) {
            submittedPin = deliveryPincode.trim();
            if (!PINCODE_PATTERN.matcher(submittedPin).matches()) {
                return DeliveryEligibilityResult.denied(
                        "Invalid delivery PIN code format. Please provide a valid 6-digit PIN code.",
                        null, null
                );
            }
        }

        // Reconcile Address PIN vs Submitted PIN
        String destinationPin = null;
        if (addressPin != null && submittedPin != null) {
            if (!addressPin.equals(submittedPin)) {
                return DeliveryEligibilityResult.denied(
                        "The delivery address PIN code (" + addressPin + ") does not match the submitted PIN code (" + submittedPin + ").",
                        null, null
                );
            }
            destinationPin = addressPin;
        } else if (addressPin != null) {
            destinationPin = addressPin;
        } else if (submittedPin != null) {
            destinationPin = submittedPin;
        }

        // 4. Evaluate Serviceable PIN Codes (if configured)
        if (deliveryConfig != null && deliveryConfig.getServiceablePincodes() != null && !deliveryConfig.getServiceablePincodes().isBlank()) {
            Set<String> serviceableSet = parsePincodes(deliveryConfig.getServiceablePincodes());
            if (!serviceableSet.isEmpty()) {
                if (destinationPin == null || destinationPin.isBlank()) {
                    return DeliveryEligibilityResult.denied(
                            "Please provide a valid delivery location to check availability.",
                            null, null
                    );
                }

                if (!serviceableSet.contains(destinationPin)) {
                    return DeliveryEligibilityResult.denied(
                            "This pincode is not currently serviceable.",
                            null, null
                    );
                }
            }
        }

        // 5. P0 Hardening: Server-Authoritative Radius & Coordinate Reconciliation
        if (deliveryConfig != null && deliveryConfig.getMaxDeliveryRadiusKm() != null && deliveryConfig.getMaxDeliveryRadiusKm() > 0) {
            double maxRadius = deliveryConfig.getMaxDeliveryRadiusKm();

            // Shop coordinates are required to evaluate distance
            if (shop.getLatitude() == null || shop.getLongitude() == null) {
                log.warn("Shop {} has maxDeliveryRadiusKm set to {} km but shop coordinates are null. Skipping radius check.",
                        shop.getId(), maxRadius);
                return DeliveryEligibilityResult.allowed(null, maxRadius);
            }

            // Server must establish destination location using trusted server-side address resolution
            if (geocodingService == null) {
                log.warn("Radius check required for shop {} but GeocodingService is unavailable.", shop.getId());
                return DeliveryEligibilityResult.denied(
                        "Please provide a valid delivery location to check availability.",
                        null, maxRadius
                );
            }

            GeocodeResultDTO serverGeocode = geocodingService.geocodeDetailed(
                    deliveryAddress, null, null, shop.getCity(), shop.getDistrict(), shop.getState(), destinationPin, deliveryAddress
            );

            if (serverGeocode == null || !serverGeocode.isFound()
                    || serverGeocode.getLatitude() == null || serverGeocode.getLongitude() == null
                    || !isValidCoordinates(serverGeocode.getLatitude(), serverGeocode.getLongitude())) {
                return DeliveryEligibilityResult.denied(
                        "Please provide a valid delivery location to check availability.",
                        null, maxRadius
                );
            }

            Double serverLat = serverGeocode.getLatitude();
            Double serverLng = serverGeocode.getLongitude();

            // Client-provided coordinates must never independently establish delivery eligibility.
            // If coordinates are supplied, compare them against server-resolved address coordinates.
            boolean clientCoordsSupplied = deliveryLat != null && deliveryLng != null;
            if (clientCoordsSupplied) {
                if (!isValidCoordinates(deliveryLat, deliveryLng)) {
                    return DeliveryEligibilityResult.denied(
                            "Please provide a valid delivery location to check availability.",
                            null, maxRadius
                    );
                }

                double discrepancyKm = calculateHaversineDistanceKm(serverLat, serverLng, deliveryLat, deliveryLng);
                if (discrepancyKm > coordinateToleranceKm) {
                    log.warn("Coordinate spoofing / discrepancy detected for shop {}: discrepancy={} km (tolerance={} km)",
                            shop.getId(), discrepancyKm, coordinateToleranceKm);
                    return DeliveryEligibilityResult.denied(
                            "Submitted location coordinates do not match the delivery address location.",
                            discrepancyKm, maxRadius
                    );
                }
            }

            // Calculate authoritative distance using server-resolved location
            double distanceKm = calculateHaversineDistanceKm(
                    shop.getLatitude(), shop.getLongitude(), serverLat, serverLng
            );

            // Precision round to 2 decimals
            distanceKm = Math.round(distanceKm * 100.0) / 100.0;

            if (distanceKm > maxRadius) {
                return DeliveryEligibilityResult.denied(
                        "This address is outside this bakery's delivery area.",
                        distanceKm, maxRadius
                );
            }

            return DeliveryEligibilityResult.allowed(distanceKm, maxRadius);
        }

        // All configured restrictions satisfied or legacy unrestricted shop
        return DeliveryEligibilityResult.allowed(null, null);
    }

    public static boolean isValidCoordinates(Double lat, Double lng) {
        if (lat == null || lng == null) return false;
        if (Double.isNaN(lat) || Double.isNaN(lng) || Double.isInfinite(lat) || Double.isInfinite(lng)) return false;
        if (Math.abs(lat) < 0.000001 && Math.abs(lng) < 0.000001) return false;
        return lat >= -90.0 && lat <= 90.0 && lng >= -180.0 && lng <= 180.0;
    }
}
