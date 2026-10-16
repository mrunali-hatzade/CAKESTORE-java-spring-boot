package com.cakeplatform.api.modules.notification;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BroadcastHistoryRepository extends JpaRepository<BroadcastHistory, Long>, BroadcastHistoryRepositoryCustom {
    List<BroadcastHistory> findAllByOrderBySentAtDesc();
    Optional<BroadcastHistory> findByIdempotencyKey(UUID idempotencyKey);
}
