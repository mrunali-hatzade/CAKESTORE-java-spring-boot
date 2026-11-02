package com.cakeplatform.api.modules.user.service;

import com.cakeplatform.api.modules.user.AddressType;
import com.cakeplatform.api.modules.user.CustomerAddress;
import com.cakeplatform.api.modules.user.CustomerAddressRepository;
import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.modules.user.UserRepository;
import com.cakeplatform.api.modules.user.dto.CustomerAddressRequest;
import com.cakeplatform.api.modules.user.dto.CustomerAddressResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Proxy;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;

public class CustomerAddressServiceTest {

    private final Map<Long, User> users = new HashMap<>();
    private final Map<Long, CustomerAddress> addresses = new HashMap<>();
    private final AtomicLong idSeq = new AtomicLong(1);

    private CustomerAddressService addressService;
    private User customer1;
    private User customer2;

    @BeforeEach
    void setUp() {
        users.clear();
        addresses.clear();
        idSeq.set(1);

        UserRepository userRepository = (UserRepository) Proxy.newProxyInstance(
                UserRepository.class.getClassLoader(),
                new Class<?>[]{UserRepository.class},
                (proxy, method, args) -> {
                    if ("findById".equals(method.getName())) {
                        Long id = (Long) args[0];
                        return Optional.ofNullable(users.get(id));
                    }
                    return null;
                }
        );

        CustomerAddressRepository addressRepository = (CustomerAddressRepository) Proxy.newProxyInstance(
                CustomerAddressRepository.class.getClassLoader(),
                new Class<?>[]{CustomerAddressRepository.class},
                (proxy, method, args) -> {
                    String name = method.getName();
                    if ("findByCustomerIdOrderByIsDefaultDescCreatedAtDesc".equals(name)) {
                        Long customerId = (Long) args[0];
                        return addresses.values().stream()
                                .filter(a -> a.getCustomer() != null && customerId.equals(a.getCustomer().getId()))
                                .sorted((a1, a2) -> {
                                    int defCompare = Boolean.compare(a2.isDefault(), a1.isDefault());
                                    if (defCompare != 0) return defCompare;
                                    return Long.compare(a2.getId() != null ? a2.getId() : 0, a1.getId() != null ? a1.getId() : 0);
                                })
                                .collect(Collectors.toList());
                    }
                    if ("findByIdAndCustomerId".equals(name)) {
                        Long id = (Long) args[0];
                        Long customerId = (Long) args[1];
                        CustomerAddress a = addresses.get(id);
                        if (a != null && a.getCustomer() != null && customerId.equals(a.getCustomer().getId())) {
                            return Optional.of(a);
                        }
                        return Optional.empty();
                    }
                    if ("findById".equals(name)) {
                        Long id = (Long) args[0];
                        return Optional.ofNullable(addresses.get(id));
                    }
                    if ("save".equals(name)) {
                        CustomerAddress a = (CustomerAddress) args[0];
                        if (a.getId() == null) {
                            a.setId(idSeq.getAndIncrement());
                        }
                        addresses.put(a.getId(), a);
                        return a;
                    }
                    if ("delete".equals(name)) {
                        CustomerAddress a = (CustomerAddress) args[0];
                        if (a != null && a.getId() != null) {
                            addresses.remove(a.getId());
                        }
                        return null;
                    }
                    return null;
                }
        );

        addressService = new CustomerAddressService(userRepository, addressRepository);

        customer1 = new User();
        customer1.setId(101L);
        customer1.setFullName("Ananya Sharma");
        customer1.setMobile("9876543210");
        customer1.setEmail("ananya@example.com");
        users.put(101L, customer1);

        customer2 = new User();
        customer2.setId(202L);
        customer2.setFullName("Rohan Verma");
        customer2.setMobile("9123456780");
        customer2.setEmail("rohan@example.com");
        users.put(202L, customer2);
    }

