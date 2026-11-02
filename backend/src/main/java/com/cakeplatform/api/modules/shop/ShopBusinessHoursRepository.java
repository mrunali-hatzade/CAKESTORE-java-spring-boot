package com.cakeplatform.api.modules.shop;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface ShopBusinessHoursRepository extends JpaRepository<ShopBusinessHours, Long> {
    List<ShopBusinessHours> findByShopId(Long shopId);
    List<ShopBusinessHours> findByShopIdIn(Collection<Long> shopIds);
    Optional<ShopBusinessHours> findByShopIdAndDayOfWeek(Long shopId, String dayOfWeek);
    void deleteByShopId(Long shopId);
}
