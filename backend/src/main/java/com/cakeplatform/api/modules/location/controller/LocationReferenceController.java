package com.cakeplatform.api.modules.location.controller;

import com.cakeplatform.api.modules.location.dto.*;
import com.cakeplatform.api.modules.location.service.GeocodingService;
import com.cakeplatform.api.modules.location.service.LocationService;
import com.cakeplatform.api.modules.location.service.LocationValidationService;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@RestController
public class LocationReferenceController {

    private final LocationService locationService;
    private final LocationValidationService validationService;
    private final GeocodingService geocodingService;

    // Backward-compatible constructor for existing tests
    public LocationReferenceController(LocationService locationService, LocationValidationService validationService) {
        this(locationService, validationService, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public LocationReferenceController(
            LocationService locationService,
            LocationValidationService validationService,
            @org.springframework.beans.factory.annotation.Autowired(required = false) GeocodingService geocodingService
    ) {
        this.locationService = locationService;
        this.validationService = validationService;
        this.geocodingService = geocodingService;
    }

    @GetMapping({"/api/locations/readiness", "/api/customer/storefront/locations/readiness"})
    public ResponseEntity<LocationReadinessDTO> getReadiness() {
        return ResponseEntity.ok(locationService.getReadiness());
    }

    @GetMapping({"/api/locations/countries", "/api/customer/storefront/locations/countries"})
    public ResponseEntity<List<LocationCountryDTO>> getCountries() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(24, TimeUnit.HOURS).cachePublic())
                .body(locationService.getCountries());
    }

    @GetMapping({"/api/locations/states", "/api/customer/storefront/locations/states"})
    public ResponseEntity<List<LocationStateDTO>> getStates(@RequestParam(required = false, defaultValue = "IND") String countryCode) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(24, TimeUnit.HOURS).cachePublic())
                .body(locationService.getStates(countryCode));
    }

    @GetMapping({"/api/locations/districts", "/api/customer/storefront/locations/districts"})
    public ResponseEntity<List<LocationDistrictDTO>> getDistricts(@RequestParam Integer stateId) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(24, TimeUnit.HOURS).cachePublic())
                .body(locationService.getDistricts(stateId));
    }

    @GetMapping({"/api/locations/cities", "/api/customer/storefront/locations/cities"})
    public ResponseEntity<List<LocationCityDTO>> getCities(@RequestParam Integer districtId) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(24, TimeUnit.HOURS).cachePublic())
                .body(locationService.getCities(districtId));
    }

    @GetMapping({"/api/locations/localities", "/api/customer/storefront/locations/localities"})
    public ResponseEntity<List<LocationLocalityDTO>> getLocalities(@RequestParam Integer cityId) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(24, TimeUnit.HOURS).cachePublic())
                .body(locationService.getLocalities(cityId));
    }

    @GetMapping({"/api/locations/pincodes", "/api/customer/storefront/locations/pincodes"})
    public ResponseEntity<List<String>> getPincodes(
            @RequestParam(required = false) Integer districtId,
            @RequestParam(required = false) Integer localityId) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(24, TimeUnit.HOURS).cachePublic())
                .body(locationService.getPincodes(districtId, localityId));
    }

    @GetMapping({"/api/locations/pincodes/{pincode}", "/api/customer/storefront/locations/pincodes/{pincode}"})
    public ResponseEntity<PincodeLookupResponseDTO> lookupPincode(@PathVariable String pincode) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(24, TimeUnit.HOURS).cachePublic())
                .body(locationService.lookupPincode(pincode));
    }

    @PostMapping({"/api/locations/validate", "/api/customer/storefront/locations/validate"})
    public ResponseEntity<Map<String, Object>> validateLocation(@RequestBody LocationValidationDTO request) {
        validationService.validateLocation(request);
        return ResponseEntity.ok(Map.of("status", 200, "valid", true, "message", "Location hierarchy is valid."));
    }

    @GetMapping({"/api/locations/geocode", "/api/customer/storefront/locations/geocode"})
    public ResponseEntity<GeocodeResultDTO> geocodeLocation(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String addressLine1,
            @RequestParam(required = false) String addressLine2,
            @RequestParam(required = false) String area,
            @RequestParam(required = false) String city,
            @RequestParam(required = false) String district,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String pincode
    ) {
        if (geocodingService == null) {
            return ResponseEntity.ok(GeocodeResultDTO.builder()
                    .found(false)
                    .accuracyType("NOT_FOUND")
                    .provider("NONE")
                    .build());
        }
        return ResponseEntity.ok(geocodingService.geocodeDetailed(
                addressLine1, addressLine2, area, city, district, state, pincode, q
        ));
    }
}

