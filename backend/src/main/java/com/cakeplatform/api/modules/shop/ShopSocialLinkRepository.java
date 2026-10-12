package com.cakeplatform.api.modules.shop;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ShopSocialLinkRepository extends JpaRepository<ShopSocialLink, Long> {
    List<ShopSocialLink> findByShopIdOrderByDisplayOrderAsc(Long shopId);
    List<ShopSocialLink> findByShopIdAndIsActiveTrueOrderByDisplayOrderAsc(Long shopId);
    Optional<ShopSocialLink> findByIdAndShopId(Long id, Long shopId);
}
