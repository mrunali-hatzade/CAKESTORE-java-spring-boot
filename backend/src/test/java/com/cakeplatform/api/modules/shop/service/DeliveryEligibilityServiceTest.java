package com.cakeplatform.api.modules.shop.service;

import com.cakeplatform.api.modules.location.dto.GeocodeResultDTO;
import com.cakeplatform.api.modules.location.service.GeocodingService;
import com.cakeplatform.api.modules.shop.Shop;
import com.cakeplatform.api.modules.shop.ShopDeliveryConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Phase 2.1.1 Hardened Test Suite for DeliveryEligibilityService.
 * Covers Coordinate Spoofing (P0), PIN Code Spoofing (P1), Fallbacks, and Business Regressions.
 */
public class DeliveryEligibilityServiceTest {

    private StubGeocodingService geocodingService;
    private DeliveryEligibilityService eligibilityService;

    private Shop shop;
    private ShopDeliveryConfig deliveryConfig;

    // Bakery in Akurdi, Pune (18.6499, 73.7707, Pincode 411035)
    private static final double SHOP_LAT = 18.6499;
    private static final double SHOP_LNG = 73.7707;
    private static final String SHOP_PIN = "411035";

    public static class StubGeocodingService implements GeocodingService {
        public boolean shouldFind = true;
        public Double foundLat;
        public Double foundLng;

        @Override
        public Optional<Coordinates> geocodeAddress(String addressLine1, String addressLine2, String area, String city, String district, String state, String pincode) {
            GeocodeResultDTO dto = geocodeDetailed(addressLine1, addressLine2, area, city, district, state, pincode, null);
            if (dto.isFound() && dto.getLatitude() != null && dto.getLongitude() != null) {
                return Optional.of(new Coordinates(dto.getLatitude(), dto.getLongitude()));
            }
            return Optional.empty();
        }

        @Override
        public GeocodeResultDTO geocodeDetailed(String addressLine1, String addressLine2, String area, String city, String district, String state, String pincode, String query) {
            if (!shouldFind) {
                return GeocodeResultDTO.builder().found(false).accuracyType("NOT_FOUND").provider("STUB").build();
            }
            if (foundLat != null && foundLng != null) {
                return GeocodeResultDTO.builder()
                        .found(true)
                        .latitude(foundLat)
                        .longitude(foundLng)
                        .accuracyType("PRECISE_ADDRESS")
                        .provider("STUB")
                        .build();
            }
            String combined = ((addressLine1 != null ? addressLine1 : "") + " " + (query != null ? query : "")).toLowerCase();
            if (combined.contains("delhi") || "110001".equals(pincode)) {
                return GeocodeResultDTO.builder().found(true).latitude(28.6139).longitude(77.2090).provider("STUB").build();
            }
            if (combined.contains("chinchwad") || "411033".equals(pincode)) {
                return GeocodeResultDTO.builder().found(true).latitude(18.6279).longitude(73.7831).provider("STUB").build();
            }
            if (combined.contains("camp") || "411001".equals(pincode)) {
                return GeocodeResultDTO.builder().found(true).latitude(18.5158).longitude(73.8794).provider("STUB").build();
            }
            if (combined.contains("akurdi") || "411035".equals(pincode)) {
                return GeocodeResultDTO.builder().found(true).latitude(18.6480).longitude(73.7710).provider("STUB").build();
            }
            if (combined.contains("deccan") || combined.contains("fc road") || "411004".equals(pincode)) {
                return GeocodeResultDTO.builder().found(true).latitude(18.5167).longitude(73.8415).provider("STUB").build();
            }
            if (combined.contains("lonavala")) {
                return GeocodeResultDTO.builder().found(true).latitude(18.7500).longitude(73.4000).provider("STUB").build();
            }
            if (combined.contains("remote") || combined.contains("unresolvable")) {
                return GeocodeResultDTO.builder().found(false).build();
            }
            // Default Pune location
            return GeocodeResultDTO.builder().found(true).latitude(18.5204).longitude(73.8567).provider("STUB").build();
        }
    }

    @BeforeEach
    void setUp() {
        geocodingService = new StubGeocodingService();
        eligibilityService = new DeliveryEligibilityService(geocodingService);

        shop = new Shop();
        shop.setId(101L);
        shop.setBusinessName("Crumb & Crust Artisan Bakery");
        shop.setLatitude(SHOP_LAT);
        shop.setLongitude(SHOP_LNG);
        shop.setPincode(SHOP_PIN);
        shop.setCity("Pune");
        shop.setState("Maharashtra");

        deliveryConfig = ShopDeliveryConfig.builder()
                .shop(shop)
                .deliveryEnabled(true)
                .deliveryChargeType("FIXED")
                .fixedChargeAmount(BigDecimal.valueOf(50.00))
                .minOrderForFreeDelivery(BigDecimal.valueOf(1000.00))
                .maxDeliveryRadiusKm(10.0) // 10 km operational zone
                .serviceablePincodes("411033, 411035, 411019")
                .build();
    }

