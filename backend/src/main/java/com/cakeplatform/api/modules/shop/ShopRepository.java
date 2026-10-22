package com.cakeplatform.api.modules.shop;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ShopRepository extends JpaRepository<Shop, Long>, JpaSpecificationExecutor<Shop> {
    List<Shop> findByOwnerId(Long ownerId);
    java.util.Optional<Shop> findFirstByOwnerId(Long ownerId);
    boolean existsByOwnerId(Long ownerId);
    long countByStatus(ShopStatus status);
    long countByVerificationStatus(VerificationStatus status);
    long countByVerificationStatusAndCreatedAtBetween(VerificationStatus status, java.time.LocalDateTime start, java.time.LocalDateTime end);
    List<Shop> findByStatus(ShopStatus status);
    long countByStatusAndCreatedAtBetween(ShopStatus status, java.time.LocalDateTime start, java.time.LocalDateTime end);
    long countByCreatedAtBetween(java.time.LocalDateTime start, java.time.LocalDateTime end);
    
    @Query(value = "SELECT COUNT(*) FROM shops WHERE is_deleted = true", nativeQuery = true)
    long countDeletedShops();

    @Query(value = "SELECT * FROM shops WHERE id = :id", nativeQuery = true)
    java.util.Optional<Shop> findByIdIncludingDeleted(@Param("id") Long id);

    @Query("SELECT COUNT(s) FROM Shop s WHERE s.status != com.cakeplatform.api.modules.shop.ShopStatus.SUSPENDED " +
           "AND s.id NOT IN (SELECT sub.shop.id FROM Subscription sub WHERE sub.status = com.cakeplatform.api.modules.subscription.SubscriptionStatus.ACTIVE) " +
           "AND s.id NOT IN (SELECT sub.shop.id FROM Subscription sub WHERE sub.status = com.cakeplatform.api.modules.subscription.SubscriptionStatus.EXPIRED)")
    long countBakeriesAwaitingInitialSubscription();
    
    @Query("SELECT s FROM Shop s WHERE " +
           "(:status IS NULL OR s.status = :status) AND " +
           "(:search IS NULL OR LOWER(s.businessName) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(s.owner.fullName) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(s.owner.email) LIKE LOWER(CONCAT('%', :search, '%')))")
    org.springframework.data.domain.Page<Shop> searchAndFilterAllShops(@Param("status") ShopStatus status, @Param("search") String search, org.springframework.data.domain.Pageable pageable);

    @Query(value = "SELECT s.id as shopId, s.business_name as businessName, u.full_name as ownerName, u.email as ownerEmail, s.status as shopStatus, s.created_at as registeredAt " +
           "FROM shops s LEFT JOIN users u ON s.owner_id = u.id " +
           "WHERE s.is_deleted = true AND " +
           "(:search IS NULL OR LOWER(s.business_name) LIKE LOWER(CONCAT('%', CAST(:search AS text), '%')) " +
           "OR LOWER(u.full_name) LIKE LOWER(CONCAT('%', CAST(:search AS text), '%')) " +
           "OR LOWER(u.email) LIKE LOWER(CONCAT('%', CAST(:search AS text), '%')))",
           countQuery = "SELECT count(*) FROM shops s LEFT JOIN users u ON s.owner_id = u.id " +
           "WHERE s.is_deleted = true AND " +
           "(:search IS NULL OR LOWER(s.business_name) LIKE LOWER(CONCAT('%', CAST(:search AS text), '%')) " +
           "OR LOWER(u.full_name) LIKE LOWER(CONCAT('%', CAST(:search AS text), '%')) " +
           "OR LOWER(u.email) LIKE LOWER(CONCAT('%', CAST(:search AS text), '%')))",
           nativeQuery = true)
    org.springframework.data.domain.Page<com.cakeplatform.api.modules.admin.dto.AdminShopSummaryProjection> searchAndFilterDeletedShopsProjection(@Param("search") String search, org.springframework.data.domain.Pageable pageable);

    @Query("SELECT s FROM Shop s WHERE s.status = :status AND (" +
           "LOWER(s.city) LIKE LOWER(CONCAT('%', :location, '%')) OR " +
           "LOWER(COALESCE(s.district, '')) LIKE LOWER(CONCAT('%', :location, '%')) OR " +
           "LOWER(COALESCE(s.state, '')) LIKE LOWER(CONCAT('%', :location, '%')) OR " +
           "s.pincode = :location OR " +
           "LOWER(s.area) LIKE LOWER(CONCAT('%', :location, '%')) OR " +
           "LOWER(s.address) LIKE LOWER(CONCAT('%', :location, '%')))")
    List<Shop> searchByLocationAndStatus(@Param("location") String location, @Param("status") ShopStatus status);

    @Query(value = "SELECT s.city AS city_name, s.state AS state_name, COUNT(s.id) AS active_bakery_count " +
                   "FROM shops s " +
                   "WHERE s.status = 'ACTIVE' AND s.is_deleted = false " +
                   "  AND COALESCE(s.is_owner_enabled, true) = true AND COALESCE(s.is_marketplace_restricted, false) = false " +
                   "  AND s.city IS NOT NULL AND TRIM(s.city) != '' " +
                   "GROUP BY s.city, s.state " +
                   "ORDER BY COUNT(s.id) DESC, s.city ASC",
           nativeQuery = true)
    List<com.cakeplatform.api.modules.storefront.dto.PopularCityProjection> findPopularCities();

    @Query(value = "SELECT " +
                   "s.id AS id, " +
                   "s.business_name AS business_name, " +
                   "s.description AS description, " +
                   "s.business_type AS business_type, " +
                   "s.business_category AS business_category, " +
                   "s.logo_url AS logo_url, " +
                   "s.cover_image_url AS cover_image_url, " +
                   "s.address AS address, " +
                   "s.address_line_1 AS address_line_1, " +
                   "s.address_line_2 AS address_line_2, " +
                   "s.area AS area, " +
                   "s.city AS city, " +
                   "s.district AS district, " +
                   "s.state AS state, " +
                   "s.pincode AS pincode, " +
                   "s.latitude AS latitude, " +
                   "s.longitude AS longitude, " +
                   "s.status AS status, " +
                   "s.verification_status AS verification_status, " +
                   "ROUND(CAST(AVG(f.rating) AS numeric), 1) AS avg_rating, " +
                   "COUNT(f.id) AS total_reviews, " +
                   "(6371 * acos(LEAST(1.0, GREATEST(-1.0, " +
                   "  cos(radians(:lat)) * cos(radians(s.latitude)) * " +
                   "  cos(radians(s.longitude) - radians(:lng)) + " +
                   "  sin(radians(:lat)) * sin(radians(s.latitude)) " +
                   ")))) AS distance_km " +
                   "FROM shops s " +
                   "LEFT JOIN feedback f ON f.shop_id = s.id AND f.is_approved = true " +
                   "WHERE s.status = 'ACTIVE' AND s.is_deleted = false " +
                   "  AND COALESCE(s.is_owner_enabled, true) = true " +
                   "  AND COALESCE(s.is_marketplace_restricted, false) = false " +
                   "  AND s.latitude IS NOT NULL " +
                   "  AND s.longitude IS NOT NULL " +
                   "  AND s.latitude BETWEEN :minLat AND :maxLat " +
                   "  AND s.longitude BETWEEN :minLng AND :maxLng " +
                   "  AND (CAST(:city AS text) IS NULL OR LOWER(TRIM(s.city)) = LOWER(TRIM(CAST(:city AS text)))) " +
                   "  AND (CAST(:state AS text) IS NULL OR LOWER(TRIM(s.state)) = LOWER(TRIM(CAST(:state AS text)))) " +
                   "  AND (CAST(:district AS text) IS NULL OR LOWER(TRIM(s.district)) = LOWER(TRIM(CAST(:district AS text)))) " +
                   "  AND (CAST(:area AS text) IS NULL OR LOWER(TRIM(s.area)) = LOWER(TRIM(CAST(:area AS text)))) " +
                   "  AND (CAST(:pincode AS text) IS NULL OR s.pincode = CAST(:pincode AS text)) " +
                   "  AND (CAST(:businessType AS text) IS NULL OR s.business_type = CAST(:businessType AS text)) " +
                   "  AND (CAST(:search AS text) IS NULL OR ( " +
                   "      LOWER(s.business_name) LIKE LOWER(CONCAT('%', CAST(:search AS text), '%')) OR " +
                   "      LOWER(COALESCE(s.description, '')) LIKE LOWER(CONCAT('%', CAST(:search AS text), '%')) OR " +
                   "      LOWER(COALESCE(s.business_category, '')) LIKE LOWER(CONCAT('%', CAST(:search AS text), '%')) " +
                   "  )) " +
                   "GROUP BY s.id " +
                   "HAVING (6371 * acos(LEAST(1.0, GREATEST(-1.0, " +
                   "  cos(radians(:lat)) * cos(radians(s.latitude)) * " +
                   "  cos(radians(s.longitude) - radians(:lng)) + " +
                   "  sin(radians(:lat)) * sin(radians(s.latitude)) " +
                   ")))) <= :radiusKm " +
                   "ORDER BY distance_km ASC " +
                   "LIMIT :limit OFFSET :offset",
           nativeQuery = true)
    List<com.cakeplatform.api.modules.storefront.dto.ShopSummaryProjection> findNearbyActiveShopsOrderByDistance(
            @Param("lat") double lat, @Param("lng") double lng, @Param("minLat") double minLat, @Param("maxLat") double maxLat,
            @Param("minLng") double minLng, @Param("maxLng") double maxLng, @Param("radiusKm") double radiusKm,
            @Param("city") String city, @Param("state") String state, @Param("district") String district,
            @Param("area") String area, @Param("pincode") String pincode, @Param("businessType") String businessType,
            @Param("search") String search, @Param("limit") int limit, @Param("offset") int offset
    );

    @Query(value = "SELECT " +
                   "s.id AS id, s.business_name AS business_name, s.description AS description, " +
                   "s.city AS city, s.state AS state, s.district AS district, s.area AS area, " +
                   "s.address AS address, s.pincode AS pincode, s.latitude AS latitude, s.longitude AS longitude, " +
                   "s.business_type AS business_type, s.business_category AS business_category, s.status AS status, " +
                   "s.verification_status AS verification_status, ROUND(CAST(AVG(f.rating) AS numeric), 1) AS avg_rating, " +
                   "COUNT(f.id) AS total_reviews, " +
                   "(6371 * acos(LEAST(1.0, GREATEST(-1.0, cos(radians(:lat)) * cos(radians(s.latitude)) * cos(radians(s.longitude) - radians(:lng)) + sin(radians(:lat)) * sin(radians(s.latitude)))))) AS distance_km " +
                   "FROM shops s LEFT JOIN feedback f ON f.shop_id = s.id AND f.is_approved = true " +
                   "WHERE s.status = 'ACTIVE' AND s.is_deleted = false " +
                   "  AND COALESCE(s.is_owner_enabled, true) = true " +
                   "  AND COALESCE(s.is_marketplace_restricted, false) = false " +
                   "  AND s.latitude IS NOT NULL AND s.longitude IS NOT NULL " +
                   "  AND s.latitude BETWEEN :minLat AND :maxLat AND s.longitude BETWEEN :minLng AND :maxLng " +
                   "  AND (CAST(:city AS text) IS NULL OR LOWER(TRIM(s.city)) = LOWER(TRIM(CAST(:city AS text)))) " +
                   "  AND (CAST(:state AS text) IS NULL OR LOWER(TRIM(s.state)) = LOWER(TRIM(CAST(:state AS text)))) " +
                   "  AND (CAST(:district AS text) IS NULL OR LOWER(TRIM(s.district)) = LOWER(TRIM(CAST(:district AS text)))) " +
                   "  AND (CAST(:area AS text) IS NULL OR LOWER(TRIM(s.area)) = LOWER(TRIM(CAST(:area AS text)))) " +
                   "  AND (CAST(:pincode AS text) IS NULL OR s.pincode = CAST(:pincode AS text)) " +
                   "  AND (CAST(:businessType AS text) IS NULL OR s.business_type = CAST(:businessType AS text)) " +
                   "  AND (CAST(:search AS text) IS NULL OR ( LOWER(s.business_name) LIKE LOWER(CONCAT('%', CAST(:search AS text), '%')) OR LOWER(COALESCE(s.description, '')) LIKE LOWER(CONCAT('%', CAST(:search AS text), '%')) OR LOWER(COALESCE(s.business_category, '')) LIKE LOWER(CONCAT('%', CAST(:search AS text), '%')) )) " +
                   "GROUP BY s.id " +
                   "HAVING (6371 * acos(LEAST(1.0, GREATEST(-1.0, cos(radians(:lat)) * cos(radians(s.latitude)) * cos(radians(s.longitude) - radians(:lng)) + sin(radians(:lat)) * sin(radians(s.latitude)))))) <= :radiusKm " +
                   "ORDER BY AVG(f.rating) DESC NULLS LAST, COUNT(f.id) DESC NULLS LAST, distance_km ASC " +
                   "LIMIT :limit OFFSET :offset",
           nativeQuery = true)
    List<com.cakeplatform.api.modules.storefront.dto.ShopSummaryProjection> findNearbyActiveShopsOrderByRating(
            @Param("lat") double lat, @Param("lng") double lng, @Param("minLat") double minLat, @Param("maxLat") double maxLat,
            @Param("minLng") double minLng, @Param("maxLng") double maxLng, @Param("radiusKm") double radiusKm,
            @Param("city") String city, @Param("state") String state, @Param("district") String district,
            @Param("area") String area, @Param("pincode") String pincode, @Param("businessType") String businessType,
            @Param("search") String search, @Param("limit") int limit, @Param("offset") int offset
    );

    @Query(value = "SELECT " +
                   "s.id AS id, s.business_name AS business_name, s.description AS description, " +
                   "s.city AS city, s.state AS state, s.district AS district, s.area AS area, " +
                   "s.address AS address, s.pincode AS pincode, s.latitude AS latitude, s.longitude AS longitude, " +
                   "s.business_type AS business_type, s.business_category AS business_category, s.status AS status, " +
                   "s.verification_status AS verification_status, ROUND(CAST(AVG(f.rating) AS numeric), 1) AS avg_rating, " +
                   "COUNT(f.id) AS total_reviews, " +
                   "(6371 * acos(LEAST(1.0, GREATEST(-1.0, cos(radians(:lat)) * cos(radians(s.latitude)) * cos(radians(s.longitude) - radians(:lng)) + sin(radians(:lat)) * sin(radians(s.latitude)))))) AS distance_km " +
                   "FROM shops s LEFT JOIN feedback f ON f.shop_id = s.id AND f.is_approved = true " +
                   "WHERE s.status = 'ACTIVE' AND s.is_deleted = false " +
                   "  AND COALESCE(s.is_owner_enabled, true) = true " +
                   "  AND COALESCE(s.is_marketplace_restricted, false) = false " +
                   "  AND s.latitude IS NOT NULL AND s.longitude IS NOT NULL " +
                   "  AND s.latitude BETWEEN :minLat AND :maxLat AND s.longitude BETWEEN :minLng AND :maxLng " +
                   "  AND (CAST(:city AS text) IS NULL OR LOWER(TRIM(s.city)) = LOWER(TRIM(CAST(:city AS text)))) " +
                   "  AND (CAST(:state AS text) IS NULL OR LOWER(TRIM(s.state)) = LOWER(TRIM(CAST(:state AS text)))) " +
                   "  AND (CAST(:district AS text) IS NULL OR LOWER(TRIM(s.district)) = LOWER(TRIM(CAST(:district AS text)))) " +
                   "  AND (CAST(:area AS text) IS NULL OR LOWER(TRIM(s.area)) = LOWER(TRIM(CAST(:area AS text)))) " +
                   "  AND (CAST(:pincode AS text) IS NULL OR s.pincode = CAST(:pincode AS text)) " +
                   "  AND (CAST(:businessType AS text) IS NULL OR s.business_type = CAST(:businessType AS text)) " +
                   "  AND (CAST(:search AS text) IS NULL OR ( LOWER(s.business_name) LIKE LOWER(CONCAT('%', CAST(:search AS text), '%')) OR LOWER(COALESCE(s.description, '')) LIKE LOWER(CONCAT('%', CAST(:search AS text), '%')) OR LOWER(COALESCE(s.business_category, '')) LIKE LOWER(CONCAT('%', CAST(:search AS text), '%')) )) " +
                   "GROUP BY s.id " +
                   "HAVING (6371 * acos(LEAST(1.0, GREATEST(-1.0, cos(radians(:lat)) * cos(radians(s.latitude)) * cos(radians(s.longitude) - radians(:lng)) + sin(radians(:lat)) * sin(radians(s.latitude)))))) <= :radiusKm " +
                   "ORDER BY s.created_at DESC NULLS LAST, distance_km ASC " +
                   "LIMIT :limit OFFSET :offset",
           nativeQuery = true)
    List<com.cakeplatform.api.modules.storefront.dto.ShopSummaryProjection> findNearbyActiveShopsOrderByNewest(
            @Param("lat") double lat, @Param("lng") double lng, @Param("minLat") double minLat, @Param("maxLat") double maxLat,
            @Param("minLng") double minLng, @Param("maxLng") double maxLng, @Param("radiusKm") double radiusKm,
            @Param("city") String city, @Param("state") String state, @Param("district") String district,
            @Param("area") String area, @Param("pincode") String pincode, @Param("businessType") String businessType,
            @Param("search") String search, @Param("limit") int limit, @Param("offset") int offset
    );

    @Query(value = "SELECT COUNT(*) FROM ( " +
                   "  SELECT s.id " +
                   "  FROM shops s " +
                   "  WHERE s.status = 'ACTIVE' AND s.is_deleted = false " +
                   "    AND COALESCE(s.is_owner_enabled, true) = true " +
                   "    AND COALESCE(s.is_marketplace_restricted, false) = false " +
                   "    AND s.latitude IS NOT NULL " +
                   "    AND s.longitude IS NOT NULL " +
                   "    AND s.latitude BETWEEN :minLat AND :maxLat " +
                   "    AND s.longitude BETWEEN :minLng AND :maxLng " +
                   "    AND (CAST(:city AS text) IS NULL OR LOWER(TRIM(s.city)) = LOWER(TRIM(CAST(:city AS text)))) " +
                   "    AND (CAST(:state AS text) IS NULL OR LOWER(TRIM(s.state)) = LOWER(TRIM(CAST(:state AS text)))) " +
                   "    AND (CAST(:district AS text) IS NULL OR LOWER(TRIM(s.district)) = LOWER(TRIM(CAST(:district AS text)))) " +
                   "    AND (CAST(:area AS text) IS NULL OR LOWER(TRIM(s.area)) = LOWER(TRIM(CAST(:area AS text)))) " +
                   "    AND (CAST(:pincode AS text) IS NULL OR s.pincode = CAST(:pincode AS text)) " +
                   "    AND (CAST(:businessType AS text) IS NULL OR s.business_type = CAST(:businessType AS text)) " +
                   "    AND (CAST(:search AS text) IS NULL OR ( " +
                   "        LOWER(s.business_name) LIKE LOWER(CONCAT('%', CAST(:search AS text), '%')) OR " +
                   "        LOWER(COALESCE(s.description, '')) LIKE LOWER(CONCAT('%', CAST(:search AS text), '%')) OR " +
                   "        LOWER(COALESCE(s.business_category, '')) LIKE LOWER(CONCAT('%', CAST(:search AS text), '%')) " +
                   "    )) " +
                   "    AND (6371 * acos(LEAST(1.0, GREATEST(-1.0, " +
                   "      cos(radians(:lat)) * cos(radians(s.latitude)) * " +
                   "      cos(radians(s.longitude) - radians(:lng)) + " +
                   "      sin(radians(:lat)) * sin(radians(s.latitude)) " +
                   "    )))) <= :radiusKm " +
                   ") sub",
           nativeQuery = true)
    long countNearbyActiveShops(
            @Param("lat") double lat,
            @Param("lng") double lng,
            @Param("minLat") double minLat,
            @Param("maxLat") double maxLat,
            @Param("minLng") double minLng,
            @Param("maxLng") double maxLng,
            @Param("radiusKm") double radiusKm,
            @Param("city") String city,
            @Param("state") String state,
            @Param("district") String district,
            @Param("area") String area,
            @Param("pincode") String pincode,
            @Param("businessType") String businessType,
            @Param("search") String search
    );

    @Query(value = "SELECT " +
                   "s.id AS id, " +
                   "s.business_name AS business_name, " +
                   "s.description AS description, " +
                   "s.business_type AS business_type, " +
                   "s.business_category AS business_category, " +
                   "s.logo_url AS logo_url, " +
                   "s.cover_image_url AS cover_image_url, " +
                   "s.address AS address, " +
                   "s.address_line_1 AS address_line_1, " +
                   "s.address_line_2 AS address_line_2, " +
                   "s.area AS area, " +
                   "s.city AS city, " +
                   "s.district AS district, " +
                   "s.state AS state, " +
                   "s.pincode AS pincode, " +
                   "s.latitude AS latitude, " +
                   "s.longitude AS longitude, " +
                   "s.status AS status, " +
                   "s.verification_status AS verification_status, " +
                   "ROUND(CAST(AVG(f.rating) AS numeric), 1) AS avg_rating, " +
                   "COUNT(f.id) AS total_reviews, " +
                   "CAST(NULL AS double precision) AS distance_km " +
                   "FROM shops s " +
                   "LEFT JOIN feedback f ON f.shop_id = s.id AND f.is_approved = true " +
                   "WHERE s.status = 'ACTIVE' AND s.is_deleted = false " +
                   "  AND COALESCE(s.is_owner_enabled, true) = true " +
                   "  AND COALESCE(s.is_marketplace_restricted, false) = false " +
                   "  AND (CAST(:city AS text) IS NULL OR LOWER(TRIM(s.city)) = LOWER(TRIM(CAST(:city AS text)))) " +
                   "  AND (CAST(:state AS text) IS NULL OR LOWER(TRIM(s.state)) = LOWER(TRIM(CAST(:state AS text)))) " +
                   "  AND (CAST(:district AS text) IS NULL OR LOWER(TRIM(s.district)) = LOWER(TRIM(CAST(:district AS text)))) " +
                   "  AND (CAST(:area AS text) IS NULL OR LOWER(TRIM(s.area)) = LOWER(TRIM(CAST(:area AS text)))) " +
                   "  AND (CAST(:pincode AS text) IS NULL OR s.pincode = CAST(:pincode AS text)) " +
                   "  AND (CAST(:businessType AS text) IS NULL OR s.business_type = CAST(:businessType AS text)) " +
                   "  AND (CAST(:search AS text) IS NULL OR ( " +
                   "      LOWER(s.business_name) LIKE LOWER(CONCAT('%', CAST(:search AS text), '%')) OR " +
                   "      LOWER(COALESCE(s.description, '')) LIKE LOWER(CONCAT('%', CAST(:search AS text), '%')) OR " +
                   "      LOWER(COALESCE(s.business_category, '')) LIKE LOWER(CONCAT('%', CAST(:search AS text), '%')) OR " +
                   "      LOWER(COALESCE(s.city, '')) LIKE LOWER(CONCAT('%', CAST(:search AS text), '%')) OR " +
                   "      LOWER(COALESCE(s.area, '')) LIKE LOWER(CONCAT('%', CAST(:search AS text), '%')) " +
                   "  )) " +
                   "  AND (CAST(:location AS text) IS NULL OR ( " +
                   "      LOWER(COALESCE(s.city, '')) LIKE LOWER(CONCAT('%', CAST(:location AS text), '%')) OR " +
                   "      LOWER(COALESCE(s.district, '')) LIKE LOWER(CONCAT('%', CAST(:location AS text), '%')) OR " +
                   "      LOWER(COALESCE(s.state, '')) LIKE LOWER(CONCAT('%', CAST(:location AS text), '%')) OR " +
                   "      s.pincode = CAST(:location AS text) OR " +
                   "      LOWER(COALESCE(s.area, '')) LIKE LOWER(CONCAT('%', CAST(:location AS text), '%')) OR " +
                   "      LOWER(COALESCE(s.address, '')) LIKE LOWER(CONCAT('%', CAST(:location AS text), '%')) " +
                   "  )) " +
                   "GROUP BY s.id " +
                   "ORDER BY AVG(f.rating) DESC NULLS LAST, COUNT(f.id) DESC NULLS LAST, s.id DESC " +
                   "LIMIT :limit OFFSET :offset",
           nativeQuery = true)
    List<com.cakeplatform.api.modules.storefront.dto.ShopSummaryProjection> findActiveShopsWithSummaryOrderByRating(
            @Param("city") String city, @Param("state") String state, @Param("district") String district,
            @Param("area") String area, @Param("pincode") String pincode, @Param("businessType") String businessType,
            @Param("search") String search, @Param("location") String location,
            @Param("limit") int limit, @Param("offset") int offset
    );

    @Query(value = "SELECT " +
                   "s.id AS id, s.business_name AS business_name, s.description AS description, " +
                   "s.city AS city, s.state AS state, s.district AS district, s.area AS area, " +
                   "s.address AS address, s.pincode AS pincode, s.latitude AS latitude, s.longitude AS longitude, " +
                   "s.business_type AS business_type, s.business_category AS business_category, s.status AS status, " +
                   "s.verification_status AS verification_status, ROUND(CAST(AVG(f.rating) AS numeric), 1) AS avg_rating, " +
                   "COUNT(f.id) AS total_reviews, CAST(NULL AS double precision) AS distance_km " +
                   "FROM shops s LEFT JOIN feedback f ON f.shop_id = s.id AND f.is_approved = true " +
                   "WHERE s.status = 'ACTIVE' AND s.is_deleted = false " +
                   "  AND COALESCE(s.is_owner_enabled, true) = true " +
                   "  AND COALESCE(s.is_marketplace_restricted, false) = false " +
                   "  AND (CAST(:city AS text) IS NULL OR LOWER(TRIM(s.city)) = LOWER(TRIM(CAST(:city AS text)))) " +
                   "  AND (CAST(:state AS text) IS NULL OR LOWER(TRIM(s.state)) = LOWER(TRIM(CAST(:state AS text)))) " +
                   "  AND (CAST(:district AS text) IS NULL OR LOWER(TRIM(s.district)) = LOWER(TRIM(CAST(:district AS text)))) " +
                   "  AND (CAST(:area AS text) IS NULL OR LOWER(TRIM(s.area)) = LOWER(TRIM(CAST(:area AS text)))) " +
                   "  AND (CAST(:pincode AS text) IS NULL OR s.pincode = CAST(:pincode AS text)) " +
                   "  AND (CAST(:businessType AS text) IS NULL OR s.business_type = CAST(:businessType AS text)) " +
                   "  AND (CAST(:search AS text) IS NULL OR ( LOWER(s.business_name) LIKE LOWER(CONCAT('%', CAST(:search AS text), '%')) OR LOWER(COALESCE(s.description, '')) LIKE LOWER(CONCAT('%', CAST(:search AS text), '%')) OR LOWER(COALESCE(s.business_category, '')) LIKE LOWER(CONCAT('%', CAST(:search AS text), '%')) OR LOWER(COALESCE(s.city, '')) LIKE LOWER(CONCAT('%', CAST(:search AS text), '%')) OR LOWER(COALESCE(s.area, '')) LIKE LOWER(CONCAT('%', CAST(:search AS text), '%')) )) " +
                   "  AND (CAST(:location AS text) IS NULL OR ( LOWER(COALESCE(s.city, '')) LIKE LOWER(CONCAT('%', CAST(:location AS text), '%')) OR LOWER(COALESCE(s.district, '')) LIKE LOWER(CONCAT('%', CAST(:location AS text), '%')) OR LOWER(COALESCE(s.state, '')) LIKE LOWER(CONCAT('%', CAST(:location AS text), '%')) OR s.pincode = CAST(:location AS text) OR LOWER(COALESCE(s.area, '')) LIKE LOWER(CONCAT('%', CAST(:location AS text), '%')) OR LOWER(COALESCE(s.address, '')) LIKE LOWER(CONCAT('%', CAST(:location AS text), '%')) )) " +
                   "GROUP BY s.id " +
                   "ORDER BY s.created_at DESC NULLS LAST, s.id DESC " +
                   "LIMIT :limit OFFSET :offset",
           nativeQuery = true)
    List<com.cakeplatform.api.modules.storefront.dto.ShopSummaryProjection> findActiveShopsWithSummaryOrderByNewest(
            @Param("city") String city, @Param("state") String state, @Param("district") String district,
            @Param("area") String area, @Param("pincode") String pincode, @Param("businessType") String businessType,
            @Param("search") String search, @Param("location") String location,
            @Param("limit") int limit, @Param("offset") int offset
    );

    @Query(value = "SELECT COUNT(s.id) " +
                   "FROM shops s " +
                   "WHERE s.status = 'ACTIVE' AND s.is_deleted = false " +
                   "  AND COALESCE(s.is_owner_enabled, true) = true " +
                   "  AND COALESCE(s.is_marketplace_restricted, false) = false " +
                   "  AND (CAST(:city AS text) IS NULL OR LOWER(TRIM(s.city)) = LOWER(TRIM(CAST(:city AS text)))) " +
                   "  AND (CAST(:state AS text) IS NULL OR LOWER(TRIM(s.state)) = LOWER(TRIM(CAST(:state AS text)))) " +
                   "  AND (CAST(:district AS text) IS NULL OR LOWER(TRIM(s.district)) = LOWER(TRIM(CAST(:district AS text)))) " +
                   "  AND (CAST(:area AS text) IS NULL OR LOWER(TRIM(s.area)) = LOWER(TRIM(CAST(:area AS text)))) " +
                   "  AND (CAST(:pincode AS text) IS NULL OR s.pincode = CAST(:pincode AS text)) " +
                   "  AND (CAST(:businessType AS text) IS NULL OR s.business_type = CAST(:businessType AS text)) " +
                   "  AND (CAST(:search AS text) IS NULL OR ( " +
                   "      LOWER(s.business_name) LIKE LOWER(CONCAT('%', CAST(:search AS text), '%')) OR " +
                   "      LOWER(COALESCE(s.description, '')) LIKE LOWER(CONCAT('%', CAST(:search AS text), '%')) OR " +
                   "      LOWER(COALESCE(s.business_category, '')) LIKE LOWER(CONCAT('%', CAST(:search AS text), '%')) OR " +
                   "      LOWER(COALESCE(s.city, '')) LIKE LOWER(CONCAT('%', CAST(:search AS text), '%')) OR " +
                   "      LOWER(COALESCE(s.area, '')) LIKE LOWER(CONCAT('%', CAST(:search AS text), '%')) " +
                   "  )) " +
                   "  AND (CAST(:location AS text) IS NULL OR ( " +
                   "      LOWER(COALESCE(s.city, '')) LIKE LOWER(CONCAT('%', CAST(:location AS text), '%')) OR " +
                   "      LOWER(COALESCE(s.district, '')) LIKE LOWER(CONCAT('%', CAST(:location AS text), '%')) OR " +
                   "      LOWER(COALESCE(s.state, '')) LIKE LOWER(CONCAT('%', CAST(:location AS text), '%')) OR " +
                   "      s.pincode = CAST(:location AS text) OR " +
                   "      LOWER(COALESCE(s.area, '')) LIKE LOWER(CONCAT('%', CAST(:location AS text), '%')) OR " +
                   "      LOWER(COALESCE(s.address, '')) LIKE LOWER(CONCAT('%', CAST(:location AS text), '%')) " +
                   "  ))",
           nativeQuery = true)
    long countActiveShops(
            @Param("city") String city,
            @Param("state") String state,
            @Param("district") String district,
            @Param("area") String area,
            @Param("pincode") String pincode,
            @Param("businessType") String businessType,
            @Param("search") String search,
            @Param("location") String location
    );
}
