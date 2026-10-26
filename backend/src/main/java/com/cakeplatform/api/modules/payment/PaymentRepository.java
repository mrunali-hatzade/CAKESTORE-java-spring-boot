package com.cakeplatform.api.modules.payment;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, Long> {
    List<Payment> findByShopId(Long shopId);
    List<Payment> findByShopIdOrderByCreatedAtDesc(Long shopId);
    java.util.Optional<Payment> findByProviderPaymentId(String providerPaymentId);
    java.util.Optional<Payment> findByProviderOrderId(String providerOrderId);
    java.util.Optional<Payment> findByIdAndShopId(Long id, Long shopId);
    void deleteByShopId(Long shopId);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Payment p WHERE p.id = :id")
    java.util.Optional<Payment> findByIdWithLock(@org.springframework.data.repository.query.Param("id") Long id);

    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM Payment p WHERE p.status = 'COMPLETED' AND (p.subscription IS NOT NULL OR p.plan IS NOT NULL)")
    BigDecimal getTotalRevenue();

    @Query("SELECT COUNT(p) FROM Payment p WHERE p.status = 'COMPLETED' AND (p.subscription IS NOT NULL OR p.plan IS NOT NULL) AND (p.paidAt >= :startOfDay OR (p.paidAt IS NULL AND p.createdAt >= :startOfDay))")
    long countTodayCompletedPayments(@org.springframework.data.repository.query.Param("startOfDay") java.time.LocalDateTime startOfDay);

    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM Payment p WHERE p.status = 'COMPLETED' AND (p.subscription IS NOT NULL OR p.plan IS NOT NULL) AND (p.paidAt >= :startOfMonth OR (p.paidAt IS NULL AND p.createdAt >= :startOfMonth))")
    BigDecimal getMonthlyRevenue(@org.springframework.data.repository.query.Param("startOfMonth") java.time.LocalDateTime startOfMonth);

    @Query("SELECT COUNT(p) FROM Payment p WHERE p.status = 'COMPLETED' AND (p.subscription IS NOT NULL OR p.plan IS NOT NULL) AND p.createdAt BETWEEN :start AND :end")
    long countCompletedPaymentsBetween(@org.springframework.data.repository.query.Param("start") java.time.LocalDateTime start, @org.springframework.data.repository.query.Param("end") java.time.LocalDateTime end);

    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM Payment p WHERE p.status = 'COMPLETED' AND (p.subscription IS NOT NULL OR p.plan IS NOT NULL) AND p.createdAt BETWEEN :start AND :end")
    BigDecimal getRevenueBetween(@org.springframework.data.repository.query.Param("start") java.time.LocalDateTime start, @org.springframework.data.repository.query.Param("end") java.time.LocalDateTime end);

    @Query("SELECT p FROM Payment p WHERE p.shop.id = :shopId AND (p.subscription IS NOT NULL OR p.plan IS NOT NULL) ORDER BY p.createdAt DESC")
    Page<Payment> findSubscriptionPaymentsByShopId(@org.springframework.data.repository.query.Param("shopId") Long shopId, Pageable pageable);

    @Query("SELECT p FROM Payment p WHERE p.shop.id = :shopId AND (p.subscription IS NOT NULL OR p.plan IS NOT NULL) ORDER BY p.createdAt DESC")
    List<Payment> findSubscriptionPaymentsByShopId(@org.springframework.data.repository.query.Param("shopId") Long shopId);

    @Query(value = "SELECT to_char(p.created_at, 'YYYY-MM') AS period, COALESCE(SUM(p.amount), 0) AS total " +
                   "FROM payments p " +
                   "WHERE p.status = 'COMPLETED' " +
                   "  AND (p.subscription_id IS NOT NULL OR p.plan_id IS NOT NULL) " +
                   "  AND p.created_at >= :startDate " +
                   "GROUP BY to_char(p.created_at, 'YYYY-MM') " +
                   "ORDER BY to_char(p.created_at, 'YYYY-MM') ASC", nativeQuery = true)
    List<Object[]> getMonthlySubscriptionRevenueSince(@org.springframework.data.repository.query.Param("startDate") java.time.LocalDateTime startDate);

    @Query("SELECT p FROM Payment p " +
           "WHERE (:shopId IS NULL OR p.shop.id = :shopId) " +
           "AND (:status IS NULL OR :status = 'ALL' OR p.status = :status) " +
           "AND (:type IS NULL OR :type = 'ALL' " +
           "     OR (:type = 'SUBSCRIPTION' AND (p.subscription IS NOT NULL OR p.plan IS NOT NULL)) " +
           "     OR (:type = 'RETAIL_ORDER' AND p.subscription IS NULL AND p.plan IS NULL " +
           "         AND EXISTS (SELECT 1 FROM Order o WHERE o.shop.id = p.shop.id AND (" +
           "             (p.providerPaymentId IS NOT NULL AND o.transactionId = p.providerPaymentId) " +
           "             OR (p.providerOrderId IS NOT NULL AND (o.razorpayOrderId = p.providerOrderId OR o.transactionId = p.providerOrderId)) " +
           "             OR (p.failureReason IS NOT NULL AND p.failureReason = CONCAT('ORDER:', o.orderNumber))" +
           "         ))) " +
           "     OR ((:type = 'UNKNOWN' OR :type = 'UNLINKED' OR :type = 'UNLINKED_GATEWAY_RECORD') " +
           "         AND p.subscription IS NULL AND p.plan IS NULL " +
           "         AND NOT EXISTS (SELECT 1 FROM Order o WHERE o.shop.id = p.shop.id AND (" +
           "             (p.providerPaymentId IS NOT NULL AND o.transactionId = p.providerPaymentId) " +
           "             OR (p.providerOrderId IS NOT NULL AND (o.razorpayOrderId = p.providerOrderId OR o.transactionId = p.providerOrderId)) " +
           "             OR (p.failureReason IS NOT NULL AND p.failureReason = CONCAT('ORDER:', o.orderNumber))" +
           "         )))) " +
           "AND p.createdAt >= :startDate " +
           "AND p.createdAt <= :endDate " +
           "AND (:query IS NULL OR :query = '' " +
           "  OR LOWER(COALESCE(p.providerPaymentId, '')) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "  OR LOWER(COALESCE(p.providerOrderId, '')) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "  OR LOWER(COALESCE(p.failureReason, '')) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "  OR LOWER(COALESCE(p.shop.businessName, '')) LIKE LOWER(CONCAT('%', :query, '%'))) " +
           "ORDER BY p.createdAt DESC")
    Page<Payment> findAdminCrossShopPayments(
           @Param("shopId") Long shopId,
           @Param("status") String status,
           @Param("type") String type,
           @Param("startDate") LocalDateTime startDate,
           @Param("endDate") LocalDateTime endDate,
           @Param("query") String query,
           Pageable pageable);
}