    // ==========================================
    // P0: Coordinate Spoofing Tests (1 to 8)
    // ==========================================

    @Test
    @DisplayName("P0-1: Delhi address with Pune coordinates is rejected as coordinate spoofing")
    void testDelhiAddressWithPuneCoordinatesRejected() {
        // Attacker enters Delhi address but submits Akurdi bakery doorstep coordinates
        String address = "Connaught Place, Central Delhi, 110001";
        double fakeLat = 18.6480;
        double fakeLng = 73.7710;

        var result = eligibilityService.evaluateEligibility(
                shop, deliveryConfig, "HOME_DELIVERY", address, "110001", fakeLat, fakeLng
        );

        assertFalse(result.eligible(), "Coordinate spoofing must be rejected");
        // Reconciled: Delhi coordinates (~28.61, 77.20) diverge by ~1170 km from fake Pune coords (tolerance = 0.5 km)
        assertTrue(result.rejectionReason().contains("do not match the delivery address location")
                || result.rejectionReason().contains("outside this bakery's delivery area")
                || result.rejectionReason().contains("not currently serviceable"));
    }

    @Test
    @DisplayName("P0-2: Pune address with Delhi coordinates is rejected as coordinate spoofing")
    void testPuneAddressWithDelhiCoordinatesRejected() {
        // Customer address in Akurdi Pune, but submits coordinates in Delhi
        String address = "Station Road, Akurdi, 411035";
        double fakeLat = 28.6139;
        double fakeLng = 77.2090;

        var result = eligibilityService.evaluateEligibility(
                shop, deliveryConfig, "HOME_DELIVERY", address, "411035", fakeLat, fakeLng
        );

        assertFalse(result.eligible());
        assertEquals("Submitted location coordinates do not match the delivery address location.", result.rejectionReason());
    }

    @Test
    @DisplayName("P0-3: Correct address with matching coordinates within radius is accepted")
    void testCorrectAddressWithMatchingCoordinatesAccepted() {
        // Chinchwad (18.6279, 73.7831) ~2.78 km from Akurdi shop
        String address = "Flat 402, Royal Residency, Chinchwad, 411033";
        double clientLat = 18.6279;
        double clientLng = 73.7831;

        var result = eligibilityService.evaluateEligibility(
                shop, deliveryConfig, "HOME_DELIVERY", address, "411033", clientLat, clientLng
        );

        assertTrue(result.eligible());
        assertNull(result.rejectionReason());
        assertNotNull(result.calculatedDistanceKm());
        assertTrue(result.calculatedDistanceKm() <= 10.0);
    }

    @Test
    @DisplayName("P0-4: Coordinates missing: Server authoritatively resolves address and approves if within radius")
    void testCoordinatesMissingServerResolves() {
        // Client sends null coords for Chinchwad
        String address = "Flat 402, Royal Residency, Chinchwad, 411033";

        var result = eligibilityService.evaluateEligibility(
                shop, deliveryConfig, "HOME_DELIVERY", address, "411033", null, null
        );

        assertTrue(result.eligible());
        assertNull(result.rejectionReason());
        assertNotNull(result.calculatedDistanceKm());
        assertTrue(result.calculatedDistanceKm() <= 10.0);
    }

    @Test
    @DisplayName("P0-5: Invalid latitude and longitude rejected safely")
    void testInvalidLatitudeLongitudeRejected() {
        String address = "Station Road, Akurdi, 411035";

        var result = eligibilityService.evaluateEligibility(
                shop, deliveryConfig, "HOME_DELIVERY", address, "411035", 999.0, 999.0
        );

        assertFalse(result.eligible());
        assertEquals("Please provide a valid delivery location to check availability.", result.rejectionReason());
    }

    @Test
    @DisplayName("P0-6: Address geocoding failure safely rejects radius-restricted delivery")
    void testGeocodingFailureSafelyRejects() {
        geocodingService.shouldFind = false;

        var result = eligibilityService.evaluateEligibility(
                shop, deliveryConfig, "HOME_DELIVERY", "Unresolvable remote alleyway, 411035", "411035", null, null
        );

        assertFalse(result.eligible());
        assertEquals("Please provide a valid delivery location to check availability.", result.rejectionReason());
    }