    @Test
    @DisplayName("1. Adding first address automatically marks it as default")
    void testAddFirstAddressMarksAsDefault() {
        CustomerAddressRequest req = new CustomerAddressRequest();
        req.setFullName("Ananya Sharma");
        req.setMobileNumber("9876543210");
        req.setAddressLine1("Flat 402, Lotus Residency");
        req.setCity("Pune");
        req.setState("Maharashtra");
        req.setPincode("411001");
        req.setAddressType(AddressType.HOME);
        req.setIsDefault(false); // Even if false, first address becomes default

        CustomerAddressResponse resp = addressService.addAddress(101L, req);

        assertNotNull(resp);
        assertNotNull(resp.getId());
        assertTrue(resp.isDefault(), "First address must automatically be marked default");
        assertEquals("HOME", resp.getAddressType().name());
        assertEquals("411001", resp.getPincode());
        assertTrue(resp.getFormattedAddress().contains("Lotus Residency"));
    }

    @Test
    @DisplayName("2. Adding second non-default address preserves existing default")
    void testAddSecondNonDefaultAddress() {
        // First address
        CustomerAddressRequest req1 = new CustomerAddressRequest();
        req1.setFullName("Ananya Sharma");
        req1.setMobileNumber("9876543210");
        req1.setAddressLine1("Flat 402, Lotus Residency");
        req1.setCity("Pune");
        req1.setState("Maharashtra");
        req1.setPincode("411001");
        req1.setAddressType(AddressType.HOME);
        CustomerAddressResponse resp1 = addressService.addAddress(101L, req1);
        assertTrue(resp1.isDefault());

        // Second address
        CustomerAddressRequest req2 = new CustomerAddressRequest();
        req2.setFullName("Ananya Sharma");
        req2.setMobileNumber("9876543210");
        req2.setAddressLine1("Tower B, Tech Park");
        req2.setCity("Pune");
        req2.setState("Maharashtra");
        req2.setPincode("411014");
        req2.setAddressType(AddressType.WORK);
        req2.setIsDefault(false);

        CustomerAddressResponse resp2 = addressService.addAddress(101L, req2);
        assertNotNull(resp2);
        assertFalse(resp2.isDefault(), "Second address must not be default when isDefault is false");

        // Verify first address is still default
        CustomerAddress firstAddr = addresses.get(resp1.getId());
        assertTrue(firstAddr.isDefault(), "First address must remain default");
    }

    @Test
    @DisplayName("3. Adding address marked default unsets previous default (Single Default Guarantee)")
    void testAddAddressWithDefaultClearsPreviousDefault() {
        // First address (default)
        CustomerAddressRequest req1 = new CustomerAddressRequest();
        req1.setFullName("Ananya Sharma");
        req1.setMobileNumber("9876543210");
        req1.setAddressLine1("Flat 402, Lotus Residency");
        req1.setCity("Pune");
        req1.setState("Maharashtra");
        req1.setPincode("411001");
        CustomerAddressResponse resp1 = addressService.addAddress(101L, req1);
        assertTrue(resp1.isDefault());

        // Second address with isDefault = true
        CustomerAddressRequest req2 = new CustomerAddressRequest();
        req2.setFullName("Ananya Sharma");
        req2.setMobileNumber("9876543210");
        req2.setAddressLine1("Villa 9, Sunshine Woods");
        req2.setCity("Pune");
        req2.setState("Maharashtra");
        req2.setPincode("411028");
        req2.setAddressType(AddressType.OTHER);
        req2.setIsDefault(true);

        CustomerAddressResponse resp2 = addressService.addAddress(101L, req2);
        assertTrue(resp2.isDefault());

        // Verify first address is no longer default
        CustomerAddress firstAddr = addresses.get(resp1.getId());
        assertFalse(firstAddr.isDefault(), "Previous default address must now be unset");
    }

