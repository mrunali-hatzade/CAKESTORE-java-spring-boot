package com.cakeplatform.api.modules.user.controller;

import com.cakeplatform.api.modules.user.AddressType;
import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.modules.user.dto.CustomerAddressRequest;
import com.cakeplatform.api.modules.user.dto.CustomerAddressResponse;
import com.cakeplatform.api.modules.user.service.CustomerAddressService;
import com.cakeplatform.api.security.CustomUserDetails;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

public class CustomerAddressControllerTest {

    private StubAddressService stubAddressService;
    private CustomerAddressController addressController;
    private CustomUserDetails userDetails;
    private User customer;

    static class StubAddressService extends CustomerAddressService {
        final List<CustomerAddressResponse> responses = new ArrayList<>();
        boolean setDefaultCalled = false;
        boolean deleteCalled = false;

        public StubAddressService() {
            super(null, null);
        }

        @Override
        public List<CustomerAddressResponse> getAddresses(Long customerId) {
            return responses;
        }

        @Override
        public CustomerAddressResponse getAddressById(Long customerId, Long addressId) {
            CustomerAddressResponse res = new CustomerAddressResponse();
            res.setId(addressId);
            res.setAddressLine1("Villa 22");
            return res;
        }

        @Override
        public CustomerAddressResponse addAddress(Long customerId, CustomerAddressRequest request) {
            CustomerAddressResponse res = new CustomerAddressResponse();
            res.setId(10L);
            res.setAddressLine1(request.getEffectiveAddressLine1());
            res.setDefault(true);
            return res;
        }

        @Override
        public CustomerAddressResponse updateAddress(Long customerId, Long addressId, CustomerAddressRequest request) {
            CustomerAddressResponse res = new CustomerAddressResponse();
            res.setId(addressId);
            res.setAddressLine1(request.getEffectiveAddressLine1());
            return res;
        }

        @Override
        public void deleteAddress(Long customerId, Long addressId) {
            deleteCalled = true;
        }

        @Override
        public void setDefaultAddress(Long customerId, Long addressId) {
            setDefaultCalled = true;
        }
    }

    @BeforeEach
    void setUp() {
        stubAddressService = new StubAddressService();
        addressController = new CustomerAddressController(stubAddressService);

        customer = new User();
        customer.setId(101L);
        customer.setFullName("Ananya Sharma");
        customer.setEmail("ananya@example.com");

        userDetails = new CustomUserDetails(customer);
    }

    @Test
    @DisplayName("1. GET /api/customer/addresses returns 200 OK with address list")
    void testGetAddresses() {
        CustomerAddressResponse resp = new CustomerAddressResponse();
        resp.setId(1L);
        resp.setAddressLine1("Flat 101, Lotus Apts");
        resp.setCity("Pune");
        resp.setPincode("411001");
        resp.setDefault(true);
        stubAddressService.responses.add(resp);

        ResponseEntity<List<CustomerAddressResponse>> response = addressController.getAddresses(userDetails);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(1, response.getBody().size());
        assertEquals("Flat 101, Lotus Apts", response.getBody().get(0).getAddressLine1());
    }

    @Test
    @DisplayName("2. GET /api/customer/addresses/{id} returns 200 OK with single address")
    void testGetAddressById() {
        ResponseEntity<CustomerAddressResponse> response = addressController.getAddressById(userDetails, 5L);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(5L, response.getBody().getId());
    }

    @Test
    @DisplayName("3. POST /api/customer/addresses creates address and returns 201 CREATED")
    void testAddAddress() {
        CustomerAddressRequest req = new CustomerAddressRequest();
        req.setFullName("Ananya Sharma");
        req.setMobileNumber("9876543210");
        req.setAddressLine1("Flat 402");
        req.setCity("Pune");
        req.setState("Maharashtra");
        req.setPincode("411001");
        req.setAddressType(AddressType.HOME);

        ResponseEntity<CustomerAddressResponse> response = addressController.addAddress(userDetails, req);

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(10L, response.getBody().getId());
        assertTrue(response.getBody().isDefault());
    }

    @Test
    @DisplayName("4. PUT /api/customer/addresses/{id} updates address and returns 200 OK")
    void testUpdateAddress() {
        CustomerAddressRequest req = new CustomerAddressRequest();
        req.setAddressLine1("Updated Address Line");

        ResponseEntity<CustomerAddressResponse> response = addressController.updateAddress(userDetails, 10L, req);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("Updated Address Line", response.getBody().getAddressLine1());
    }

    @Test
    @DisplayName("5. DELETE /api/customer/addresses/{id} deletes address and returns 204 NO_CONTENT")
    void testDeleteAddress() {
        ResponseEntity<Void> response = addressController.deleteAddress(userDetails, 10L);

        assertEquals(HttpStatus.NO_CONTENT, response.getStatusCode());
        assertTrue(stubAddressService.deleteCalled);
    }

    @Test
    @DisplayName("6. PATCH and PUT /api/customer/addresses/{id}/default sets default address and returns 200 OK")
    void testSetDefaultAddress() {
        // PATCH
        ResponseEntity<Map<String, Boolean>> patchResp = addressController.setDefaultAddressPatch(userDetails, 10L);
        assertEquals(HttpStatus.OK, patchResp.getStatusCode());
        assertTrue(patchResp.getBody().get("success"));
        assertTrue(stubAddressService.setDefaultCalled);

        stubAddressService.setDefaultCalled = false;

        // PUT
        ResponseEntity<Map<String, Boolean>> putResp = addressController.setDefaultAddressPut(userDetails, 10L);
        assertEquals(HttpStatus.OK, putResp.getStatusCode());
        assertTrue(putResp.getBody().get("success"));
        assertTrue(stubAddressService.setDefaultCalled);
    }

    @Test
    @DisplayName("7. Unauthenticated request without UserDetails returns 401 UNAUTHORIZED")
    void testUnauthenticatedAccessReturns401() {
        ResponseEntity<List<CustomerAddressResponse>> getResp = addressController.getAddresses(null);
        assertEquals(HttpStatus.UNAUTHORIZED, getResp.getStatusCode());

        ResponseEntity<CustomerAddressResponse> postResp = addressController.addAddress(null, new CustomerAddressRequest());
        assertEquals(HttpStatus.UNAUTHORIZED, postResp.getStatusCode());

        ResponseEntity<Void> deleteResp = addressController.deleteAddress(null, 1L);
        assertEquals(HttpStatus.UNAUTHORIZED, deleteResp.getStatusCode());
    }
}
