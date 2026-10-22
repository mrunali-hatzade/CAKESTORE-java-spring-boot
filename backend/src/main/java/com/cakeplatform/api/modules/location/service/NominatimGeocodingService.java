package com.cakeplatform.api.modules.location.service;

import com.cakeplatform.api.modules.location.entity.LocationLocality;
import com.cakeplatform.api.modules.location.repository.LocationLocalityRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@Slf4j
public class NominatimGeocodingService implements GeocodingService {

    private final LocationLocalityRepository localityRepository;
    private final RestTemplate restTemplate;

    @Value("${app.geocoding.enabled:true}")
    private boolean enabled;

    @Value("${app.geocoding.endpoint:https://nominatim.openstreetmap.org/search}")
    private String endpoint;

    @Value("${app.geocoding.user-agent:CakeStore-Platform/1.0}")
    private String userAgent;

    @Autowired
    public NominatimGeocodingService(
            @Autowired(required = false) LocationLocalityRepository localityRepository,
            RestTemplateBuilder restTemplateBuilder,
            @Value("${app.geocoding.timeout-ms:3000}") int timeoutMs
    ) {
        this.localityRepository = localityRepository;
        this.restTemplate = restTemplateBuilder
                .setConnectTimeout(Duration.ofMillis(timeoutMs))
                .setReadTimeout(Duration.ofMillis(timeoutMs))
                .build();
    }

    public NominatimGeocodingService(LocationLocalityRepository localityRepository, RestTemplate restTemplate) {
        this.localityRepository = localityRepository;
        this.restTemplate = restTemplate;
        this.enabled = true;
        this.endpoint = "https://nominatim.openstreetmap.org/search";
        this.userAgent = "CakeStore-Platform/1.0";
    }

    @Override
    public boolean isValidCoordinates(Double latitude, Double longitude) {
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

    @Override
    public Optional<Coordinates> geocodeAddress(
            String addressLine1,
            String addressLine2,
            String area,
            String city,
            String district,
            String state,
            String pincode
    ) {
        // Step 1: Check high-precision local database locality catalog first if available
        if (localityRepository != null && pincode != null && !pincode.isBlank()) {
            try {
                List<LocationLocality> localLocalities = localityRepository.findByPincode(pincode.trim());
                if (area != null && !area.isBlank()) {
                    String cleanArea = area.trim().toLowerCase();
                    for (LocationLocality loc : localLocalities) {
                        if (loc.getName() != null && loc.getName().toLowerCase().contains(cleanArea)) {
                            if (isValidCoordinates(loc.getLatitude(), loc.getLongitude())) {
                                log.debug("Resolved coordinates from local locality catalog for area '{}': {}, {}",
                                        area, loc.getLatitude(), loc.getLongitude());
                                return Optional.of(new Coordinates(loc.getLatitude(), loc.getLongitude()));
                            }
                        }
                    }
                }
            } catch (Exception e) {
                log.debug("Local locality lookup skipped due to: {}", e.getMessage());
            }
        }

        // Step 2: If external geocoding is disabled, exit safely without assigning fake coordinates
        if (!enabled) {
            return Optional.empty();
        }

        // Step 3: Construct structured address query for external provider
        StringBuilder queryBuilder = new StringBuilder();
        if (addressLine1 != null && !addressLine1.isBlank()) {
            queryBuilder.append(addressLine1.trim()).append(", ");
        }
        if (area != null && !area.isBlank()) {
            queryBuilder.append(area.trim()).append(", ");
        }
        if (city != null && !city.isBlank()) {
            queryBuilder.append(city.trim()).append(", ");
        }
        if (pincode != null && !pincode.isBlank()) {
            queryBuilder.append(pincode.trim()).append(", ");
        }
        if (state != null && !state.isBlank()) {
            queryBuilder.append(state.trim()).append(", ");
        }
        queryBuilder.append("India");

        String fullAddressQuery = queryBuilder.toString();

        try {
            String url = UriComponentsBuilder.fromHttpUrl(endpoint)
                    .queryParam("format", "json")
                    .queryParam("limit", 1)
                    .queryParam("q", fullAddressQuery)
                    .toUriString();

            HttpHeaders headers = new HttpHeaders();
            headers.set("User-Agent", userAgent);
            HttpEntity<?> entity = new HttpEntity<>(headers);

            ResponseEntity<List> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    entity,
                    List.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null && !response.getBody().isEmpty()) {
                Object first = response.getBody().get(0);
                if (first instanceof Map<?, ?> map) {
                    Object latObj = map.get("lat");
                    Object lonObj = map.get("lon");
                    if (latObj != null && lonObj != null) {
                        double lat = Double.parseDouble(latObj.toString());
                        double lon = Double.parseDouble(lonObj.toString());
                        if (isValidCoordinates(lat, lon)) {
                            log.info("Geocoded address '{}' to [{}, {}]", fullAddressQuery, lat, lon);
                            return Optional.of(new Coordinates(lat, lon));
                        }
                    }
                }
            }
        } catch (Exception e) {
            // Geocoding failure should never crash the application or fall back to fake/Akurdi coordinates
            log.warn("External geocoding failed for '{}': {}", fullAddressQuery, e.getMessage());
        }

        return Optional.empty();
    }

