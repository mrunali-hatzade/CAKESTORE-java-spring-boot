package com.cakeplatform.api.modules.shop.controller;

import com.cakeplatform.api.modules.shop.Shop;
import com.cakeplatform.api.modules.shop.ShopDeliveryConfig;
import com.cakeplatform.api.modules.shop.ShopDeliveryConfigRepository;
import com.cakeplatform.api.modules.shop.dto.ShopDeliveryConfigRequest;
import com.cakeplatform.api.modules.shop.service.OwnerStorefrontService;
import com.cakeplatform.api.modules.security.ShopAccessValidator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

import java.lang.reflect.Proxy;
import java.math.BigDecimal;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.*;

public class OwnerStorefrontDeliveryZoneSecurityTest {

    private OwnerStorefrontService ownerStorefrontService;

    private Shop shop;
    private ShopDeliveryConfig existingConfig;
    private AtomicBoolean savedCalled = new AtomicBoolean(false);

    private static final Long OWNER_ID = 13719L;
    private static final Long ATTACKER_OWNER_ID = 99999L;

    @BeforeEach
    void setUp() {
        shop = new Shop();
        shop.setId(440L);
        shop.setBusinessName("My Bakery");

        existingConfig = ShopDeliveryConfig.builder()
                .id(10L)
                .shop(shop)
                .deliveryEnabled(true)
                .deliveryChargeType("FIXED")
                .fixedChargeAmount(BigDecimal.valueOf(50.00))
                .build();

        savedCalled.set(false);

        ShopAccessValidator stubValidator = new ShopAccessValidator(null, null) {
            @Override
            public Shop getValidShopForOwner(Long ownerId) {
                if (OWNER_ID.equals(ownerId)) {
                    return shop;
                }
                throw new AccessDeniedException("User does not have an active shop");
            }
        };

        ShopDeliveryConfigRepository stubRepository = (ShopDeliveryConfigRepository) Proxy.newProxyInstance(
                ShopDeliveryConfigRepository.class.getClassLoader(),
                new Class<?>[]{ShopDeliveryConfigRepository.class},
                (proxy, method, args) -> {
                    if ("findByShopId".equals(method.getName())) {
                        return Optional.of(existingConfig);
                    }
                    if ("save".equals(method.getName())) {
                        savedCalled.set(true);
                        return args[0];
                    }
                    return null;
                }
        );

        ownerStorefrontService = new OwnerStorefrontService(
                stubValidator, null, null, stubRepository, null, null
        );
    }

    @Test
    @DisplayName("Owner successfully updates delivery radius and serviceable pincodes")
    void testOwnerSuccessfullyUpdatesDeliveryZones() {
        ShopDeliveryConfigRequest request = new ShopDeliveryConfigRequest();
        request.setDeliveryEnabled(true);
        request.setDeliveryChargeType("FIXED");
        request.setFixedChargeAmount(BigDecimal.valueOf(60.00));
        request.setMaxDeliveryRadiusKm(15.0);
        request.setServiceablePincodes("411035, 411033");

        ShopDeliveryConfig updated = ownerStorefrontService.updateDeliveryConfig(OWNER_ID, request);

        assertNotNull(updated);
        assertEquals(15.0, updated.getMaxDeliveryRadiusKm());
        assertEquals("411033, 411035", updated.getServiceablePincodes());
        assertTrue(savedCalled.get());
    }

    @Test
    @DisplayName("Cross-tenant: Attacker owner cannot update another shop's delivery configuration")
    void testCrossTenantConfigurationAccessDenied() {
        ShopDeliveryConfigRequest request = new ShopDeliveryConfigRequest();
        request.setDeliveryChargeType("FREE");
        request.setFixedChargeAmount(BigDecimal.ZERO);

        assertThrows(AccessDeniedException.class, () ->
                ownerStorefrontService.updateDeliveryConfig(ATTACKER_OWNER_ID, request)
        );

        assertFalse(savedCalled.get());
    }

    @Test
    @DisplayName("Pincode validation: Rejects invalid non-6-digit PIN codes")
    void testInvalidPincodeRejected() {
        ShopDeliveryConfigRequest request = new ShopDeliveryConfigRequest();
        request.setDeliveryChargeType("FIXED");
        request.setFixedChargeAmount(BigDecimal.valueOf(50.00));
        request.setServiceablePincodes("411035, INVALID_PIN, 123");

        var ex = assertThrows(IllegalArgumentException.class, () ->
                ownerStorefrontService.updateDeliveryConfig(OWNER_ID, request)
        );

        assertTrue(ex.getMessage().contains("Invalid PIN code"));
        assertFalse(savedCalled.get());
    }
}
