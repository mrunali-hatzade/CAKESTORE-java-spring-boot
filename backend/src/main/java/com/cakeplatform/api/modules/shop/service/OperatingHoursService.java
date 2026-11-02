package com.cakeplatform.api.modules.shop.service;

import com.cakeplatform.api.modules.shop.Shop;
import com.cakeplatform.api.modules.shop.ShopBusinessHours;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;

/**
 * Service for evaluating bakery operating hours, open-now status, and timezone-aware schedule calculations.
 * Supports regular daytime hours, overnight hours spanning midnight, closed days, and boundary conditions.
 */
@Slf4j
@Service
public class OperatingHoursService {

    public static final String DEFAULT_TIMEZONE = "Asia/Kolkata";

    /**
     * Determines whether a shop is open right now (system clock).
     */
    public boolean isShopOpen(List<ShopBusinessHours> hours, String timezoneStr) {
        return isShopOpen(hours, timezoneStr, Instant.now());
    }

    /**
     * Determines whether a shop is open at a given instant using its configured timezone.
     *
     * @param hours list of business hour records for the shop
     * @param timezoneStr timezone identifier (e.g. "Asia/Kolkata")
     * @param instant the moment in time to evaluate
     * @return true if the bakery is actively open, false otherwise or if hours cannot be reliably established
     */
    public boolean isShopOpen(List<ShopBusinessHours> hours, String timezoneStr, Instant instant) {
        if (hours == null || hours.isEmpty() || instant == null) {
            return false;
        }

        ZoneId zoneId = resolveZoneId(timezoneStr);
        ZonedDateTime zdt = instant.atZone(zoneId);
        DayOfWeek currentDay = zdt.getDayOfWeek();
        LocalTime currentTime = zdt.toLocalTime();
        DayOfWeek previousDay = currentDay.minus(1);

        // 1. Evaluate today's scheduled shift
        ShopBusinessHours todayHours = findHoursForDay(hours, currentDay);
        if (todayHours != null && Boolean.TRUE.equals(todayHours.getIsOpen())) {
            LocalTime open = todayHours.getOpenTime();
            LocalTime close = todayHours.getCloseTime();

            if (isValidTimeWindow(open, close)) {
                if (open.isBefore(close)) {
                    // Standard daytime hours: open <= currentTime < close
                    if (!currentTime.isBefore(open) && currentTime.isBefore(close)) {
                        return true;
                    }
                } else {
                    // Overnight shift starting today: open <= currentTime (until 23:59:59.999...)
                    if (!currentTime.isBefore(open)) {
                        return true;
                    }
                }
            }
        }

        // 2. Evaluate yesterday's overnight shift extending into today morning
        ShopBusinessHours yesterdayHours = findHoursForDay(hours, previousDay);
        if (yesterdayHours != null && Boolean.TRUE.equals(yesterdayHours.getIsOpen())) {
            LocalTime open = yesterdayHours.getOpenTime();
            LocalTime close = yesterdayHours.getCloseTime();

            if (isValidTimeWindow(open, close) && open.isAfter(close)) {
                // Overnight shift from yesterday: extends past midnight until yesterday's close
                if (currentTime.isBefore(close)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Evaluates open status for a Shop entity.
     */
    public boolean isShopOpen(Shop shop, Instant instant) {
        if (shop == null) return false;
        return isShopOpen(shop.getBusinessHours(), shop.getTimezone(), instant);
    }

    public boolean isShopOpen(Shop shop) {
        return isShopOpen(shop, Instant.now());
    }

    /**
     * Generates a user-facing label (e.g., "Open Now" or "Closed").
     */
    public String getOpenStatusText(List<ShopBusinessHours> hours, String timezoneStr, Instant instant) {
        boolean open = isShopOpen(hours, timezoneStr, instant);
        return open ? "Open Now" : "Closed";
    }

    public String getOpenStatusText(Shop shop, Instant instant) {
        if (shop == null) return "Closed";
        return getOpenStatusText(shop.getBusinessHours(), shop.getTimezone(), instant);
    }

    public String getOpenStatusText(Shop shop) {
        return getOpenStatusText(shop, Instant.now());
    }

    /**
     * Resolves a ZoneId safely, defaulting to Asia/Kolkata on null, blank, or invalid zone names.
     */
    public ZoneId resolveZoneId(String timezoneStr) {
        if (timezoneStr == null || timezoneStr.isBlank()) {
            return ZoneId.of(DEFAULT_TIMEZONE);
        }
        try {
            return ZoneId.of(timezoneStr.trim());
        } catch (Exception e) {
            log.warn("Invalid timezone string '{}', defaulting to {}", timezoneStr, DEFAULT_TIMEZONE);
            return ZoneId.of(DEFAULT_TIMEZONE);
        }
    }

    private ShopBusinessHours findHoursForDay(List<ShopBusinessHours> hours, DayOfWeek day) {
        String dayName = day.name();
        for (ShopBusinessHours h : hours) {
            if (h.getDayOfWeek() != null && h.getDayOfWeek().trim().equalsIgnoreCase(dayName)) {
                return h;
            }
        }
        return null;
    }

    private boolean isValidTimeWindow(LocalTime open, LocalTime close) {
        return open != null && close != null && !open.equals(close);
    }
}

