package com.cakeplatform.api.modules.user.service;

import com.cakeplatform.api.modules.user.AddressType;
import com.cakeplatform.api.modules.user.CustomerAddress;
import com.cakeplatform.api.modules.user.CustomerAddressRepository;
import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.modules.user.UserRepository;
import com.cakeplatform.api.modules.user.dto.CustomerAddressRequest;
import com.cakeplatform.api.modules.user.dto.CustomerAddressResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class CustomerAddressService {

    private static final Pattern PINCODE_PATTERN = Pattern.compile("^[1-9][0-9]{5}$");
    private static final Pattern PHONE_PATTERN = Pattern.compile("^\\+?[0-9]{10,15}$");

    private final UserRepository userRepository;
    private final CustomerAddressRepository addressRepository;

    @Transactional(readOnly = true)
    public List<CustomerAddressResponse> getAddresses(Long customerId) {
        if (customerId == null) {
            throw new IllegalArgumentException("Customer ID is required");
        }
        return addressRepository.findByCustomerIdOrderByIsDefaultDescCreatedAtDesc(customerId)
                .stream()
                .map(this::mapToAddressResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public CustomerAddressResponse getAddressById(Long customerId, Long addressId) {
        if (customerId == null || addressId == null) {
            throw new IllegalArgumentException("Customer ID and Address ID are required");
        }
        CustomerAddress address = addressRepository.findByIdAndCustomerId(addressId, customerId)
                .orElseThrow(() -> new IllegalArgumentException("Address not found or does not belong to customer"));
        return mapToAddressResponse(address);
    }

    @Transactional
    public CustomerAddressResponse addAddress(Long customerId, CustomerAddressRequest request) {
        if (customerId == null) {
            throw new IllegalArgumentException("Customer ID is required");
        }
        User customer = userRepository.findById(customerId)
                .orElseThrow(() -> new IllegalArgumentException("Customer not found"));

        validateAddressRequest(request, true);

        List<CustomerAddress> existing = addressRepository.findByCustomerIdOrderByIsDefaultDescCreatedAtDesc(customerId);
        boolean isFirst = existing.isEmpty();
        boolean shouldBeDefault = isFirst || request.isDefault();

        if (shouldBeDefault) {
            clearDefaultAddress(customerId);
        }

        CustomerAddress address = new CustomerAddress();
        address.setCustomer(customer);
        populateEntityFromRequest(address, request);
        address.setDefault(shouldBeDefault);
        address.syncFormattedAddress();

        CustomerAddress saved = addressRepository.save(address);
        log.info("Saved new customer address id={} for customer id={}", saved.getId(), customerId);
        return mapToAddressResponse(saved);
    }

    @Transactional
    public CustomerAddressResponse updateAddress(Long customerId, Long addressId, CustomerAddressRequest request) {
        if (customerId == null || addressId == null) {
            throw new IllegalArgumentException("Customer ID and Address ID are required");
        }
        CustomerAddress address = addressRepository.findByIdAndCustomerId(addressId, customerId)
                .orElseThrow(() -> new IllegalArgumentException("Address not found or does not belong to customer"));

        validateAddressRequest(request, false);

        if (request.isDefault() && !address.isDefault()) {
            clearDefaultAddress(customerId);
            address.setDefault(true);
        }

        populateEntityFromRequest(address, request);
        address.syncFormattedAddress();

        CustomerAddress updated = addressRepository.save(address);
        log.info("Updated customer address id={} for customer id={}", updated.getId(), customerId);
        return mapToAddressResponse(updated);
    }

    @Transactional
    public void deleteAddress(Long customerId, Long addressId) {
        if (customerId == null || addressId == null) {
            throw new IllegalArgumentException("Customer ID and Address ID are required");
        }
        CustomerAddress address = addressRepository.findByIdAndCustomerId(addressId, customerId)
                .orElseThrow(() -> new IllegalArgumentException("Address not found or does not belong to customer"));

        boolean wasDefault = address.isDefault();
        addressRepository.delete(address);
        log.info("Deleted customer address id={} for customer id={}", addressId, customerId);

        if (wasDefault) {
            List<CustomerAddress> remaining = addressRepository.findByCustomerIdOrderByIsDefaultDescCreatedAtDesc(customerId);
            if (!remaining.isEmpty()) {
                CustomerAddress newDefault = remaining.get(0);
                newDefault.setDefault(true);
                addressRepository.save(newDefault);
                log.info("Reassigned default address to id={} for customer id={}", newDefault.getId(), customerId);
            }
        }
    }

    @Transactional
    public void setDefaultAddress(Long customerId, Long addressId) {
        if (customerId == null || addressId == null) {
            throw new IllegalArgumentException("Customer ID and Address ID are required");
        }
        CustomerAddress address = addressRepository.findByIdAndCustomerId(addressId, customerId)
                .orElseThrow(() -> new IllegalArgumentException("Address not found or does not belong to customer"));

        if (!address.isDefault()) {
            clearDefaultAddress(customerId);
            address.setDefault(true);
            addressRepository.save(address);
            log.info("Set address id={} as default for customer id={}", addressId, customerId);
        }
    }

    private void clearDefaultAddress(Long customerId) {
        List<CustomerAddress> addresses = addressRepository.findByCustomerIdOrderByIsDefaultDescCreatedAtDesc(customerId);
        for (CustomerAddress addr : addresses) {
            if (addr.isDefault()) {
                addr.setDefault(false);
                addressRepository.save(addr);
            }
        }
    }

    private void validateAddressRequest(CustomerAddressRequest request, boolean isNew) {
        if (request == null) {
            throw new IllegalArgumentException("Address request body cannot be null");
        }

        String name = request.getEffectiveName();
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Full name / Recipient name is required");
        }

        String phone = request.getEffectivePhone();
        if (phone == null || phone.isBlank()) {
            throw new IllegalArgumentException("Mobile number / Recipient phone is required");
        }
        String cleanPhone = phone.replaceAll("[\\s-]", "");
        if (!PHONE_PATTERN.matcher(cleanPhone).matches() || cleanPhone.length() < 10) {
            throw new IllegalArgumentException("Please provide a valid mobile number (at least 10 digits)");
        }

        String line1 = request.getEffectiveAddressLine1();
        if (line1 == null || line1.isBlank()) {
            throw new IllegalArgumentException("Address line 1 is required");
        }

        // Validate PIN code if provided
        String pincode = request.getPincode();
        if (pincode != null && !pincode.isBlank()) {
            String cleanPin = pincode.trim();
            if (!PINCODE_PATTERN.matcher(cleanPin).matches()) {
                throw new IllegalArgumentException("PIN code must be a valid 6-digit Indian PIN code");
            }
        }
    }

    private void populateEntityFromRequest(CustomerAddress entity, CustomerAddressRequest request) {
        String name = request.getEffectiveName();
        if (name != null) {
            entity.setRecipientName(name);
        }

        String phone = request.getEffectivePhone();
        if (phone != null) {
            entity.setRecipientPhone(phone);
        }

        String line1 = request.getEffectiveAddressLine1();
        if (line1 != null) {
            entity.setAddressLine1(line1);
        }

        if (request.getAddressLine2() != null) {
            entity.setAddressLine2(request.getAddressLine2().trim());
        }

        if (request.getLandmark() != null) {
            entity.setLandmark(request.getLandmark().trim());
        }

        if (request.getCity() != null) {
            entity.setCity(request.getCity().trim());
        }

        if (request.getState() != null) {
            entity.setState(request.getState().trim());
        }

        if (request.getPincode() != null) {
            entity.setPincode(request.getPincode().trim());
        }

        AddressType addressType = request.getEffectiveAddressType();
        entity.setAddressType(addressType);

        if (request.getLabel() != null && !request.getLabel().isBlank()) {
            entity.setLabel(request.getLabel().trim());
        } else {
            entity.setLabel(addressType.name());
        }

        if (request.getLatitude() != null) {
            entity.setLatitude(request.getLatitude());
        }
        if (request.getLongitude() != null) {
            entity.setLongitude(request.getLongitude());
        }

        if (request.getDeliveryAddress() != null && !request.getDeliveryAddress().isBlank()) {
            entity.setDeliveryAddress(request.getDeliveryAddress().trim());
        }
    }

    public CustomerAddressResponse mapToAddressResponse(CustomerAddress address) {
        if (address == null) return null;
        CustomerAddressResponse res = new CustomerAddressResponse();
        res.setId(address.getId());
        res.setLabel(address.getLabel());
        res.setRecipientName(address.getRecipientName());
        res.setFullName(address.getRecipientName());
        res.setRecipientPhone(address.getRecipientPhone());
        res.setMobileNumber(address.getRecipientPhone());
        res.setAddressLine1(address.getAddressLine1());
        res.setAddressLine2(address.getAddressLine2());
        res.setLandmark(address.getLandmark());
        res.setCity(address.getCity());
        res.setState(address.getState());
        res.setPincode(address.getPincode());
        res.setAddressType(address.getAddressType() != null ? address.getAddressType() : AddressType.HOME);
        res.setDeliveryAddress(address.getDeliveryAddress());
        res.setFormattedAddress(address.getFormattedAddress());
        res.setDefault(address.isDefault());
        res.setLatitude(address.getLatitude());
        res.setLongitude(address.getLongitude());
        res.setCreatedAt(address.getCreatedAt());
        res.setUpdatedAt(address.getUpdatedAt());
        return res;
    }
}

