package com.cakeplatform.api.modules.shop;

import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;
import java.util.List;

public class ShopSpecification {

    /**
     * Builds a Spring Data JPA Specification to filter shops by structured location parameters,
     * business type, and search keywords while strictly restricting to ACTIVE status.
     *
     * @param state        State name (optional, case-insensitive)
     * @param district     District name (optional, case-insensitive)
     * @param city         City/Town name (optional, case-insensitive)
     * @param area         Area/Village name (optional, case-insensitive)
     * @param businessType BusinessType enum (optional)
     * @param search       General search term (optional, searches businessName, description, businessCategory, city, area)
     * @param location     Legacy location parameter (optional, searches city, pincode, area, address)
     * @return Specification<Shop>
     */
    public static Specification<Shop> filterShops(
            String state,
            String district,
            String city,
            String area,
            BusinessType businessType,
            String search,
            String location
    ) {
        return filterShops(state, district, city, area, null, null, businessType, search, location);
    }

    public static Specification<Shop> filterShops(
            String state,
            String district,
            String city,
            String area,
            String pincode,
            String country,
            BusinessType businessType,
            String search,
            String location
    ) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            // 1. ALWAYS filter strictly by ACTIVE status. Never expose PENDING, INACTIVE, or SUSPENDED.
            predicates.add(cb.equal(root.get("status"), ShopStatus.ACTIVE));

            // 1b. Enforce owner enabled and marketplace restriction predicates (decoupled lifecycle)
            predicates.add(cb.isTrue(root.get("isOwnerEnabled")));
            predicates.add(cb.isFalse(root.get("isMarketplaceRestricted")));

            // 2. State filter (case-insensitive, trimmed)
            if (StringUtils.hasText(state) && !isAllFilter(state)) {
                predicates.add(cb.equal(cb.lower(cb.trim(root.get("state"))), state.trim().toLowerCase()));
            }

            // 3. District filter (case-insensitive, trimmed)
            if (StringUtils.hasText(district) && !isAllFilter(district)) {
                predicates.add(cb.equal(cb.lower(cb.trim(root.get("district"))), district.trim().toLowerCase()));
            }

            // 4. City filter (case-insensitive, trimmed)
            if (StringUtils.hasText(city) && !isAllFilter(city)) {
                predicates.add(cb.equal(cb.lower(cb.trim(root.get("city"))), city.trim().toLowerCase()));
            }

            // 5. Area filter (case-insensitive, trimmed)
            if (StringUtils.hasText(area) && !isAllFilter(area)) {
                predicates.add(cb.equal(cb.lower(cb.trim(root.get("area"))), area.trim().toLowerCase()));
            }

            // 6. Pincode filter (trimmed)
            if (StringUtils.hasText(pincode) && !isAllFilter(pincode)) {
                predicates.add(cb.equal(cb.trim(root.get("pincode")), pincode.trim()));
            }

            // 7. BusinessType filter
            if (businessType != null) {
                predicates.add(cb.equal(root.get("businessType"), businessType));
            }

            // 8. General search keyword across public shop fields
            if (StringUtils.hasText(search)) {
                String searchPattern = "%" + search.trim().toLowerCase() + "%";
                Predicate searchPredicate = cb.or(
                        cb.like(cb.lower(root.get("businessName")), searchPattern),
                        cb.like(cb.lower(cb.coalesce(root.get("description"), "")), searchPattern),
                        cb.like(cb.lower(cb.coalesce(root.get("businessCategory"), "")), searchPattern),
                        cb.like(cb.lower(cb.coalesce(root.get("city"), "")), searchPattern),
                        cb.like(cb.lower(cb.coalesce(root.get("area"), "")), searchPattern)
                );
                predicates.add(searchPredicate);
            }

            // 9. Legacy location query (backward compatibility)
            if (StringUtils.hasText(location)) {
                String locPattern = "%" + location.trim().toLowerCase() + "%";
                Predicate locPredicate = cb.or(
                        cb.like(cb.lower(cb.coalesce(root.get("city"), "")), locPattern),
                        cb.equal(cb.coalesce(root.get("pincode"), ""), location.trim()),
                        cb.like(cb.lower(cb.coalesce(root.get("area"), "")), locPattern),
                        cb.like(cb.lower(cb.coalesce(root.get("address"), "")), locPattern)
                );
                predicates.add(locPredicate);
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private static boolean isAllFilter(String value) {
        String trimmed = value.trim().toLowerCase();
        return trimmed.equals("all") || trimmed.startsWith("all ");
    }
}
