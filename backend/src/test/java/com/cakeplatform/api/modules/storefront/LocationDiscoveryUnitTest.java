package com.cakeplatform.api.modules.storefront;

import com.cakeplatform.api.modules.auth.dto.RegisterRequest;
import com.cakeplatform.api.modules.auth.service.AuthService;
import com.cakeplatform.api.modules.location.controller.LocationReferenceController;
import com.cakeplatform.api.modules.location.dto.GeocodeResultDTO;
import com.cakeplatform.api.modules.location.entity.LocationLocality;
import com.cakeplatform.api.modules.location.exception.InvalidLocationException;
import com.cakeplatform.api.modules.location.repository.LocationLocalityRepository;
import com.cakeplatform.api.modules.location.service.GeocodingService;
import com.cakeplatform.api.modules.location.service.NominatimGeocodingService;
import com.cakeplatform.api.modules.media.StorageService;
import com.cakeplatform.api.modules.notification.AdminNotificationService;
import com.cakeplatform.api.modules.shop.Shop;
import com.cakeplatform.api.modules.shop.ShopRepository;
import com.cakeplatform.api.modules.shop.ShopStatus;
import com.cakeplatform.api.modules.shop.dto.UpdateShopRequest;
import com.cakeplatform.api.modules.shop.BusinessDocumentRepository;
import com.cakeplatform.api.modules.shop.service.ShopService;
import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.modules.user.UserRepository;
import com.cakeplatform.api.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

public class LocationDiscoveryUnitTest {

    @Nested
    @DisplayName("CustomerStorefrontController Parameter Validation Tests")
    class ControllerValidationTests {

        private CustomerStorefrontService service;
        private CustomerStorefrontController controller;

        @BeforeEach
        void setUp() {
            service = mock(CustomerStorefrontService.class);
            controller = new CustomerStorefrontController(service);
        }

        @Test
        @DisplayName("Valid coordinates and radius pass validation")
        void testValidCoordinatesAndRadius() {
            assertDoesNotThrow(() ->
                controller.searchShops(
                    null, null, null, null, null, null,
                    null, null, null,
                    18.5204, 73.8567, 15.0, "distance", 0, 20
                )
            );
        }

        @Test
        @DisplayName("Latitude > 90 is rejected with IllegalArgumentException")
        void testLatitudeTooHigh() {
            IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                controller.searchShops(
                    null, null, null, null, null, null,
                    null, null, null,
                    90.1, 73.8567, 10.0, "distance", 0, 20
                )
            );
            assertTrue(ex.getMessage().contains("Latitude must be between -90 and 90 degrees"));
        }