    @Test
    @DisplayName("4. Setting default address unsets all other addresses for that customer")
    void testSetDefaultAddressGuarantee() {
        CustomerAddressRequest req1 = new CustomerAddressRequest();
        req1.setFullName("Ananya Sharma");
        req1.setMobileNumber("9876543210");
        req1.setAddressLine1("Address 1");
        CustomerAddressResponse resp1 = addressService.addAddress(101L, req1);

        CustomerAddressRequest req2 = new CustomerAddressRequest();
        req2.setFullName("Ananya Sharma");
        req2.setMobileNumber("9876543210");
        req2.setAddressLine1("Address 2");
        CustomerAddressResponse resp2 = addressService.addAddress(101L, req2);

        assertTrue(resp1.isDefault());
        assertFalse(resp2.isDefault());

        // Now set address 2 as default
        addressService.setDefaultAddress(101L, resp2.getId());

        CustomerAddress a1 = addresses.get(resp1.getId());
        CustomerAddress a2 = addresses.get(resp2.getId());
        assertFalse(a1.isDefault(), "Address 1 must no longer be default");
        assertTrue(a2.isDefault(), "Address 2 must now be default");
    }

    @Test
    @DisplayName("5. Deleting default address safely reassigns default to next remaining address")
    void testDeleteDefaultAddressReassignsDefault() {
        CustomerAddressRequest req1 = new CustomerAddressRequest();
        req1.setFullName("Ananya Sharma");
        req1.setMobileNumber("9876543210");
        req1.setAddressLine1("Address 1 (Default)");
        CustomerAddressResponse resp1 = addressService.addAddress(101L, req1);

        CustomerAddressRequest req2 = new CustomerAddressRequest();
        req2.setFullName("Ananya Sharma");
        req2.setMobileNumber("9876543210");
        req2.setAddressLine1("Address 2 (Secondary)");
        CustomerAddressResponse resp2 = addressService.addAddress(101L, req2);

        assertTrue(resp1.isDefault());
        assertFalse(resp2.isDefault());

        // Delete address 1 (which is default)
        addressService.deleteAddress(101L, resp1.getId());

        // Verify address 1 is deleted
        assertNull(addresses.get(resp1.getId()));

        // Verify address 2 is now promoted to default
        CustomerAddress a2 = addresses.get(resp2.getId());
        assertNotNull(a2);
        assertTrue(a2.isDefault(), "Remaining address must be promoted to default");
    }

    @Test
    @DisplayName("6. Deleting non-default address leaves existing default intact")
    void testDeleteNonDefaultAddressLeavesDefaultIntact() {
        CustomerAddressRequest req1 = new CustomerAddressRequest();
        req1.setFullName("Ananya Sharma");
        req1.setMobileNumber("9876543210");
        req1.setAddressLine1("Address 1");
        CustomerAddressResponse resp1 = addressService.addAddress(101L, req1);

        CustomerAddressRequest req2 = new CustomerAddressRequest();
        req2.setFullName("Ananya Sharma");
        req2.setMobileNumber("9876543210");
        req2.setAddressLine1("Address 2");
        CustomerAddressResponse resp2 = addressService.addAddress(101L, req2);

        // Delete address 2 (non-default)
        addressService.deleteAddress(101L, resp2.getId());

        CustomerAddress a1 = addresses.get(resp1.getId());
        assertTrue(a1.isDefault(), "Address 1 must remain default");
    }

