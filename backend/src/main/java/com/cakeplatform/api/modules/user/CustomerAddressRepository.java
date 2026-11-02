package com.cakeplatform.api.modules.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CustomerAddressRepository extends JpaRepository<CustomerAddress, Long> {
    List<CustomerAddress> findByCustomerIdOrderByIsDefaultDescCreatedAtDesc(Long customerId);
    
    Optional<CustomerAddress> findByIdAndCustomerId(Long id, Long customerId);

    Optional<CustomerAddress> findByCustomerIdAndIsDefaultTrue(Long customerId);

    long countByCustomerId(Long customerId);
}
