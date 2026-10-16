package com.cakeplatform.api.modules.admin;

import com.cakeplatform.api.modules.subscription.SubscriptionPlan;
import com.cakeplatform.api.modules.subscription.SubscriptionPlanRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/plans")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
@RequiredArgsConstructor
public class AdminSubscriptionPlanController {

    private final SubscriptionPlanRepository planRepository;

    @GetMapping
    public ResponseEntity<List<SubscriptionPlan>> getAllPlans() {
        return ResponseEntity.ok(planRepository.findAllByOrderByDisplayOrderAsc());
    }

    @PostMapping
    public ResponseEntity<SubscriptionPlan> createPlan(@RequestBody SubscriptionPlan plan) {
        validatePlan(plan);
        return ResponseEntity.ok(planRepository.save(plan));
    }

    @PutMapping("/{id}")
    public ResponseEntity<SubscriptionPlan> updatePlan(@PathVariable Long id, @RequestBody SubscriptionPlan planUpdates) {
        SubscriptionPlan plan = planRepository.findById(id).orElseThrow();
        
        if (planUpdates.getName() != null) plan.setName(planUpdates.getName());
        if (planUpdates.getDescription() != null) plan.setDescription(planUpdates.getDescription());
        if (planUpdates.getBillingCycle() != null) plan.setBillingCycle(planUpdates.getBillingCycle());
        if (planUpdates.getPrice() != null) plan.setPrice(planUpdates.getPrice());
        if (planUpdates.getCurrency() != null) plan.setCurrency(planUpdates.getCurrency());
        if (planUpdates.getDurationDays() != null) plan.setDurationDays(planUpdates.getDurationDays());
        if (planUpdates.getFeatures() != null) plan.setFeatures(planUpdates.getFeatures());
        
        validatePlan(plan);
        return ResponseEntity.ok(planRepository.save(plan));
    }

    private void validatePlan(SubscriptionPlan plan) {
        if (plan.getName() == null || plan.getName().trim().isEmpty()) {
            throw new IllegalArgumentException("Plan name cannot be empty");
        }
        if (plan.getPrice() == null || plan.getPrice().compareTo(java.math.BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Plan price cannot be negative");
        }
        if (plan.getDurationDays() == null || plan.getDurationDays() <= 0) {
            throw new IllegalArgumentException("Duration days must be greater than zero");
        }
        if (plan.getBillingCycle() == null || (!plan.getBillingCycle().equalsIgnoreCase("monthly") && !plan.getBillingCycle().equalsIgnoreCase("yearly"))) {
            throw new IllegalArgumentException("Billing cycle must be 'monthly' or 'yearly'");
        }
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<SubscriptionPlan> togglePlanStatus(@PathVariable Long id, @RequestParam Boolean isActive) {
        SubscriptionPlan plan = planRepository.findById(id).orElseThrow();
        plan.setIsActive(isActive);
        return ResponseEntity.ok(planRepository.save(plan));
    }

    @Transactional
    @PutMapping("/reorder")
    public ResponseEntity<Void> reorderPlans(@RequestBody(required = false) List<Long> planIds) {
        if (planIds == null || planIds.isEmpty()) {
            throw new IllegalArgumentException("Plan IDs list cannot be null or empty");
        }

        for (Long id : planIds) {
            if (id == null) {
                throw new IllegalArgumentException("Plan IDs list cannot contain null elements");
            }
        }

        Set<Long> uniqueIds = new HashSet<>(planIds);
        if (uniqueIds.size() != planIds.size()) {
            throw new IllegalArgumentException("Plan IDs list cannot contain duplicate IDs");
        }

        List<SubscriptionPlan> allPlans = planRepository.findAll();
        if (allPlans.size() != planIds.size()) {
            throw new IllegalArgumentException(String.format(
                    "Reorder list must contain all %d subscription plans (received %d)",
                    allPlans.size(), planIds.size()));
        }

        Map<Long, SubscriptionPlan> planMap = allPlans.stream()
                .collect(Collectors.toMap(SubscriptionPlan::getId, p -> p));

        for (Long id : planIds) {
            if (!planMap.containsKey(id)) {
                throw new IllegalArgumentException("Plan ID not found: " + id);
            }
        }

        for (int i = 0; i < planIds.size(); i++) {
            SubscriptionPlan plan = planMap.get(planIds.get(i));
            plan.setDisplayOrder(i);
        }

        planRepository.saveAll(allPlans);
        return ResponseEntity.ok().build();
    }
}
