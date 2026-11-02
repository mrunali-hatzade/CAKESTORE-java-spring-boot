package com.cakeplatform.api.modules.location.service;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

public class GeocodingLoggingSecurityTest {

    private Logger nominatimLogger;
    private ListAppender<ILoggingEvent> listAppender;
    private NominatimGeocodingService geocodingService;

    @BeforeEach
    void setUp() {
        nominatimLogger = (Logger) LoggerFactory.getLogger(NominatimGeocodingService.class);
        listAppender = new ListAppender<>();
        listAppender.start();
        nominatimLogger.addAppender(listAppender);

        RestTemplate stubRestTemplate = new RestTemplate() {
            @Override
            @SuppressWarnings("unchecked")
            public <T> ResponseEntity<T> exchange(String url, HttpMethod method, org.springframework.http.HttpEntity<?> requestEntity, Class<T> responseType, Object... uriVariables) {
                // Return dummy response
                Map<String, Object> item = Map.of("lat", "18.5204", "lon", "73.8567", "display_name", "Pune, Maharashtra");
                return new ResponseEntity<>((T) List.of(item), HttpStatus.OK);
            }
        };

        geocodingService = new NominatimGeocodingService(null, stubRestTemplate);
    }

    @AfterEach
    void tearDown() {
        nominatimLogger.detachAppender(listAppender);
        listAppender.stop();
    }

    @Test
    @DisplayName("SEC-LOG-1: Full delivery address must not appear in captured application logs at INFO/WARN")
    void testFullAddressNotLoggedAtInfoOrWarn() {
        String sensitiveStreetAddress = "Flat 902, Tower B, Secret Luxury Residency, MG Road";
        String city = "Pune";
        String state = "Maharashtra";
        String pincode = "411001";

        geocodingService.geocodeAddress(sensitiveStreetAddress, "Apt 4", "Camp", city, null, state, pincode);

        for (ILoggingEvent event : listAppender.list) {
            if (event.getLevel().isGreaterOrEqual(Level.INFO)) {
                String formatted = event.getFormattedMessage();
                assertFalse(formatted.contains(sensitiveStreetAddress),
                        "Log message must NEVER contain sensitive customer street address: " + formatted);
                assertFalse(formatted.contains("Tower B"),
                        "Log message must not contain building / apartment details: " + formatted);
            }
        }
    }

    @Test
    @DisplayName("SEC-LOG-2: Customer phone and email must never appear in geocoding diagnostics")
    void testCustomerPhoneAndEmailNeverAppearInDiagnostics() {
        String queryWithPii = "Deliver to Aditi 9876543210 aditi.sharma@example.com, Akurdi 411035";

        geocodingService.geocodeDetailed(null, null, null, null, null, null, "411035", queryWithPii);

        for (ILoggingEvent event : listAppender.list) {
            String formatted = event.getFormattedMessage();
            assertFalse(formatted.contains("9876543210"), "Customer mobile number must never appear in geocoding logs: " + formatted);
            assertFalse(formatted.contains("aditi.sharma@example.com"), "Customer email must never appear in geocoding logs: " + formatted);
        }
    }
}