        @Test
        @DisplayName("Latitude < -90 is rejected with IllegalArgumentException")
        void testLatitudeTooLow() {
            IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                controller.searchShops(
                    null, null, null, null, null, null,
                    null, null, null,
                    -90.5, 73.8567, 10.0, "distance", 0, 20
                )
            );
            assertTrue(ex.getMessage().contains("Latitude must be between -90 and 90 degrees"));
        }

        @Test
        @DisplayName("Longitude > 180 is rejected with IllegalArgumentException")
        void testLongitudeTooHigh() {
            IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                controller.searchShops(
                    null, null, null, null, null, null,
                    null, null, null,
                    18.5204, 180.5, 10.0, "distance", 0, 20
                )
            );
            assertTrue(ex.getMessage().contains("Longitude must be between -180 and 180 degrees"));
        }

        @Test
        @DisplayName("Longitude < -180 is rejected with IllegalArgumentException")
        void testLongitudeTooLow() {
            IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                controller.searchShops(
                    null, null, null, null, null, null,
                    null, null, null,
                    18.5204, -181.0, 10.0, "distance", 0, 20
                )
            );
            assertTrue(ex.getMessage().contains("Longitude must be between -180 and 180 degrees"));
        }

        @Test
        @DisplayName("Latitude present without Longitude is rejected with IllegalArgumentException")
        void testLatitudeWithoutLongitude() {
            IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                controller.searchShops(
                    null, null, null, null, null, null,
                    null, null, null,
                    18.5204, null, 10.0, "distance", 0, 20
                )
            );
            assertTrue(ex.getMessage().contains("Both latitude and longitude are required for nearby search"));
        }

        @Test
        @DisplayName("Longitude present without Latitude is rejected with IllegalArgumentException")
        void testLongitudeWithoutLatitude() {
            IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                controller.searchShops(
                    null, null, null, null, null, null,
                    null, null, null,
                    null, 73.8567, 10.0, "distance", 0, 20
                )
            );
            assertTrue(ex.getMessage().contains("Both latitude and longitude are required for nearby search"));
        }

        @Test
        @DisplayName("Radius <= 0 is rejected with IllegalArgumentException")
        void testRadiusZeroOrNegative() {
            IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                controller.searchShops(
                    null, null, null, null, null, null,
                    null, null, null,
                    18.5204, 73.8567, 0.0, "distance", 0, 20
                )
            );
            assertTrue(ex.getMessage().contains("Radius must be a positive number up to 100 km"));
        }

        @Test
        @DisplayName("Radius > 100 km is rejected with IllegalArgumentException")
        void testRadiusTooLarge() {
            IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                controller.searchShops(
                    null, null, null, null, null, null,
                    null, null, null,
                    18.5204, 73.8567, 101.0, "distance", 0, 20
                )
            );
            assertTrue(ex.getMessage().contains("Radius must be a positive number up to 100 km"));
        }

        @Test
        @DisplayName("Page size <= 0 is rejected with IllegalArgumentException")
        void testPageSizeZeroOrNegative() {
            IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                controller.searchShops(
                    null, null, null, null, null, null,
                    null, null, null,
                    null, null, null, "rating", 0, 0
                )
            );
            assertTrue(ex.getMessage().contains("Page size must be greater than zero"));
        }
    }

    @Nested
    @DisplayName("Geocoding Service Validation & Coordinate Safety")
    class GeocodingSafetyTests {

        private LocationLocalityRepository localityRepository;
        private RestTemplate restTemplate;
        private NominatimGeocodingService geocodingService;

        @BeforeEach
        void setUp() {
            localityRepository = mock(LocationLocalityRepository.class);
            restTemplate = mock(RestTemplate.class);
            geocodingService = new NominatimGeocodingService(localityRepository, restTemplate);
        }

        @Test
        @DisplayName("Valid coordinates pass isValidCoordinates check")
        void testValidCoordinates() {
            assertTrue(geocodingService.isValidCoordinates(18.5204, 73.8567));
            assertTrue(geocodingService.isValidCoordinates(-33.8688, 151.2093));
            assertTrue(geocodingService.isValidCoordinates(51.5074, -0.1278));
        }

        @Test
        @DisplayName("Null, NaN, and (0,0) coordinates are rejected")
        void testInvalidCoordinates() {
            assertFalse(geocodingService.isValidCoordinates(null, 73.8567));
            assertFalse(geocodingService.isValidCoordinates(18.5204, null));
            assertFalse(geocodingService.isValidCoordinates(0.0, 0.0));
            assertFalse(geocodingService.isValidCoordinates(91.0, 73.8567));
            assertFalse(geocodingService.isValidCoordinates(-91.0, 73.8567));
            assertFalse(geocodingService.isValidCoordinates(18.5204, 181.0));
            assertFalse(geocodingService.isValidCoordinates(18.5204, -181.0));
            assertFalse(geocodingService.isValidCoordinates(Double.NaN, 73.8567));
        }

        @Test
        @DisplayName("When Nominatim fails and no locality match, geocoding returns empty Optional without fabricating coordinates")
        void testNoFabricatedCoordinatesOnFailure() {
            when(localityRepository.findByPincode(any())).thenReturn(java.util.Collections.emptyList());
            when(restTemplate.getForEntity(anyString(), any())).thenThrow(new RuntimeException("Connection timed out"));

            Optional<GeocodingService.Coordinates> result = geocodingService.geocodeAddress(
                "Flat 101", "Baker Street", "Kothrud", "Pune", "Pune", "Maharashtra", "411038"
            );

            assertTrue(result.isEmpty(), "Geocoding failure must never fabricate coordinates (e.g. Akurdi)");
        }
    }

    @Nested
    @DisplayName("Shop Location Updates & Validation")
    class ShopLocationUpdateTests {

        private ShopRepository shopRepository;
        private GeocodingService geocodingService;
        private ShopService shopService;
        private Shop testShop;

        @BeforeEach
        void setUp() {
            shopRepository = mock(ShopRepository.class);
            geocodingService = mock(GeocodingService.class);
            when(geocodingService.isValidCoordinates(anyDouble(), anyDouble())).thenCallRealMethod();

            shopService = new ShopService(shopRepository);
            shopService.setGeocodingService(geocodingService);

            testShop = new Shop();
            testShop.setId(1L);
            testShop.setBusinessName("Sweet Delight");
            testShop.setStatus(ShopStatus.ACTIVE);
            testShop.setCity("Pune");
            testShop.setState("Maharashtra");
            testShop.setPincode("411001");
            testShop.setLatitude(18.5204);
            testShop.setLongitude(73.8567);

            when(shopRepository.findFirstByOwnerId(10L)).thenReturn(Optional.of(testShop));
            when(shopRepository.save(any(Shop.class))).thenAnswer(i -> i.getArgument(0));
        }

        @Test
        @DisplayName("Owner can correct coordinates with valid lat/long")
        void testOwnerCanUpdateCoordinates() {
            UpdateShopRequest request = new UpdateShopRequest();
            request.setLatitude(18.6279);
            request.setLongitude(73.8131);

            shopService.updateMyShopProfile(10L, request);

            assertEquals(18.6279, testShop.getLatitude());
            assertEquals(73.8131, testShop.getLongitude());
        }

        @Test
        @DisplayName("Invalid latitude in update request throws InvalidLocationException")
        void testInvalidLatitudeThrowsException() {
            UpdateShopRequest request = new UpdateShopRequest();
            request.setLatitude(95.0);
            request.setLongitude(73.8131);

            assertThrows(InvalidLocationException.class, () ->
                shopService.updateMyShopProfile(10L, request)
            );
        }

        @Test
        @DisplayName("Invalid longitude in update request throws InvalidLocationException")
        void testInvalidLongitudeThrowsException() {
            UpdateShopRequest request = new UpdateShopRequest();
            request.setLatitude(18.6279);
            request.setLongitude(-190.0);

            assertThrows(InvalidLocationException.class, () ->
                shopService.updateMyShopProfile(10L, request)
            );
        }
    }

    @Nested
    @DisplayName("Registration Location Confirmation Tests")
    class RegistrationLocationConfirmationTests {

        private UserRepository userRepository;
        private ShopRepository shopRepository;
        private GeocodingService geocodingService;
        private AuthService authService;

        @BeforeEach
        void setUp() {
            userRepository = mock(UserRepository.class);
            shopRepository = mock(ShopRepository.class);
            geocodingService = mock(GeocodingService.class);
            when(geocodingService.isValidCoordinates(anyDouble(), anyDouble())).thenCallRealMethod();

            PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
            when(passwordEncoder.encode(any())).thenReturn("hashed_pass");

            JwtService jwtService = mock(JwtService.class);
            when(jwtService.generateToken(any())).thenReturn("mock_token");

            AuthenticationManager authManager = mock(AuthenticationManager.class);
            StorageService storageService = mock(StorageService.class);
            BusinessDocumentRepository docRepo = mock(BusinessDocumentRepository.class);
            AdminNotificationService adminNoticeService = mock(AdminNotificationService.class);

            when(userRepository.existsByEmailIgnoreCase(any())).thenReturn(false);
            when(userRepository.existsByMobile(any())).thenReturn(false);
            when(userRepository.save(any(User.class))).thenAnswer(i -> {
                User u = i.getArgument(0);
                u.setId(99L);
                return u;
            });
            when(shopRepository.existsByOwnerId(anyLong())).thenReturn(false);
            when(shopRepository.save(any(Shop.class))).thenAnswer(i -> {
                Shop s = i.getArgument(0);
                s.setId(101L);
                return s;
            });

            authService = new AuthService(
                    userRepository, shopRepository, null, passwordEncoder,
                    jwtService, authManager, storageService, docRepo, adminNoticeService, null
            );
            authService.setGeocodingService(geocodingService);
        }

        @Test
        @DisplayName("Owner registration with confirmed coordinates stores exact location")
        void testRegistrationWithConfirmedCoordinates() {
            RegisterRequest req = RegisterRequest.builder()
                    .fullName("Baker Bob")
                    .email("baker@example.com")
                    .password("secret12345")
                    .mobile("9876543210")
                    .businessName("Bob's Bakery")
                    .addressLine1("123 Main St")
                    .city("Pune")
                    .state("Maharashtra")
                    .pincode("411001")
                    .latitude(18.5204)
                    .longitude(73.8567)
                    .build();

            authService.register(req);

            org.mockito.ArgumentCaptor<Shop> shopCaptor = org.mockito.ArgumentCaptor.forClass(Shop.class);
            verify(shopRepository).save(shopCaptor.capture());
            Shop savedShop = shopCaptor.getValue();

            assertEquals(18.5204, savedShop.getLatitude());
            assertEquals(73.8567, savedShop.getLongitude());
            assertEquals("123 Main St", savedShop.getAddressLine1());
            assertEquals("Pune", savedShop.getCity());
        }

        @Test
        @DisplayName("Owner registration without coordinates preserves address but leaves coordinates null (incomplete setup)")
        void testRegistrationWithoutCoordinatesLeavesNull() {
            RegisterRequest req = RegisterRequest.builder()
                    .fullName("Baker Bob")
                    .email("baker2@example.com")
                    .password("secret12345")
                    .mobile("9876543211")
                    .businessName("Bob's Bakery 2")
                    .addressLine1("456 Park Ave")
                    .city("Mumbai")
                    .state("Maharashtra")
                    .pincode("400001")
                    .latitude(null)
                    .longitude(null)
                    .build();

            authService.register(req);

            org.mockito.ArgumentCaptor<Shop> shopCaptor = org.mockito.ArgumentCaptor.forClass(Shop.class);
            verify(shopRepository).save(shopCaptor.capture());
            Shop savedShop = shopCaptor.getValue();

            assertNull(savedShop.getLatitude(), "Unconfirmed coordinates must remain null, never fabricated");
            assertNull(savedShop.getLongitude(), "Unconfirmed coordinates must remain null, never fabricated");
            assertEquals("456 Park Ave", savedShop.getAddressLine1());
            assertEquals("Mumbai", savedShop.getCity());
        }

        @Test
        @DisplayName("Owner registration with invalid coordinates is rejected with InvalidLocationException")
        void testRegistrationWithInvalidCoordinatesThrows() {
            RegisterRequest req = RegisterRequest.builder()
                    .fullName("Baker Bob")
                    .email("baker3@example.com")
                    .password("secret12345")
                    .mobile("9876543212")
                    .businessName("Bob's Bakery 3")
                    .addressLine1("789 Hill Rd")
                    .city("Nashik")
                    .state("Maharashtra")
                    .pincode("422001")
                    .latitude(118.5204) // Invalid > 90
                    .longitude(73.8567)
                    .build();

            assertThrows(InvalidLocationException.class, () -> authService.register(req));
        }
    }

    @Nested
    @DisplayName("Geocode Endpoint & Precision Classification Tests")
    class GeocodeEndpointAndPrecisionTests {

        private LocationLocalityRepository localityRepository;
        private RestTemplate restTemplate;
        private NominatimGeocodingService geocodingService;
        private LocationReferenceController controller;

        @BeforeEach
        void setUp() {
            localityRepository = mock(LocationLocalityRepository.class);
            restTemplate = mock(RestTemplate.class);
            geocodingService = new NominatimGeocodingService(localityRepository, restTemplate);
            controller = new LocationReferenceController(
                    mock(com.cakeplatform.api.modules.location.service.LocationService.class),
                    mock(com.cakeplatform.api.modules.location.service.LocationValidationService.class),
                    geocodingService
            );
        }


        @Test
        @DisplayName("6-digit PIN code query resolves local centroid with APPROXIMATE_PINCODE precision")
        void testPincodeResolvesApproximateCentroid() {
            LocationLocality loc = new LocationLocality();
            loc.setName("Akurdi");
            loc.setLatitude(18.6492);
            loc.setLongitude(73.7707);

            when(localityRepository.findByPincode("411035")).thenReturn(java.util.List.of(loc));

            GeocodeResultDTO result = geocodingService.geocodeDetailed(null, null, null, null, null, null, null, "411035");

            assertTrue(result.isFound());
            assertEquals(18.6492, result.getLatitude());
            assertEquals(73.7707, result.getLongitude());
            assertTrue(result.isApproximate(), "PIN code centroid must be marked as approximate");
            assertEquals("APPROXIMATE_PINCODE", result.getAccuracyType());
            assertEquals("LOCAL_PINCODE", result.getProvider());
        }

        @Test
        @DisplayName("Detailed geocode returns NOT_FOUND when address cannot be resolved")
        void testGeocodeNotFoundReturnsSafeResult() {
            when(localityRepository.findByPincode(any())).thenReturn(java.util.Collections.emptyList());

            GeocodeResultDTO result = geocodingService.geocodeDetailed(null, null, null, null, null, null, null, "Unknown Invalid Place 999999");

            assertFalse(result.isFound());
            assertNull(result.getLatitude());
            assertNull(result.getLongitude());
            assertEquals("NOT_FOUND", result.getAccuracyType());
        }

        @Test
        @DisplayName("LocationReferenceController geocode endpoint returns 200 with result")
        void testControllerGeocodeEndpoint() {
            var response = controller.geocodeLocation("411035", null, null, null, null, null, null, null);
            assertNotNull(response);
            assertEquals(HttpStatus.OK, response.getStatusCode());
            assertNotNull(response.getBody());
        }
    }
}