    @Test
    @DisplayName("7. Cross-customer isolation: Customer 2 cannot access, update, or delete Customer 1's address")
    void testCrossCustomerAccessIsolation() {
        CustomerAddressRequest req1 = new CustomerAddressRequest();
        req1.setFullName("Ananya Sharma");
        req1.setMobileNumber("9876543210");
        req1.setAddressLine1("Customer 1 Private Residence");
        CustomerAddressResponse resp1 = addressService.addAddress(101L, req1);

        // Customer 2 tries to read Customer 1's address
        assertThrows(IllegalArgumentException.class, () -> {
            addressService.getAddressById(202L, resp1.getId());
        }, "Should throw when attempting to read another customer's address");

        // Customer 2 tries to update Customer 1's address
        CustomerAddressRequest updateReq = new CustomerAddressRequest();
        updateReq.setFullName("Malicious Actor");
        updateReq.setMobileNumber("9999999999");
        updateReq.setAddressLine1("Hacked Address");
        assertThrows(IllegalArgumentException.class, () -> {
            addressService.updateAddress(202L, resp1.getId(), updateReq);
        }, "Should throw when attempting to update another customer's address");

        // Customer 2 tries to delete Customer 1's address
        assertThrows(IllegalArgumentException.class, () -> {
            addressService.deleteAddress(202L, resp1.getId());
        }, "Should throw when attempting to delete another customer's address");

        // Customer 2 tries to set default on Customer 1's address
        assertThrows(IllegalArgumentException.class, () -> {
            addressService.setDefaultAddress(202L, resp1.getId());
        }, "Should throw when attempting to set default on another customer's address");
    }

    @Test
    @DisplayName("8. Invalid PIN code format is strictly rejected")
    void testInvalidPincodeValidation() {
        CustomerAddressRequest req = new CustomerAddressRequest();
        req.setFullName("Ananya Sharma");
        req.setMobileNumber("9876543210");
        req.setAddressLine1("Lotus Residency");
        req.setCity("Pune");
        req.setState("Maharashtra");

        // 5 digits
        req.setPincode("41100");
        IllegalArgumentException ex1 = assertThrows(IllegalArgumentException.class, () -> {
            addressService.addAddress(101L, req);
        });
        assertTrue(ex1.getMessage().contains("PIN code"));

        // Starts with 0
        req.setPincode("012345");
        IllegalArgumentException ex2 = assertThrows(IllegalArgumentException.class, () -> {
            addressService.addAddress(101L, req);
        });
        assertTrue(ex2.getMessage().contains("PIN code"));

        // Contains letters
        req.setPincode("41100A");
        IllegalArgumentException ex3 = assertThrows(IllegalArgumentException.class, () -> {
            addressService.addAddress(101L, req);
        });
        assertTrue(ex3.getMessage().contains("PIN code"));
    }

    @Test
    @DisplayName("9. Invalid mobile number is strictly rejected")
    void testInvalidMobileNumberValidation() {
        CustomerAddressRequest req = new CustomerAddressRequest();
        req.setFullName("Ananya Sharma");
        req.setAddressLine1("Lotus Residency");
        req.setCity("Pune");
        req.setState("Maharashtra");
        req.setPincode("411001");

        // Short phone (< 10 digits)
        req.setMobileNumber("12345");
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
            addressService.addAddress(101L, req);
        });
        assertTrue(ex.getMessage().contains("mobile number"));
    }

    @Test
    @DisplayName("10. Missing address line 1 is strictly rejected")
    void testMissingAddressLine1Validation() {
        CustomerAddressRequest req = new CustomerAddressRequest();
        req.setFullName("Ananya Sharma");
        req.setMobileNumber("9876543210");
        req.setCity("Pune");
        req.setState("Maharashtra");
        req.setPincode("411001");
        req.setAddressLine1("");

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
            addressService.addAddress(101L, req);
        });
        assertTrue(ex.getMessage().contains("Address line 1 is required"));
    }

    @Test
    @DisplayName("11. Formatted address combines line1, line2, landmark, city, state, and pincode cleanly")
    void testFormattedAddressSynthesis() {
        CustomerAddress addr = new CustomerAddress();
        addr.setAddressLine1("Flat 502, Sky High");
        addr.setAddressLine2("Koregaon Park Main Road");
        addr.setLandmark("German Bakery");
        addr.setCity("Pune");
        addr.setState("Maharashtra");
        addr.setPincode("411001");

        String formatted = addr.getFormattedAddress();
        assertEquals(
                "Flat 502, Sky High, Koregaon Park Main Road, Near German Bakery, Pune, Maharashtra - 411001",
                formatted
        );
    }
}
