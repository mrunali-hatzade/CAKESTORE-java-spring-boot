package com.cakeplatform.api.modules.admin;

import com.cakeplatform.api.modules.subscription.SubscriptionPlan;
import com.cakeplatform.api.modules.subscription.SubscriptionPlanRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;

import org.springframework.security.test.context.support.WithMockUser;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.reset;

/**
 * Integration test verifying real Spring transaction rollback behavior on
 * AdminSubscriptionPlanController.reorderPlans.
 *
 * Verifies that:
 * 1. Valid reordering commits atomically to the database.
 * 2. When a persistence failure occurs mid-transaction after SQL UPDATEs are flushed,
 *    Spring's @Transactional boundary rolls back the transaction, preserving original
 *    display orders verified via raw native SQL queries.
 * 3. Validation failures abort before persistence and preserve database state.
 */
@SpringBootTest
@ActiveProfiles("test")
@WithMockUser(roles = "ADMIN")
public class AdminSubscriptionPlanRollbackIntegrationTest {

    @Autowired
    private AdminSubscriptionPlanController controller;

    @SpyBean
    private SubscriptionPlanRepository planRepository;

    @Autowired
    private EntityManager entityManager;

    private Map<Long, Integer> baselineOrders = new HashMap<>();

    @BeforeEach
    void setUp() {
        reset(planRepository);

        // Ensure at least 3 plans exist in database for meaningful permutation reordering
        List<SubscriptionPlan> existing = planRepository.findAll();
        while (existing.size() < 3) {
            SubscriptionPlan p = new SubscriptionPlan();
            p.setName("Rollback Test Plan " + (existing.size() + 1));
            p.setDescription("Generated for transaction rollback integration test");
            p.setPrice(new BigDecimal("299.00"));
            p.setBillingCycle("monthly");
            p.setCurrency("INR");
            p.setDurationDays(30);
            p.setIsActive(true);
            p.setDisplayOrder(existing.size());
            planRepository.save(p);
            existing = planRepository.findAll();
        }

        // Establish known sequential display orders (0, 1, 2...)
        for (int i = 0; i < existing.size(); i++) {
            existing.get(i).setDisplayOrder(i);
        }
        planRepository.saveAll(existing);
        entityManager.clear();

        // Record baseline orders
        baselineOrders.clear();
        for (SubscriptionPlan p : planRepository.findAll()) {
            baselineOrders.put(p.getId(), p.getDisplayOrder());
        }
    }

    @AfterEach
    void tearDown() {
        reset(planRepository);
    }

    @Test
    @DisplayName("Success path: Valid reorder commits new display orders to real database")
    void testReorderPlans_Success_CommitsToDatabase() {
        List<SubscriptionPlan> currentPlans = planRepository.findAllByOrderByDisplayOrderAsc();
        List<Long> reversedIds = new ArrayList<>(currentPlans.stream().map(SubscriptionPlan::getId).toList());
        Collections.reverse(reversedIds);

        controller.reorderPlans(reversedIds);

        entityManager.clear();

        for (int i = 0; i < reversedIds.size(); i++) {
            Long planId = reversedIds.get(i);
            Number orderInDb = (Number) entityManager.createNativeQuery(
                    "SELECT display_order FROM subscription_plans WHERE id = :id")
                    .setParameter("id", planId)
                    .getSingleResult();

            assertThat(orderInDb.intValue())
                    .as("Plan ID %d display_order in DB must match committed index %d", planId, i)
                    .isEqualTo(i);
        }
    }

    @Test
    @DisplayName("Rollback path: Persistence failure after SQL flush rolls back all display orders")
    void testReorderPlans_PersistenceFailure_RollsBackTransaction() {
        List<SubscriptionPlan> currentPlans = planRepository.findAllByOrderByDisplayOrderAsc();
        List<Long> reversedIds = new ArrayList<>(currentPlans.stream().map(SubscriptionPlan::getId).toList());
        Collections.reverse(reversedIds);

        // Force a deterministic persistence failure mid-transaction:
        // Merge mutated plans, flush SQL UPDATE statements to PostgreSQL, then throw DataIntegrityViolationException.
        doAnswer(invocation -> {
            List<SubscriptionPlan> plansToSave = invocation.getArgument(0);
            for (SubscriptionPlan p : plansToSave) {
                entityManager.merge(p);
            }
            // Flush updates to PostgreSQL wire inside active transaction
            entityManager.flush();

            // Simulate database error occurring right after flush
            throw new DataIntegrityViolationException("Simulated database failure during batch save");
        }).when(planRepository).saveAll(any());

        // Verify that the exception escapes reorderPlans
        assertThrows(DataIntegrityViolationException.class, () -> controller.reorderPlans(reversedIds));

        // Reset spy so subsequent query uses real repository method
        reset(planRepository);

        // Clear Hibernate persistence context to guarantee queries hit the actual database table
        entityManager.clear();

        // Verify via raw native SQL query that EVERY plan retained its exact baseline displayOrder
        for (Map.Entry<Long, Integer> entry : baselineOrders.entrySet()) {
            Long planId = entry.getKey();
            Integer expectedBaselineOrder = entry.getValue();

            Number orderInDb = (Number) entityManager.createNativeQuery(
                    "SELECT display_order FROM subscription_plans WHERE id = :id")
                    .setParameter("id", planId)
                    .getSingleResult();

            assertThat(orderInDb.intValue())
                    .as("Native DB check: Plan ID %d must retain baseline order %d after transaction rollback",
                            planId, expectedBaselineOrder)
                    .isEqualTo(expectedBaselineOrder);
        }
    }

    @Test
    @DisplayName("Validation failure path: Partial list rejected before save and leaves database unchanged")
    void testReorderPlans_ValidationFailure_LeavesDatabaseUnchanged() {
        List<SubscriptionPlan> currentPlans = planRepository.findAllByOrderByDisplayOrderAsc();
        // Submit partial list (only 1 plan out of N)
        List<Long> partialList = List.of(currentPlans.get(0).getId());

        assertThrows(IllegalArgumentException.class, () -> controller.reorderPlans(partialList));

        entityManager.clear();

        for (Map.Entry<Long, Integer> entry : baselineOrders.entrySet()) {
            Number orderInDb = (Number) entityManager.createNativeQuery(
                    "SELECT display_order FROM subscription_plans WHERE id = :id")
                    .setParameter("id", entry.getKey())
                    .getSingleResult();

            assertThat(orderInDb.intValue())
                    .as("Native DB check: Plan ID %d must retain baseline order %d after validation failure",
                            entry.getKey(), entry.getValue())
                    .isEqualTo(entry.getValue());
        }
    }
}