    @Override
    public com.cakeplatform.api.modules.location.dto.GeocodeResultDTO geocodeDetailed(
            String addressLine1,
            String addressLine2,
            String area,
            String city,
            String district,
            String state,
            String pincode,
            String query
    ) {
        // 1. If explicit query is provided (e.g. from interactive map search bar)
        if (query != null && !query.isBlank()) {
            String cleanQuery = query.trim();
            // Check if query is or contains a 6-digit Indian PIN code
            java.util.regex.Matcher pinMatcher = java.util.regex.Pattern.compile("\\b[1-9][0-9]{5}\\b").matcher(cleanQuery);
            if (pinMatcher.find() && localityRepository != null) {
                String foundPin = pinMatcher.group();
                try {
                    List<LocationLocality> localities = localityRepository.findByPincode(foundPin);
                    if (!localities.isEmpty()) {
                        LocationLocality loc = localities.get(0);
                        if (isValidCoordinates(loc.getLatitude(), loc.getLongitude())) {
                            return com.cakeplatform.api.modules.location.dto.GeocodeResultDTO.builder()
                                    .found(true)
                                    .latitude(loc.getLatitude())
                                    .longitude(loc.getLongitude())
                                    .displayName(loc.getName() + ", PIN " + foundPin)
                                    .approximate(true)
                                    .accuracyType("APPROXIMATE_PINCODE")
                                    .provider("LOCAL_PINCODE")
                                    .build();
                        }
                    }
                } catch (Exception ignored) {}
            }

            // Query Nominatim for the search query
            if (enabled) {
                try {
                    String url = UriComponentsBuilder.fromHttpUrl(endpoint)
                            .queryParam("format", "json")
                            .queryParam("limit", 1)
                            .queryParam("q", cleanQuery)
                            .toUriString();

                    HttpHeaders headers = new HttpHeaders();
                    headers.set("User-Agent", userAgent);
                    HttpEntity<?> entity = new HttpEntity<>(headers);

                    ResponseEntity<List> response = restTemplate.exchange(url, HttpMethod.GET, entity, List.class);
                    if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null && !response.getBody().isEmpty()) {
                        Object first = response.getBody().get(0);
                        if (first instanceof Map<?, ?> map) {
                            Object latObj = map.get("lat");
                            Object lonObj = map.get("lon");
                            String displayName = map.get("display_name") != null ? map.get("display_name").toString() : cleanQuery;
                            String type = map.get("type") != null ? map.get("type").toString().toLowerCase() : "";
                            String clazz = map.get("class") != null ? map.get("class").toString().toLowerCase() : "";

                            if (latObj != null && lonObj != null) {
                                double lat = Double.parseDouble(latObj.toString());
                                double lon = Double.parseDouble(lonObj.toString());
                                if (isValidCoordinates(lat, lon)) {
                                    boolean isApprox = type.contains("postcode") || clazz.contains("boundary") || type.contains("administrative");
                                    return com.cakeplatform.api.modules.location.dto.GeocodeResultDTO.builder()
                                            .found(true)
                                            .latitude(lat)
                                            .longitude(lon)
                                            .displayName(displayName)
                                            .approximate(isApprox)
                                            .accuracyType(isApprox ? "APPROXIMATE_PINCODE" : "PRECISE_ADDRESS")
                                            .provider("NOMINATIM")
                                            .build();
                                }
                            }
                        }
                    }
                } catch (Exception e) {
                    log.warn("Nominatim query failed for '{}': {}", cleanQuery, e.getMessage());
                }
            }
        }

