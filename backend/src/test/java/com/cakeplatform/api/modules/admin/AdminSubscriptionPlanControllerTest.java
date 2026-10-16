package com.cakeplatform.api.modules.admin;

import com.cakeplatform.api.modules.subscription.SubscriptionPlan;
import com.cakeplatform.api.modules.subscription.SubscriptionPlanRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class AdminSubscriptionPlanControllerTest {

    @Mock
    private SubscriptionPlanRepository planRepository;

    @InjectMocks
    private AdminSubscriptionPlanController controller;

    private SubscriptionPlan plan1;
    private SubscriptionPlan plan2;
    private SubscriptionPlan plan3;

    @BeforeEach
    void setUp() {
        plan1 = new SubscriptionPlan();
        plan1.setId(10L);
        plan1.setName("Starter Plan");
        plan1.setPrice(new BigDecimal("499.00"));
        plan1.setBillingCycle("monthly");
        plan1.setDurationDays(30);
        plan1.setDisplayOrder(0);
        plan1.setIsActive(true);

        plan2 = new SubscriptionPlan();
        plan2.setId(20L);
        plan2.setName("Growth Plan");
        plan2.setPrice(new BigDecimal("999.00"));
        plan2.setBillingCycle("monthly");
        plan2.setDurationDays(30);
        plan2.setDisplayOrder(1);
        plan2.setIsActive(true);

        plan3 = new SubscriptionPlan();
        plan3.setId(30L);
        plan3.setName("Enterprise Annual");
        plan3.setPrice(new BigDecimal("9999.00"));
        plan3.setBillingCycle("yearly");
        plan3.setDurationDays(365);
        plan3.setDisplayOrder(2);
        plan3.setIsActive(true);
    }

    @Test
    @DisplayName("GET /api/admin/plans returns all plans ordered by displayOrder")
    void testGetAllPlans() {
        when(planRepository.findAllByOrderByDisplayOrderAsc()).thenReturn(List.of(plan1, plan2, plan3));

        ResponseEntity<List<SubscriptionPlan>> response = controller.getAllPlans();
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(3, response.getBody().size());
        assertEquals(10L, response.getBody().get(0).getId());
        assertEquals(20L, response.getBody().get(1).getId());
        assertEquals(30L, response.getBody().get(2).getId());
    }

    @Test
    @DisplayName("PS-D02/D03: reorderPlans with valid permutation updates displayOrder and calls saveAll")
    void testReorderPlans_Success() {
        when(planRepository.findAll()).thenReturn(List.of(plan1, plan2, plan3));

        // Reorder: 30, 10, 20
        List<Long> newOrder = List.of(30L, 10L, 20L);
        ResponseEntity<Void> response = controller.reorderPlans(newOrder);

        assertEquals(HttpStatus.OK, response.getStatusCode());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<SubscriptionPlan>> captor = ArgumentCaptor.forClass(List.class);
        verify(planRepository).saveAll(captor.capture());

        List<SubscriptionPlan> saved = captor.getValue();
        assertEquals(3, saved.size());

        assertEquals(0, plan3.getDisplayOrder());
        assertEquals(1, plan1.getDisplayOrder());
        assertEquals(2, plan2.getDisplayOrder());
    }

    @Test
    @DisplayName("PS-D03: reorderPlans with null payload throws IllegalArgumentException")
    void testReorderPlans_NullPayload_ThrowsException() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> controller.reorderPlans(null));
        assertTrue(ex.getMessage().contains("cannot be null or empty"));
        verify(planRepository, never()).saveAll(any());
    }

    @Test
    @DisplayName("PS-D03: reorderPlans with empty payload throws IllegalArgumentException")
    void testReorderPlans_EmptyPayload_ThrowsException() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> controller.reorderPlans(Collections.emptyList()));
        assertTrue(ex.getMessage().contains("cannot be null or empty"));
        verify(planRepository, never()).saveAll(any());
    }

    @Test
    @DisplayName("PS-D03: reorderPlans containing null elements throws IllegalArgumentException")
    void testReorderPlans_NullElement_ThrowsException() {
        List<Long> invalidList = Arrays.asList(10L, null, 20L);
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> controller.reorderPlans(invalidList));
        assertTrue(ex.getMessage().contains("cannot contain null elements"));
        verify(planRepository, never()).saveAll(any());
    }

    @Test
    @DisplayName("PS-D03: reorderPlans with duplicate IDs throws IllegalArgumentException")
    void testReorderPlans_DuplicateIds_ThrowsException() {
        List<Long> duplicateList = List.of(10L, 20L, 10L);
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> controller.reorderPlans(duplicateList));
        assertTrue(ex.getMessage().contains("cannot contain duplicate IDs"));
        verify(planRepository, never()).saveAll(any());
    }

    @Test
    @DisplayName("PS-D02: reorderPlans with partial list (missing plans) throws IllegalArgumentException")
    void testReorderPlans_PartialList_ThrowsException() {
        when(planRepository.findAll()).thenReturn(List.of(plan1, plan2, plan3));

        List<Long> partialList = List.of(10L, 20L); // Missing 30L
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> controller.reorderPlans(partialList));
        assertTrue(ex.getMessage().contains("must contain all 3 subscription plans"));
        verify(planRepository, never()).saveAll(any());
    }

    @Test
    @DisplayName("PS-D02: reorderPlans with non-existent ID throws IllegalArgumentException")
    void testReorderPlans_NonExistentId_ThrowsException() {
        when(planRepository.findAll()).thenReturn(List.of(plan1, plan2, plan3));

        List<Long> listWithUnknown = List.of(10L, 20L, 9999L);
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> controller.reorderPlans(listWithUnknown));
        assertTrue(ex.getMessage().contains("Plan ID not found: 9999"));
        verify(planRepository, never()).saveAll(any());
    }

    @Test
    @DisplayName("validatePlan: rejects empty name")
    void testValidatePlan_EmptyName() {
        SubscriptionPlan invalid = new SubscriptionPlan();
        invalid.setName("  ");
        invalid.setPrice(BigDecimal.TEN);
        invalid.setDurationDays(30);
        invalid.setBillingCycle("monthly");

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> controller.createPlan(invalid));
        assertTrue(ex.getMessage().contains("Plan name cannot be empty"));
    }

    @Test
    @DisplayName("validatePlan: rejects negative price")
    void testValidatePlan_NegativePrice() {
        SubscriptionPlan invalid = new SubscriptionPlan();
        invalid.setName("Valid Name");
        invalid.setPrice(new BigDecimal("-10.00"));
        invalid.setDurationDays(30);
        invalid.setBillingCycle("monthly");

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> controller.createPlan(invalid));
        assertTrue(ex.getMessage().contains("Plan price cannot be negative"));
    }

    @Test
    @DisplayName("validatePlan: rejects invalid billing cycle")
    void testValidatePlan_InvalidBillingCycle() {
        SubscriptionPlan invalid = new SubscriptionPlan();
        invalid.setName("Valid Name");
        invalid.setPrice(BigDecimal.TEN);
        invalid.setDurationDays(30);
        invalid.setBillingCycle("quarterly");

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> controller.createPlan(invalid));
        assertTrue(ex.getMessage().contains("Billing cycle must be 'monthly' or 'yearly'"));
    }
}
