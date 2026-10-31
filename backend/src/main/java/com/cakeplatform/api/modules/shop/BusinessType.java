package com.cakeplatform.api.modules.shop;

public enum BusinessType {
    HOME_BAKERY,
    BAKERY_SHOP,
    CAKE_STUDIO,
    ONLINE_CAKE_BUSINESS,
    OTHER;

    /**
     * Resolves a raw string into a canonical BusinessType.
     * Supports canonical enum names (case-insensitive) as well as legacy frontend aliases:
     * - HOME_BAKER -> HOME_BAKERY
     * - PASTRY_SHOP -> BAKERY_SHOP
     * - CUSTOM_CAKE_STUDIO -> CAKE_STUDIO
     * - COMMERCIAL_BAKERY -> ONLINE_CAKE_BUSINESS
     *
     * @param raw the input string (trimmed and normalized)
     * @return the resolved canonical BusinessType, or null if raw is null or blank
     * @throws IllegalArgumentException if raw is non-blank and cannot be mapped to any known type
     */
    public static BusinessType fromString(String raw) {
        if (raw == null || raw.trim().isEmpty()) {
            return null;
        }
        String normalized = raw.trim().toUpperCase().replace('-', '_');

        // 1. Check canonical enum constants
        for (BusinessType type : BusinessType.values()) {
            if (type.name().equals(normalized)) {
                return type;
            }
        }

        // 2. Check explicit legacy aliases
        switch (normalized) {
            case "HOME_BAKER":
                return HOME_BAKERY;
            case "PASTRY_SHOP":
                return BAKERY_SHOP;
            case "CUSTOM_CAKE_STUDIO":
                return CAKE_STUDIO;
            case "COMMERCIAL_BAKERY":
                return ONLINE_CAKE_BUSINESS;
            default:
                throw new IllegalArgumentException(
                        "Invalid business type: '" + raw + "'. Supported types: HOME_BAKERY, BAKERY_SHOP, CAKE_STUDIO, ONLINE_CAKE_BUSINESS, OTHER (or legacy aliases: HOME_BAKER, PASTRY_SHOP, CUSTOM_CAKE_STUDIO, COMMERCIAL_BAKERY)"
                );
        }
    }
}

