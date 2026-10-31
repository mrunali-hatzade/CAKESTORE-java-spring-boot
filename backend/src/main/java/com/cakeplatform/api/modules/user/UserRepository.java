package com.cakeplatform.api.modules.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    Optional<User> findByEmailIgnoreCase(String email);
    Optional<User> findByMobile(String mobile);
    @org.springframework.data.jpa.repository.Query(value = "SELECT * FROM users WHERE mobile = ?", nativeQuery = true)
    Optional<User> findByMobileIncludingDeleted(String mobile);
    boolean existsByEmailIgnoreCase(String email);
    boolean existsByMobile(String mobile);
    
    java.util.List<User> findByRole(UserRole role);
    java.util.List<User> findByRoleAndStatus(UserRole role, UserStatus status);
    long countByRole(UserRole role);

    @org.springframework.data.jpa.repository.Query(value = "SELECT COUNT(*) FROM users WHERE role = 'ADMIN'", nativeQuery = true)
    long countAllAdminsIncludingDeleted();

    @org.springframework.data.jpa.repository.Query(value = "SELECT COUNT(*) FROM users WHERE LOWER(email) = LOWER(?1)", nativeQuery = true)
    long countByEmailIgnoreCaseIncludingDeleted(String email);
    
    long countByCreatedAtGreaterThanEqual(java.time.LocalDateTime startOfDay);
    long countByCreatedAtBetween(java.time.LocalDateTime start, java.time.LocalDateTime end);
    
    @org.springframework.data.jpa.repository.Query(value = "SELECT COUNT(*) FROM users WHERE is_deleted = true", nativeQuery = true)
    long countDeletedUsers();
}
