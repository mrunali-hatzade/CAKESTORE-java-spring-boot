package com.cakeplatform.api.modules.user.service;

import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.modules.user.UserRepository;
import com.cakeplatform.api.modules.user.dto.CustomerAddressRequest;
import com.cakeplatform.api.modules.user.dto.CustomerAddressResponse;
import com.cakeplatform.api.modules.user.dto.CustomerProfileResponse;
import com.cakeplatform.api.modules.user.dto.CustomerProfileUpdateRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CustomerProfileService {

    private final UserRepository userRepository;
    private final CustomerAddressService addressService;

    @Transactional(readOnly = true)
    public CustomerProfileResponse getProfile(Long customerId) {
        User customer = userRepository.findById(customerId)
                .orElseThrow(() -> new IllegalArgumentException("Customer not found"));
        return mapToProfileResponse(customer);
    }

    @Transactional
    public CustomerProfileResponse updateProfile(Long customerId, CustomerProfileUpdateRequest request) {
        User customer = userRepository.findById(customerId)
                .orElseThrow(() -> new IllegalArgumentException("Customer not found"));

        if (request.getEmail() != null && !request.getEmail().trim().isEmpty()) {
            String email = request.getEmail().trim().toLowerCase();
            if (!email.equals(customer.getEmail())) {
                boolean emailExists = userRepository.existsByEmailIgnoreCase(email);
                if (emailExists) {
                    throw new IllegalArgumentException("Email is already in use");
                }
                customer.setEmail(email);
            }
        } else {
            customer.setEmail(null);
        }

        customer.setFullName(request.getFullName().trim());
        User updated = userRepository.save(customer);
        
        return mapToProfileResponse(updated);
    }

    @Transactional(readOnly = true)
    public List<CustomerAddressResponse> getAddresses(Long customerId) {
        return addressService.getAddresses(customerId);
    }

    @Transactional
    public CustomerAddressResponse addAddress(Long customerId, CustomerAddressRequest request) {
        return addressService.addAddress(customerId, request);
    }

    @Transactional
    public CustomerAddressResponse updateAddress(Long customerId, Long addressId, CustomerAddressRequest request) {
        return addressService.updateAddress(customerId, addressId, request);
    }

    @Transactional
    public void deleteAddress(Long customerId, Long addressId) {
        addressService.deleteAddress(customerId, addressId);
    }

    @Transactional
    public void setDefaultAddress(Long customerId, Long addressId) {
        addressService.setDefaultAddress(customerId, addressId);
    }

    private CustomerProfileResponse mapToProfileResponse(User user) {
        CustomerProfileResponse res = new CustomerProfileResponse();
        res.setId(user.getId());
        res.setFullName(user.getFullName());
        res.setEmail(user.getEmail());
        res.setMobile(user.getMobile());
        return res;
    }
}
