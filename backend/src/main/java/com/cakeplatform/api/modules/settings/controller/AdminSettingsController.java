package com.cakeplatform.api.modules.settings.controller;

import com.cakeplatform.api.modules.settings.GlobalSettingsService;
import com.cakeplatform.api.modules.settings.dto.GlobalSettingsDTO;
import com.cakeplatform.api.modules.settings.dto.GlobalSettingsResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/settings")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
@RequiredArgsConstructor
public class AdminSettingsController {

    private final GlobalSettingsService service;

    @GetMapping
    public ResponseEntity<GlobalSettingsResponse> getSettings() {
        return ResponseEntity.ok(service.getSettingsResponse());
    }

    @PutMapping
    public ResponseEntity<GlobalSettingsResponse> updateSettings(@Valid @RequestBody GlobalSettingsDTO dto) {
        return ResponseEntity.ok(service.updateSettingsAndGetResponse(dto));
    }
}
