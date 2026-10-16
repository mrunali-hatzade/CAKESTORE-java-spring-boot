package com.cakeplatform.api.modules.settings;

import com.cakeplatform.api.modules.settings.dto.GlobalSettingsDTO;
import com.cakeplatform.api.modules.settings.dto.GlobalSettingsResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class GlobalSettingsService {

    private final GlobalSettingsRepository repository;
    private volatile GlobalSettings cachedSettings = null;

    public GlobalSettings getSettings() {
        if (cachedSettings != null) {
            return cachedSettings;
        }
        synchronized(this) {
            if (cachedSettings == null) {
                cachedSettings = repository.findById(1L).orElseGet(() -> {
                    GlobalSettings defaultSettings = new GlobalSettings();
                    defaultSettings.setId(1L);
                    return repository.save(defaultSettings);
                });
            }
        }
        return cachedSettings;
    }

    public GlobalSettingsResponse getSettingsResponse() {
        return toResponse(getSettings());
    }

    @Transactional
    public GlobalSettings updateSettings(GlobalSettingsDTO dto) {
        GlobalSettings settings = getSettings();
        
        if (dto.getPlatformName() != null) {
            String name = dto.getPlatformName().trim();
            if (name.isBlank()) {
                throw new IllegalArgumentException("Platform name cannot be blank");
            }
            settings.setPlatformName(name);
        }
        if (dto.getSupportEmail() != null) {
            String email = dto.getSupportEmail().trim();
            if (email.isBlank()) {
                throw new IllegalArgumentException("Support email cannot be blank");
            }
            settings.setSupportEmail(email);
        }
        
        // Validation & Update logic
        if (dto.getRazorpayKeyId() != null && !dto.getRazorpayKeyId().isBlank()) {
            String keyId = dto.getRazorpayKeyId().trim();
            if (!keyId.startsWith("rzp_live_") && !keyId.startsWith("rzp_test_")) {
                throw new IllegalArgumentException("Invalid Razorpay Key ID format. Must start with rzp_live_ or rzp_test_");
            }
            settings.setRazorpayKeyId(keyId);
        }
        if (dto.getRazorpayKeySecret() != null && !dto.getRazorpayKeySecret().isBlank()) {
            settings.setRazorpayKeySecret(dto.getRazorpayKeySecret().trim());
        }
        if (dto.getRazorpayWebhookSecret() != null && !dto.getRazorpayWebhookSecret().isBlank()) {
            settings.setRazorpayWebhookSecret(dto.getRazorpayWebhookSecret().trim());
        }
        if (dto.getPlatformCurrency() != null && !dto.getPlatformCurrency().isBlank()) {
            settings.setPlatformCurrency(dto.getPlatformCurrency().trim());
        }

        cachedSettings = repository.save(settings);
        return cachedSettings;
    }

    @Transactional
    public GlobalSettingsResponse updateSettingsAndGetResponse(GlobalSettingsDTO dto) {
        return toResponse(updateSettings(dto));
    }

    public GlobalSettingsResponse toResponse(GlobalSettings settings) {
        boolean hasKeySecret = settings.getRazorpayKeySecret() != null && !settings.getRazorpayKeySecret().isBlank();
        boolean hasWebhookSecret = settings.getRazorpayWebhookSecret() != null && !settings.getRazorpayWebhookSecret().isBlank();
        return GlobalSettingsResponse.builder()
                .id(settings.getId())
                .platformName(settings.getPlatformName())
                .supportEmail(settings.getSupportEmail())
                .razorpayKeyId(settings.getRazorpayKeyId())
                .razorpayKeySecretConfigured(hasKeySecret)
                .razorpayWebhookSecretConfigured(hasWebhookSecret)
                .platformCurrency(settings.getPlatformCurrency())
                .updatedAt(settings.getUpdatedAt())
                .build();
    }
}

