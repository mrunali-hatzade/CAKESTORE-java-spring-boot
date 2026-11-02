package com.cakeplatform.api.modules.shop.service;

import com.cakeplatform.api.modules.shop.Shop;
import com.cakeplatform.api.modules.shop.ShopBusinessHours;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.*;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("OperatingHoursService Unit Tests")
class OperatingHoursServiceTest {

    private OperatingHoursService operatingHoursService;
    private final ZoneId IST_ZONE = ZoneId.of("Asia/Kolkata");

    @BeforeEach
    void setUp() {
        operatingHoursService = new OperatingHoursService();
    }

    private ShopBusinessHours createHours(String day, boolean isOpen, LocalTime open, LocalTime close) {
        return ShopBusinessHours.builder()
                .dayOfWeek(day)
                .isOpen(isOpen)
                .openTime(open)
                .closeTime(close)
                .build();
    }

    @Test
    @DisplayName("1. Normal hours - Open during middle of the operating window")
    void testOpenDuringNormalHours() {
        // Monday 09:00 to 21:00
        List<ShopBusinessHours> hours = List.of(
                createHours("MONDAY", true, LocalTime.of(9, 0), LocalTime.of(21, 0))
        );

        // Monday at 14:30 IST
        LocalDate monday = LocalDate.of(2026, 11, 2); // 2026-11-02 is Monday
        Instant testInstant = ZonedDateTime.of(monday, LocalTime.of(14, 30), IST_ZONE).toInstant();

        boolean open = operatingHoursService.isShopOpen(hours, "Asia/Kolkata", testInstant);
        assertTrue(open, "Shop should be open at 14:30 on Monday when hours are 09:00 - 21:00");
        assertEquals("Open Now", operatingHoursService.getOpenStatusText(hours, "Asia/Kolkata", testInstant));
    }

    @Test
    @DisplayName("2. Normal hours - Closed before opening time")
    void testClosedBeforeOpeningTime() {
        List<ShopBusinessHours> hours = List.of(
                createHours("MONDAY", true, LocalTime.of(9, 0), LocalTime.of(21, 0))
        );

        // Monday at 08:59 IST
        LocalDate monday = LocalDate.of(2026, 11, 2);
        Instant testInstant = ZonedDateTime.of(monday, LocalTime.of(8, 59), IST_ZONE).toInstant();

        boolean open = operatingHoursService.isShopOpen(hours, "Asia/Kolkata", testInstant);
        assertFalse(open, "Shop should be closed at 08:59 when opening is 09:00");
        assertEquals("Closed", operatingHoursService.getOpenStatusText(hours, "Asia/Kolkata", testInstant));
    }

    @Test
    @DisplayName("3. Normal hours - Closed after closing time")
    void testClosedAfterClosingTime() {
        List<ShopBusinessHours> hours = List.of(
                createHours("MONDAY", true, LocalTime.of(9, 0), LocalTime.of(21, 0))
        );

        // Monday at 21:01 IST
        LocalDate monday = LocalDate.of(2026, 11, 2);
        Instant testInstant = ZonedDateTime.of(monday, LocalTime.of(21, 1), IST_ZONE).toInstant();

        boolean open = operatingHoursService.isShopOpen(hours, "Asia/Kolkata", testInstant);
        assertFalse(open, "Shop should be closed at 21:01 when closing is 21:00");
    }

    @Test
    @DisplayName("4. Normal hours - Exact opening boundary (inclusive)")
    void testExactOpeningBoundary() {
        List<ShopBusinessHours> hours = List.of(
                createHours("MONDAY", true, LocalTime.of(9, 0), LocalTime.of(21, 0))
        );

        // Monday at exactly 09:00:00 IST
        LocalDate monday = LocalDate.of(2026, 11, 2);
        Instant testInstant = ZonedDateTime.of(monday, LocalTime.of(9, 0, 0), IST_ZONE).toInstant();

        boolean open = operatingHoursService.isShopOpen(hours, "Asia/Kolkata", testInstant);
        assertTrue(open, "Shop should be open at exactly 09:00:00");
    }

