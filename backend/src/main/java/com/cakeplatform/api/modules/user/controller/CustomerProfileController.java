package com.cakeplatform.api.modules.user.controller;

import com.cakeplatform.api.modules.user.dto.CustomerAddressRequest;
import com.cakeplatform.api.modules.user.dto.CustomerAddressResponse;
import com.cakeplatform.api.modules.user.dto.CustomerProfileResponse;
import com.cakeplatform.api.modules.user.dto.CustomerProfileUpdateRequest;
import com.cakeplatform.api.modules.user.service.CustomerProfileService;
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
@RequestMapping("/api/customer/profile")
@PreAuthorize("hasAuthority('ROLE_CUSTOMER')")
@RequiredArgsConstructor
public class CustomerProfileController {

    private final CustomerProfileService profileService;

    @GetMapping
    public ResponseEntity<CustomerProfileResponse> getProfile(@AuthenticationPrincipal CustomUserDetails userDetails) {
        if (userDetails == null || userDetails.getId() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(profileService.getProfile(userDetails.getId()));
    }

    @PutMapping
    public ResponseEntity<CustomerProfileResponse> updateProfile(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @Valid @RequestBody CustomerProfileUpdateRequest request) {
        if (userDetails == null || userDetails.getId() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(profileService.updateProfile(userDetails.getId(), request));
    }

    @GetMapping("/addresses")
    public ResponseEntity<List<CustomerAddressResponse>> getAddresses(@AuthenticationPrincipal CustomUserDetails userDetails) {
        if (userDetails == null || userDetails.getId() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(profileService.getAddresses(userDetails.getId()));
    }

    @PostMapping("/addresses")
    public ResponseEntity<CustomerAddressResponse> addAddress(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @Valid @RequestBody CustomerAddressRequest request) {
        if (userDetails == null || userDetails.getId() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(profileService.addAddress(userDetails.getId(), request));
    }

    @PutMapping("/addresses/{addressId}")
    public ResponseEntity<CustomerAddressResponse> updateAddress(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long addressId,
            @Valid @RequestBody CustomerAddressRequest request) {
        if (userDetails == null || userDetails.getId() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(profileService.updateAddress(userDetails.getId(), addressId, request));
    }

    @DeleteMapping("/addresses/{addressId}")
    public ResponseEntity<Void> deleteAddress(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long addressId) {
        if (userDetails == null || userDetails.getId() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        profileService.deleteAddress(userDetails.getId(), addressId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/addresses/{addressId}/default")
    public ResponseEntity<Map<String, Boolean>> setDefaultAddress(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long addressId) {
        if (userDetails == null || userDetails.getId() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        profileService.setDefaultAddress(userDetails.getId(), addressId);
        return ResponseEntity.ok(Map.of("success", true));
    }

    @PatchMapping("/addresses/{addressId}/default")
    public ResponseEntity<Map<String, Boolean>> setDefaultAddressPatch(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long addressId) {
        if (userDetails == null || userDetails.getId() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        profileService.setDefaultAddress(userDetails.getId(), addressId);
        return ResponseEntity.ok(Map.of("success", true));
    }
}
