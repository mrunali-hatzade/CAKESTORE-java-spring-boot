package com.cakeplatform.api.modules.user.controller;

import com.cakeplatform.api.modules.user.dto.CustomerAddressRequest;
import com.cakeplatform.api.modules.user.dto.CustomerAddressResponse;
import com.cakeplatform.api.modules.user.service.CustomerAddressService;
import com.cakeplatform.api.security.CustomUserDetails;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/customer/addresses")
@PreAuthorize("hasAuthority('ROLE_CUSTOMER')")
@RequiredArgsConstructor
public class CustomerAddressController {

    private final CustomerAddressService addressService;

    @GetMapping
    public ResponseEntity<List<CustomerAddressResponse>> getAddresses(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        if (userDetails == null || userDetails.getId() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(addressService.getAddresses(userDetails.getId()));
    }

    @GetMapping("/{addressId}")
    public ResponseEntity<CustomerAddressResponse> getAddressById(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long addressId) {
        if (userDetails == null || userDetails.getId() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(addressService.getAddressById(userDetails.getId(), addressId));
    }

    @PostMapping
    public ResponseEntity<CustomerAddressResponse> addAddress(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @Valid @RequestBody CustomerAddressRequest request) {
        if (userDetails == null || userDetails.getId() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(addressService.addAddress(userDetails.getId(), request));
    }

    @PutMapping("/{addressId}")
    public ResponseEntity<CustomerAddressResponse> updateAddress(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long addressId,
            @Valid @RequestBody CustomerAddressRequest request) {
        if (userDetails == null || userDetails.getId() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(addressService.updateAddress(userDetails.getId(), addressId, request));
    }

    @DeleteMapping("/{addressId}")
    public ResponseEntity<Void> deleteAddress(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long addressId) {
        if (userDetails == null || userDetails.getId() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        addressService.deleteAddress(userDetails.getId(), addressId);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{addressId}/default")
    public ResponseEntity<Map<String, Boolean>> setDefaultAddressPatch(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long addressId) {
        if (userDetails == null || userDetails.getId() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        addressService.setDefaultAddress(userDetails.getId(), addressId);
        return ResponseEntity.ok(Map.of("success", true));
    }

    @PutMapping("/{addressId}/default")
    public ResponseEntity<Map<String, Boolean>> setDefaultAddressPut(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long addressId) {
        if (userDetails == null || userDetails.getId() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        addressService.setDefaultAddress(userDetails.getId(), addressId);
        return ResponseEntity.ok(Map.of("success", true));
    }
}