        // 2. Try structured address fields
        // Check local repository with pincode & area
        if (localityRepository != null && pincode != null && !pincode.isBlank()) {
            try {
                List<LocationLocality> localLocalities = localityRepository.findByPincode(pincode.trim());
                if (area != null && !area.isBlank()) {
                    String cleanArea = area.trim().toLowerCase();
                    for (LocationLocality loc : localLocalities) {
                        if (loc.getName() != null && loc.getName().toLowerCase().contains(cleanArea)) {
                            if (isValidCoordinates(loc.getLatitude(), loc.getLongitude())) {
                                return com.cakeplatform.api.modules.location.dto.GeocodeResultDTO.builder()
                                        .found(true)
                                        .latitude(loc.getLatitude())
                                        .longitude(loc.getLongitude())
                                        .displayName(loc.getName() + ", " + pincode)
                                        .approximate(true)
                                        .accuracyType("APPROXIMATE_PINCODE")
                                        .provider("LOCAL_PINCODE")
                                        .build();
                            }
                        }
                    }
                }
            } catch (Exception ignored) {}
        }

        // Try Nominatim with structured query
        Optional<Coordinates> nominatimCoords = geocodeAddress(addressLine1, addressLine2, area, city, district, state, pincode);
        if (nominatimCoords.isPresent()) {
            return com.cakeplatform.api.modules.location.dto.GeocodeResultDTO.builder()
                    .found(true)
                    .latitude(nominatimCoords.get().latitude())
                    .longitude(nominatimCoords.get().longitude())
                    .displayName(String.join(", ", java.util.Arrays.asList(addressLine1, area, city, pincode).stream().filter(s -> s != null && !s.isBlank()).toList()))
                    .approximate(false)
                    .accuracyType("PRECISE_ADDRESS")
                    .provider("NOMINATIM")
                    .build();
        }

        // Fallback to local pincode centroid if available
        if (localityRepository != null && pincode != null && !pincode.isBlank()) {
            try {
                List<LocationLocality> localLocalities = localityRepository.findByPincode(pincode.trim());
                if (!localLocalities.isEmpty()) {
                    LocationLocality loc = localLocalities.get(0);
                    if (isValidCoordinates(loc.getLatitude(), loc.getLongitude())) {
                        return com.cakeplatform.api.modules.location.dto.GeocodeResultDTO.builder()
                                .found(true)
                                .latitude(loc.getLatitude())
                                .longitude(loc.getLongitude())
                                .displayName(loc.getName() + " Area, " + pincode)
                                .approximate(true)
                                .accuracyType("APPROXIMATE_PINCODE")
                                .provider("LOCAL_PINCODE")
                                .build();
                    }
                }
            } catch (Exception ignored) {}
        }

        return com.cakeplatform.api.modules.location.dto.GeocodeResultDTO.builder()
                .found(false)
                .accuracyType("NOT_FOUND")
                .provider("NONE")
                .build();
    }
}