    @Test
    @DisplayName("5. Normal hours - Exact closing boundary (exclusive)")
    void testExactClosingBoundary() {
        List<ShopBusinessHours> hours = List.of(
                createHours("MONDAY", true, LocalTime.of(9, 0), LocalTime.of(21, 0))
        );

        // Monday at exactly 21:00:00 IST
        LocalDate monday = LocalDate.of(2026, 11, 2);
        Instant testInstant = ZonedDateTime.of(monday, LocalTime.of(21, 0, 0), IST_ZONE).toInstant();

        boolean open = operatingHoursService.isShopOpen(hours, "Asia/Kolkata", testInstant);
        assertFalse(open, "Shop should be closed at exactly 21:00:00 (closing time boundary is exclusive)");
    }

    @Test
    @DisplayName("6. Closed weekday - Explicitly marked closed")
    void testClosedWeekday() {
        List<ShopBusinessHours> hours = List.of(
                createHours("SUNDAY", false, LocalTime.of(9, 0), LocalTime.of(21, 0))
        );

        // Sunday at 14:00 IST
        LocalDate sunday = LocalDate.of(2026, 11, 1); // 2026-11-01 is Sunday
        Instant testInstant = ZonedDateTime.of(sunday, LocalTime.of(14, 0), IST_ZONE).toInstant();

        boolean open = operatingHoursService.isShopOpen(hours, "Asia/Kolkata", testInstant);
        assertFalse(open, "Shop must be closed when isOpen=false for Sunday");
    }

    @Test
    @DisplayName("7. Overnight shift - Open during starting evening (20:00 to 02:00)")
    void testOvernightShiftStartingEvening() {
        // Friday overnight: 20:00 to 02:00
        List<ShopBusinessHours> hours = List.of(
                createHours("FRIDAY", true, LocalTime.of(20, 0), LocalTime.of(2, 0))
        );

        // Friday at 23:30 IST
        LocalDate friday = LocalDate.of(2026, 11, 6); // 2026-11-06 is Friday
        Instant testInstant = ZonedDateTime.of(friday, LocalTime.of(23, 30), IST_ZONE).toInstant();

        boolean open = operatingHoursService.isShopOpen(hours, "Asia/Kolkata", testInstant);
        assertTrue(open, "Shop should be open at 23:30 on Friday for 20:00 - 02:00 shift");
    }

    @Test
    @DisplayName("8. Overnight shift - Open during next morning past midnight (01:30 AM)")
    void testOvernightShiftNextDayMorning() {
        // Friday overnight: 20:00 to 02:00
        List<ShopBusinessHours> hours = List.of(
                createHours("FRIDAY", true, LocalTime.of(20, 0), LocalTime.of(2, 0)),
                createHours("SATURDAY", false, LocalTime.of(9, 0), LocalTime.of(21, 0)) // Saturday normal hours closed
        );

        // Saturday at 01:30 AM IST (within Friday night's shift)
        LocalDate saturday = LocalDate.of(2026, 11, 7); // 2026-11-07 is Saturday
        Instant testInstant = ZonedDateTime.of(saturday, LocalTime.of(1, 30), IST_ZONE).toInstant();

        boolean open = operatingHoursService.isShopOpen(hours, "Asia/Kolkata", testInstant);
        assertTrue(open, "Shop should be open at 01:30 Saturday under Friday's overnight shift");
    }

