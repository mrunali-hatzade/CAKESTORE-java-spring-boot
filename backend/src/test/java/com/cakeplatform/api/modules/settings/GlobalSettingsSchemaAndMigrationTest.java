package com.cakeplatform.api.modules.settings;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
public class GlobalSettingsSchemaAndMigrationTest {

    @Autowired
    private GlobalSettingsRepository repository;

    @Autowired
    private GlobalSettingsService service;

    @Test
    @DisplayName("Verify global_settings singleton row exists and is populated with non-secret defaults")
    public void testSingletonRowExists() {
        Optional<GlobalSettings> optionalSettings = repository.findById(1L);
        assertTrue(optionalSettings.isPresent(), "global_settings row with id=1 must exist");

        GlobalSettings settings = optionalSettings.get();
        assertEquals(1L, settings.getId());
        assertNotNull(settings.getPlatformName());
        assertTrue(settings.getPlatformName().startsWith("CakeStore"), "Platform name should start with CakeStore");
        assertNotNull(settings.getSupportEmail());
        assertEquals("INR", settings.getPlatformCurrency());
    }

    @Test
    @DisplayName("Verify GlobalSettingsService gets and preserves singleton settings")
    public void testServiceRetrieval() {
        GlobalSettings settings = service.getSettings();
        assertNotNull(settings);
        assertEquals(1L, settings.getId());
        assertNotNull(settings.getPlatformName());
    }

    @Test
    @Transactional
    @DisplayName("Verify updating and persisting GlobalSettings without overwriting unwanted fields")
    public void testUpdateSettings() {
        GlobalSettings settings = repository.findById(1L).orElseThrow();
        String originalCurrency = settings.getPlatformCurrency();

        settings.setPlatformName("CakeStore Updated Test");
        settings.setUpdatedAt(LocalDateTime.now());
        GlobalSettings saved = repository.save(settings);

        assertEquals("CakeStore Updated Test", saved.getPlatformName());
        assertEquals(originalCurrency, saved.getPlatformCurrency());
    }
}
