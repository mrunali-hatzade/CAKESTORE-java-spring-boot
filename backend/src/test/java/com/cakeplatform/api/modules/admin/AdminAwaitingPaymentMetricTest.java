package com.cakeplatform.api.modules.admin;

import com.cakeplatform.api.modules.payment.Payment;
import com.cakeplatform.api.modules.payment.PaymentRepository;
import com.cakeplatform.api.modules.shop.Shop;
import com.cakeplatform.api.modules.shop.ShopRepository;
import com.cakeplatform.api.modules.shop.ShopStatus;
import com.cakeplatform.api.modules.subscription.Subscription;
import com.cakeplatform.api.modules.subscription.SubscriptionPlan;
import com.cakeplatform.api.modules.subscription.SubscriptionPlanRepository;
import com.cakeplatform.api.modules.subscription.SubscriptionRepository;
import com.cakeplatform.api.modules.subscription.SubscriptionStatus;
import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.modules.user.UserRepository;
import com.cakeplatform.api.modules.user.UserRole;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
public class AdminAwaitingPaymentMetricTest {

    @Autowired
    private ShopRepository shopRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SubscriptionRepository subscriptionRepository;

    @Autowired
    private PaymentRepository paymentRepository;

    @Autowired
    private SubscriptionPlanRepository subscriptionPlanRepository;

    private User createTestUser() {
        User user = new User();
        user.setEmail("owner_" + UUID.randomUUID() + "@example.com");
        user.setPasswordHash("password123");
        user.setFullName("Bakery Owner");
        user.setRole(UserRole.SHOP_OWNER);
        long randomSuffix = (long) (Math.random() * 900000000L) + 100000000L;
        user.setMobile("9" + randomSuffix);
        return userRepository.save(user);
    }

    private Shop createTestShop(User owner, ShopStatus status) {
        Shop shop = new Shop();
        shop.setOwner(owner);
        shop.setBusinessName("Cake Studio " + UUID.randomUUID());
        shop.setStatus(status);
        shop.setPhone("9876543210");
        shop.setAddress("123 Street");
        shop.setCity("Mumbai");
        shop.setState("Maharashtra");
        shop.setPincode("400001");
        return shopRepository.save(shop);
    }

    @Test
    @DisplayName("Verify comprehensive lifecycle counting rules for Awaiting Initial Subscription Payment")
    void testAwaitingPaymentLifecycleScenarios() {
        long baseCount = shopRepository.countBakeriesAwaitingInitialSubscription();

        // Scenario 1: New registration without checkout attempt -> Count increments by 1
        User user1 = createTestUser();
        Shop shop1 = createTestShop(user1, ShopStatus.PENDING);
        assertEquals(baseCount + 1, shopRepository.countBakeriesAwaitingInitialSubscription());

        // Scenario 2: Checkout initiated (Pending payment record exists) -> Count remains 1 (no double counting)
        SubscriptionPlan plan = subscriptionPlanRepository.findAll().stream().findFirst().orElseGet(() -> {
            SubscriptionPlan newPlan = new SubscriptionPlan();
            newPlan.setName("Basic Monthly");
            newPlan.setPrice(BigDecimal.valueOf(350));
            newPlan.setDurationDays(30);
            newPlan.setIsActive(true);
            return subscriptionPlanRepository.save(newPlan);
        });

        Payment payment1 = new Payment();
        payment1.setShop(shop1);
        payment1.setPlan(plan);
        payment1.setAmount(BigDecimal.valueOf(350));
        payment1.setCurrency("INR");
        payment1.setProvider("RAZORPAY");
        payment1.setStatus("PENDING");
        paymentRepository.save(payment1);

        assertEquals(baseCount + 1, shopRepository.countBakeriesAwaitingInitialSubscription(),
                "Pending checkout attempt should still count as exactly 1 awaiting payment");

        // Scenario 3: Multiple payment attempts on same shop -> Count remains 1 (no duplication)
        Payment payment2 = new Payment();
        payment2.setShop(shop1);
        payment2.setPlan(plan);
        payment2.setAmount(BigDecimal.valueOf(350));
        payment2.setCurrency("INR");
        payment2.setProvider("RAZORPAY");
        payment2.setStatus("FAILED");
        payment2.setFailureReason("Bank gateway timeout");
        paymentRepository.save(payment2);

        assertEquals(baseCount + 1, shopRepository.countBakeriesAwaitingInitialSubscription(),
                "Multiple checkout/failed payment attempts must not double-count the bakery");

        // Scenario 4: Successful payment verification activates subscription -> Removed from Awaiting Payment
        Subscription sub1 = new Subscription();
        sub1.setShop(shop1);
        sub1.setPlan(plan);
        sub1.setStatus(SubscriptionStatus.ACTIVE);
        sub1.setAmount(BigDecimal.valueOf(350));
        sub1.setStartDate(LocalDateTime.now());
        sub1.setExpiryDate(LocalDateTime.now().plusDays(30));
        subscriptionRepository.save(sub1);

        shop1.setStatus(ShopStatus.ACTIVE);
        shopRepository.save(shop1);

        assertEquals(baseCount, shopRepository.countBakeriesAwaitingInitialSubscription(),
                "Bakery with active subscription entitlement must be removed from Awaiting Payment");

        // Scenario 5: Bakery with expired subscription -> Counted under Expired, NOT Awaiting Payment
        User user2 = createTestUser();
        Shop shop2 = createTestShop(user2, ShopStatus.EXPIRED);

        Subscription sub2 = new Subscription();
        sub2.setShop(shop2);
        sub2.setPlan(plan);
        sub2.setStatus(SubscriptionStatus.EXPIRED);
        sub2.setAmount(BigDecimal.valueOf(350));
        sub2.setStartDate(LocalDateTime.now().minusDays(60));
        sub2.setExpiryDate(LocalDateTime.now().minusDays(30));
        subscriptionRepository.save(sub2);

        assertEquals(baseCount, shopRepository.countBakeriesAwaitingInitialSubscription(),
                "Bakery that previously activated a subscription and expired must NOT be in Awaiting Payment");

        // Scenario 6: Suspended bakery -> Excluded from Awaiting Payment
        User user3 = createTestUser();
        Shop shop3 = createTestShop(user3, ShopStatus.SUSPENDED);
        assertEquals(baseCount, shopRepository.countBakeriesAwaitingInitialSubscription(),
                "Suspended bakeries must be excluded from Awaiting Payment");

        // Scenario 7: Soft-deleted bakery -> Excluded from Awaiting Payment
        User user4 = createTestUser();
        Shop shop4 = createTestShop(user4, ShopStatus.PENDING);
        assertEquals(baseCount + 1, shopRepository.countBakeriesAwaitingInitialSubscription());

        shopRepository.delete(shop4); // executes soft-delete (@SQLDelete)
        assertEquals(baseCount, shopRepository.countBakeriesAwaitingInitialSubscription(),
                "Soft-deleted bakeries must be excluded from Awaiting Payment");
    }
}