    @Test
    @DisplayName("9. Overnight shift - Closed after shift ends in the morning (02:01 AM)")
    void testOvernightShiftClosedAfterMorningClose() {
        List<ShopBusinessHours> hours = List.of(
                createHours("FRIDAY", true, LocalTime.of(20, 0), LocalTime.of(2, 0)),
                createHours("SATURDAY", false, LocalTime.of(9, 0), LocalTime.of(21, 0))
        );

        // Saturday at 02:01 AM IST
        LocalDate saturday = LocalDate.of(2026, 11, 7);
        Instant testInstant = ZonedDateTime.of(saturday, LocalTime.of(2, 1), IST_ZONE).toInstant();

        boolean open = operatingHoursService.isShopOpen(hours, "Asia/Kolkata", testInstant);
        assertFalse(open, "Shop should be closed at 02:01 Saturday when Friday overnight shift closed at 02:00");
    }

    @Test
    @DisplayName("10. Missing operating hours data - null or empty returns false safely")
    void testMissingOperatingHoursData() {
        Instant testInstant = Instant.now();

        assertFalse(operatingHoursService.isShopOpen(null, "Asia/Kolkata", testInstant));
        assertFalse(operatingHoursService.isShopOpen(Collections.emptyList(), "Asia/Kolkata", testInstant));
        assertFalse(operatingHoursService.isShopOpen(List.of(createHours("MONDAY", true, null, null)), "Asia/Kolkata", testInstant));
    }

    @Test
    @DisplayName("11. Invalid operating hours data - identical open and close time returns false")
    void testInvalidOperatingHoursData() {
        List<ShopBusinessHours> hours = List.of(
                createHours("MONDAY", true, LocalTime.of(9, 0), LocalTime.of(9, 0)) // 0 duration window
        );

        LocalDate monday = LocalDate.of(2026, 11, 2);
        Instant testInstant = ZonedDateTime.of(monday, LocalTime.of(9, 0), IST_ZONE).toInstant();

        assertFalse(operatingHoursService.isShopOpen(hours, "Asia/Kolkata", testInstant));
    }

    @Test
    @DisplayName("12. Timezone handling - Shop evaluated in its local configured timezone")
    void testTimezoneHandling() {
        // Shop open 09:00 to 18:00 in America/New_York (UTC-5 / UTC-4)
        List<ShopBusinessHours> hours = List.of(
                createHours("MONDAY", true, LocalTime.of(9, 0), LocalTime.of(18, 0))
        );

        // When it is Monday 10:00 AM in New York:
        // In UTC, that is Monday 15:00 UTC (during EDT) or 14:00 UTC
        ZoneId nyZone = ZoneId.of("America/New_York");
        LocalDate monday = LocalDate.of(2026, 11, 2);
        ZonedDateTime nyTime = ZonedDateTime.of(monday, LocalTime.of(10, 0), nyZone);
        Instant testInstant = nyTime.toInstant();

        // Evaluated in New York timezone -> Open
        assertTrue(operatingHoursService.isShopOpen(hours, "America/New_York", testInstant),
                "Shop should be open at 10:00 AM New York local time");

        // When it is Monday 20:00 (8 PM) in New York -> Closed
        ZonedDateTime nyNightTime = ZonedDateTime.of(monday, LocalTime.of(20, 0), nyZone);
        assertFalse(operatingHoursService.isShopOpen(hours, "America/New_York", nyNightTime.toInstant()),
                "Shop should be closed at 8:00 PM New York local time");
    }

    @Test
    @DisplayName("13. Shop entity convenience method and fallback timezone")
    void testShopEntityEvaluationWithFallbackTimezone() {
        Shop shop = new Shop();
        shop.setTimezone(null); // Will default to Asia/Kolkata
        shop.setBusinessHours(new ArrayList<>(List.of(
                createHours("WEDNESDAY", true, LocalTime.of(10, 0), LocalTime.of(20, 0))
        )));

        LocalDate wednesday = LocalDate.of(2026, 11, 4);
        Instant testInstant = ZonedDateTime.of(wednesday, LocalTime.of(15, 0), IST_ZONE).toInstant();

        assertTrue(operatingHoursService.isShopOpen(shop, testInstant));
        assertEquals("Open Now", operatingHoursService.getOpenStatusText(shop, testInstant));
    }
}