    @Test
    @DisplayName("P0-7: Client coordinates differing by more than 500 meters are rejected")
    void testCoordinatesDifferingMoreThanToleranceRejected() {
        // Server resolves Chinchwad to (18.6279, 73.7831)
        // Client submits (18.6380, 73.7831) (~1.12 km discrepancy > 0.5 km tolerance)
        String address = "Flat 402, Royal Residency, Chinchwad, 411033";
        double clientLat = 18.6380;
        double clientLng = 73.7831;

        var result = eligibilityService.evaluateEligibility(
                shop, deliveryConfig, "HOME_DELIVERY", address, "411033", clientLat, clientLng
        );

        assertFalse(result.eligible());
        assertEquals("Submitted location coordinates do not match the delivery address location.", result.rejectionReason());
    }

    @Test
    @DisplayName("P0-8: Client coordinates within accepted 500m tolerance are accepted")
    void testCoordinatesWithinToleranceAccepted() {
        // Server resolves Chinchwad to (18.6279, 73.7831)
        // Client submits (18.6290, 73.7831) (~122 meters discrepancy <= 0.5 km tolerance)
        String address = "Flat 402, Royal Residency, Chinchwad, 411033";
        double clientLat = 18.6290;
        double clientLng = 73.7831;

        var result = eligibilityService.evaluateEligibility(
                shop, deliveryConfig, "HOME_DELIVERY", address, "411033", clientLat, clientLng
        );

        assertTrue(result.eligible());
        assertNull(result.rejectionReason());
    }

    // ==========================================
    // P1: PIN Code Spoofing Tests (9 to 14)
    // ==========================================

    @Test
    @DisplayName("P1-9: Address PIN and submitted PIN match: Continues validation")
    void testAddressPinAndSubmittedPinMatch() {
        String address = "Station Road, Akurdi, 411035";

        var result = eligibilityService.evaluateEligibility(
                shop, deliveryConfig, "HOME_DELIVERY", address, "411035", 18.6480, 73.7710
        );

        assertTrue(result.eligible());
    }

    @Test
    @DisplayName("P1-10: Address PIN and submitted PIN mismatch: Strictly rejected")
    void testAddressPinAndSubmittedPinMismatchRejected() {
        // Address has Delhi PIN 110001, but customer submitted Pune PIN 411035
        String address = "Connaught Place, New Delhi 110001";

        var result = eligibilityService.evaluateEligibility(
                shop, deliveryConfig, "HOME_DELIVERY", address, "411035", 18.6480, 73.7710
        );

        assertFalse(result.eligible());
        assertEquals("The delivery address PIN code (110001) does not match the submitted PIN code (411035).", result.rejectionReason());
    }

    @Test
    @DisplayName("P1-11: Whitelisted submitted PIN with non-whitelisted address PIN is rejected")
    void testWhitelistedSubmittedPinWithNonWhitelistedAddressPinRejected() {
        // Address is in 411001 (not whitelisted), submitted PIN is 411033 (whitelisted)
        String address = "Camp, Pune 411001";

        var result = eligibilityService.evaluateEligibility(
                shop, deliveryConfig, "HOME_DELIVERY", address, "411033", 18.6279, 73.7831
        );

        assertFalse(result.eligible());
        assertEquals("The delivery address PIN code (411001) does not match the submitted PIN code (411033).", result.rejectionReason());
    }

    @Test
    @DisplayName("P1-12: Missing address PIN: Uses submitted valid PIN for verification")
    void testMissingAddressPinUsesSubmittedPin() {
        // Address text has no PIN, but submitted PIN is 411033
        String address = "Flat 402, Royal Residency, Chinchwad";

        var result = eligibilityService.evaluateEligibility(
                shop, deliveryConfig, "HOME_DELIVERY", address, "411033", 18.6279, 73.7831
        );

        assertTrue(result.eligible());
    }

    @Test
    @DisplayName("P1-13: Invalid PIN format is rejected")
    void testInvalidPincodeFormatRejected() {
        String address = "Station Road, Akurdi";

        var result = eligibilityService.evaluateEligibility(
                shop, deliveryConfig, "HOME_DELIVERY", address, "INVALID", 18.6480, 73.7710
        );

        assertFalse(result.eligible());
        assertEquals("Invalid delivery PIN code format. Please provide a valid 6-digit PIN code.", result.rejectionReason());
    }

    @Test
    @DisplayName("P1-14: Address containing ambiguous PIN values is rejected")
    void testAmbiguousPincodesInAddressRejected() {
        // Address contains two conflicting PIN codes
        String address = "Near Akurdi 411035 and Chinchwad 411033";

        var result = eligibilityService.evaluateEligibility(
                shop, deliveryConfig, "HOME_DELIVERY", address, "411035", 18.6480, 73.7710
        );

        assertFalse(result.eligible());
        assertEquals("The delivery address contains conflicting or ambiguous PIN codes. Please provide a clear delivery address.", result.rejectionReason());
    }

    // ==========================================
    // Business & Security Regressions (15 to 22)
    // ==========================================

