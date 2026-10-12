package com.cakeplatform.api.modules.shop.service;

import com.cakeplatform.api.modules.security.ShopAccessValidator;
import com.cakeplatform.api.modules.shop.Shop;
import com.cakeplatform.api.modules.shop.ShopBusinessHours;
import com.cakeplatform.api.modules.shop.ShopBusinessHoursRepository;
import com.cakeplatform.api.modules.shop.ShopStatus;
import com.cakeplatform.api.modules.shop.dto.ShopBusinessHoursRequest;
import com.cakeplatform.api.modules.storefront.StorefrontCacheService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class OwnerBusinessHoursValidationTest {

    @Mock
    private ShopAccessValidator shopAccessValidator;

    @Mock
    private ShopBusinessHoursRepository shopBusinessHoursRepository;

    @Mock
    private StorefrontCacheService storefrontCacheService;

    private OwnerStorefrontService ownerStorefrontService;

    private Shop testShop;
    private final Long ownerId = 42L;
    private final Long shopId = 100L;

    @BeforeEach
    void setUp() {
        ownerStorefrontService = new OwnerStorefrontService(
                shopAccessValidator,
                null,
                shopBusinessHoursRepository,
                null,
                null,
                null,
                storefrontCacheService
        );

        testShop = new Shop();
        testShop.setId(shopId);
        testShop.setBusinessName("Sweet Delights Bakery");
        testShop.setStatus(ShopStatus.ACTIVE);

        when(shopAccessValidator.getValidShopForOwner(ownerId)).thenReturn(testShop);
    }

    @Test
    @DisplayName("Opening time earlier than closing time is accepted for an open day")
    void shouldAcceptOpeningEarlierThanClosing() {
        ShopBusinessHoursRequest request = new ShopBusinessHoursRequest();
        request.setDayOfWeek("MONDAY");
        request.setIsOpen(true);
        request.setOpenTime(LocalTime.of(8, 30));
        request.setCloseTime(LocalTime.of(20, 30));

        when(shopBusinessHoursRepository.findByShopIdAndDayOfWeek(shopId, "MONDAY"))
                .thenReturn(Optional.empty());
        when(shopBusinessHoursRepository.save(any(ShopBusinessHours.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        ShopBusinessHours saved = ownerStorefrontService.saveBusinessHour(ownerId, request);

        assertThat(saved).isNotNull();
        assertThat(saved.getIsOpen()).isTrue();
        assertThat(saved.getOpenTime()).isEqualTo(LocalTime.of(8, 30));
        assertThat(saved.getCloseTime()).isEqualTo(LocalTime.of(20, 30));

        verify(storefrontCacheService).evictShopDetails(shopId);
    }

    @Test
    @DisplayName("Equal opening and closing time is rejected for an open day")
    void shouldRejectEqualOpeningAndClosingTime() {
        ShopBusinessHoursRequest request = new ShopBusinessHoursRequest();
        request.setDayOfWeek("TUESDAY");
        request.setIsOpen(true);
        request.setOpenTime(LocalTime.of(10, 0));
        request.setCloseTime(LocalTime.of(10, 0));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                ownerStorefrontService.saveBusinessHour(ownerId, request)
        );

        assertThat(ex.getMessage()).contains("Closing time must be strictly after opening time");
        verify(shopBusinessHoursRepository, never()).save(any());
        verify(storefrontCacheService, never()).evictShopDetails(any());
    }

    @Test
    @DisplayName("Opening time later than closing time (overnight) is rejected for an open day")
    void shouldRejectOpeningAfterClosingTime() {
        ShopBusinessHoursRequest request = new ShopBusinessHoursRequest();
        request.setDayOfWeek("WEDNESDAY");
        request.setIsOpen(true);
        request.setOpenTime(LocalTime.of(22, 0));
        request.setCloseTime(LocalTime.of(6, 0));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                ownerStorefrontService.saveBusinessHour(ownerId, request)
        );

        assertThat(ex.getMessage()).contains("Closing time must be strictly after opening time");
        verify(shopBusinessHoursRepository, never()).save(any());
    }

    @Test
    @DisplayName("Missing opening or closing time is rejected when day is open")
    void shouldRejectOpenDayWithNullTimes() {
        ShopBusinessHoursRequest request = new ShopBusinessHoursRequest();
        request.setDayOfWeek("THURSDAY");
        request.setIsOpen(true);
        request.setOpenTime(null);
        request.setCloseTime(null);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                ownerStorefrontService.saveBusinessHour(ownerId, request)
        );

        assertThat(ex.getMessage()).contains("Opening and closing times are required when the day is open");
        verify(shopBusinessHoursRepository, never()).save(any());
    }

    @Test
    @DisplayName("Closed days follow existing intended behavior and accept omitted times")
    void shouldAcceptClosedDayWithoutTimes() {
        ShopBusinessHoursRequest request = new ShopBusinessHoursRequest();
        request.setDayOfWeek("SUNDAY");
        request.setIsOpen(false);
        request.setOpenTime(null);
        request.setCloseTime(null);

        when(shopBusinessHoursRepository.findByShopIdAndDayOfWeek(shopId, "SUNDAY"))
                .thenReturn(Optional.empty());
        when(shopBusinessHoursRepository.save(any(ShopBusinessHours.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        ShopBusinessHours saved = ownerStorefrontService.saveBusinessHour(ownerId, request);

        assertThat(saved).isNotNull();
        assertThat(saved.getIsOpen()).isFalse();
        // Fallback defaults applied for non-null column constraint
        assertThat(saved.getOpenTime()).isEqualTo(LocalTime.of(9, 0));
        assertThat(saved.getCloseTime()).isEqualTo(LocalTime.of(21, 0));

        verify(storefrontCacheService).evictShopDetails(shopId);
    }

    @Test
    @DisplayName("Closed days preserve existing times if present")
    void shouldAcceptClosedDayWithEqualOrInvertedTimesWithoutError() {
        ShopBusinessHoursRequest request = new ShopBusinessHoursRequest();
        request.setDayOfWeek("SATURDAY");
        request.setIsOpen(false);
        request.setOpenTime(LocalTime.of(12, 0));
        request.setCloseTime(LocalTime.of(12, 0));

        when(shopBusinessHoursRepository.findByShopIdAndDayOfWeek(shopId, "SATURDAY"))
                .thenReturn(Optional.empty());
        when(shopBusinessHoursRepository.save(any(ShopBusinessHours.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        ShopBusinessHours saved = ownerStorefrontService.saveBusinessHour(ownerId, request);

        assertThat(saved).isNotNull();
        assertThat(saved.getIsOpen()).isFalse();
        assertThat(saved.getOpenTime()).isEqualTo(LocalTime.of(12, 0));
        assertThat(saved.getCloseTime()).isEqualTo(LocalTime.of(12, 0));
    }

    @Test
    @DisplayName("Invalid day of week is rejected")
    void shouldRejectInvalidDayOfWeek() {
        ShopBusinessHoursRequest request = new ShopBusinessHoursRequest();
        request.setDayOfWeek("FUNDAY");
        request.setIsOpen(true);
        request.setOpenTime(LocalTime.of(9, 0));
        request.setCloseTime(LocalTime.of(18, 0));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                ownerStorefrontService.saveBusinessHour(ownerId, request)
        );

        assertThat(ex.getMessage()).contains("Invalid day of week: FUNDAY");
        verify(shopBusinessHoursRepository, never()).save(any());
    }

    @Test
    @DisplayName("Null or blank day of week is rejected")
    void shouldRejectBlankDayOfWeek() {
        ShopBusinessHoursRequest request = new ShopBusinessHoursRequest();
        request.setDayOfWeek("   ");
        request.setIsOpen(true);
        request.setOpenTime(LocalTime.of(9, 0));
        request.setCloseTime(LocalTime.of(18, 0));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                ownerStorefrontService.saveBusinessHour(ownerId, request)
        );

        assertThat(ex.getMessage()).contains("Day of week is required");
    }

    @Test
    @DisplayName("Null isOpen flag is rejected")
    void shouldRejectNullIsOpen() {
        ShopBusinessHoursRequest request = new ShopBusinessHoursRequest();
        request.setDayOfWeek("FRIDAY");
        request.setIsOpen(null);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                ownerStorefrontService.saveBusinessHour(ownerId, request)
        );

        assertThat(ex.getMessage()).contains("isOpen flag is required");
    }
}