    @Test
    @DisplayName("REG-15: Store pickup outside delivery zone is completely permitted")
    void testPickupOutsideDeliveryZonePermitted() {
        // 50 km away
        var result = eligibilityService.evaluateEligibility(
                shop, deliveryConfig, "SELF_PICKUP", "Far away location in Delhi 110001", "110001", 28.6139, 77.2090
        );

        assertTrue(result.eligible(), "Self-pickup must never be blocked by delivery geofence");
        assertNull(result.rejectionReason());
    }

    @Test
    @DisplayName("REG-16: Existing unrestricted shop permits delivery without geofence")
    void testLegacyShopUnrestricted() {
        ShopDeliveryConfig legacyConfig = ShopDeliveryConfig.builder()
                .shop(shop)
                .deliveryEnabled(true)
                .deliveryChargeType("FIXED")
                .fixedChargeAmount(BigDecimal.valueOf(50.00))
                .maxDeliveryRadiusKm(null) // unrestricted
                .serviceablePincodes(null) // all pincodes
                .build();

        var result = eligibilityService.evaluateEligibility(
                shop, legacyConfig, "HOME_DELIVERY", "Any city address, 400001", "400001", 19.0760, 72.8777
        );

        assertTrue(result.eligible(), "Legacy shops without configured zones must remain unrestricted");
        assertNull(result.rejectionReason());
    }

    @Test
    @DisplayName("REG-17: Radius-restricted shop with unverifiable destination safely fails")
    void testUnverifiableDestinationSafelyFails() {
        geocodingService.shouldFind = false;

        var result = eligibilityService.evaluateEligibility(
                shop, deliveryConfig, "HOME_DELIVERY", "Remote unmapped hill, 411035", "411035", null, null
        );

        assertFalse(result.eligible());
        assertEquals("Please provide a valid delivery location to check availability.", result.rejectionReason());
    }

    @Test
    @DisplayName("REG-18: Customer outside radius is rejected even with serviceable pincode")
    void testOutsideRadiusRejectedEvenWithServiceablePincode() {
        // 411035 is in whitelist, but location is 21 km away (outside 10 km radius)
        String address = "Far Outpost, Camp, 411035";
        geocodingService.foundLat = 18.5158;
        geocodingService.foundLng = 73.8794;

        var result = eligibilityService.evaluateEligibility(
                shop, deliveryConfig, "HOME_DELIVERY", address, "411035", 18.5158, 73.8794
        );

        assertFalse(result.eligible());
        assertEquals("This address is outside this bakery's delivery area.", result.rejectionReason());
    }

    @Test
    @DisplayName("REG-19: Non-serviceable pincode is rejected even if coordinates are close")
    void testNonServiceablePincodeRejected() {
        // 411001 is NOT in {411033, 411035, 411019}
        String address = "Nana Peth, 411001";

        var result = eligibilityService.evaluateEligibility(
                shop, deliveryConfig, "HOME_DELIVERY", address, "411001", 18.6480, 73.7710
        );

        assertFalse(result.eligible());
        assertEquals("This pincode is not currently serviceable.", result.rejectionReason());
    }

    @Test
    @DisplayName("REG-20: Home delivery master switch disabled blocks all delivery orders")
    void testDeliveryDisabled() {
        deliveryConfig.setDeliveryEnabled(false);

        var result = eligibilityService.evaluateEligibility(
                shop, deliveryConfig, "HOME_DELIVERY", "Station Road, 411035", "411035", 18.6480, 73.7710
        );

        assertFalse(result.eligible());
        assertEquals("Home delivery is currently unavailable. You can choose store pickup if available.", result.rejectionReason());
    }

    @Test
    @DisplayName("REG-21: Pincode extraction from unstructured text correctly parses single code")
    void testPincodeExtraction() {
        assertEquals("411035", DeliveryEligibilityService.extractPincode("Flat 201, Akurdi Railway Station Road, Pune 411035, Maharashtra"));
        assertEquals("560001", DeliveryEligibilityService.extractPincode("Bengaluru Urban, Karnataka - 560001. Landmark near Metro"));
        assertNull(DeliveryEligibilityService.extractPincode("No pincode provided in this address text"));
        // Ambiguous returns null via extractPincode
        assertNull(DeliveryEligibilityService.extractPincode("Ambiguous 411035 and 411033"));
    }

    @Test
    @DisplayName("REG-22: Pincode sanitization and validation ensures clean whitelist")
    void testSanitizePincodes() {
        String sanitized = DeliveryEligibilityService.sanitizePincodes("411035, 411033; 411019   411035");
        assertEquals("411019, 411033, 411035", sanitized);

        assertThrows(IllegalArgumentException.class, () ->
                DeliveryEligibilityService.sanitizePincodes("411035, INVALID, 12345")
        );
    }
}
