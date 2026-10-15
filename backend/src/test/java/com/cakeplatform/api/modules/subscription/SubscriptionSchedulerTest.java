package com.cakeplatform.api.modules.subscription;

import com.cakeplatform.api.modules.notification.NotificationService;
import com.cakeplatform.api.modules.notification.AdminNotificationService;
import com.cakeplatform.api.modules.shop.Shop;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SubscriptionSchedulerTest {

    @Mock
    private SubscriptionRepository subscriptionRepository;
    
    @Mock
    private SubscriptionService subscriptionService;
    
    @Mock
    private NotificationService notificationService;
    
    @Mock
    private AdminNotificationService adminNotificationService;

    @InjectMocks
    private SubscriptionScheduler subscriptionScheduler;

    @BeforeEach
    void setUp() {
    }

    @Test
    void testSchedulerProcessesActiveSubscriptionsAndExpires() {
        Subscription activeToDie = new Subscription();
        activeToDie.setId(10L);
        activeToDie.setStatus(SubscriptionStatus.ACTIVE);
        activeToDie.setExpiryDate(LocalDateTime.now().minusDays(1)); // expired
        Shop shop = new Shop();
        shop.setId(1L);
        activeToDie.setShop(shop);

        Subscription activeToLive = new Subscription();
        activeToLive.setId(20L);
        activeToLive.setStatus(SubscriptionStatus.ACTIVE);
        activeToLive.setExpiryDate(LocalDateTime.now().plusDays(20)); // not expiring
        activeToLive.setShop(shop);

        when(subscriptionRepository.findByStatus(SubscriptionStatus.ACTIVE))
                .thenReturn(List.of(activeToDie, activeToLive));

        subscriptionScheduler.processSubscriptionExpiries();

        // Verify only ACTIVE subscriptions were requested
        verify(subscriptionRepository).findByStatus(SubscriptionStatus.ACTIVE);
        // Verify we no longer use findAll()
        verify(subscriptionRepository, never()).findAll();
        
        // Verify expiration behavior remains unchanged
        verify(subscriptionService).expireSubscription(10L);
        verify(subscriptionService, never()).expireSubscription(20L);
    }

    @Test
    void testRenewalRemindersSuppressedForCancelledSubscriptions() {
        Shop shop = new Shop();
        shop.setId(1L);
        shop.setBusinessName("Sweet Delights");
        com.cakeplatform.api.modules.user.User owner = new com.cakeplatform.api.modules.user.User();
        owner.setId(99L);
        shop.setOwner(owner);

        // Sub 1: 3 days remaining, cancelledAt is SET -> Should NOT receive reminder
        Subscription cancelledExpiring = new Subscription();
        cancelledExpiring.setId(30L);
        cancelledExpiring.setStatus(SubscriptionStatus.ACTIVE);
        cancelledExpiring.setExpiryDate(LocalDateTime.now().plusDays(3));
        cancelledExpiring.setCancelledAt(LocalDateTime.now().minusDays(2));
        cancelledExpiring.setShop(shop);

        // Sub 2: 3 days remaining, cancelledAt is NULL -> SHOULD receive reminder
        Subscription activeExpiring = new Subscription();
        activeExpiring.setId(31L);
        activeExpiring.setStatus(SubscriptionStatus.ACTIVE);
        activeExpiring.setExpiryDate(LocalDateTime.now().plusDays(3));
        activeExpiring.setCancelledAt(null);
        activeExpiring.setShop(shop);

        when(subscriptionRepository.findByStatus(SubscriptionStatus.ACTIVE))
                .thenReturn(List.of(cancelledExpiring, activeExpiring));

        subscriptionScheduler.processSubscriptionExpiries();

        // Sub 2 (active) receives notification
        verify(notificationService, times(1)).createNotification(
                eq(owner),
                eq(com.cakeplatform.api.modules.notification.NotificationType.SUBSCRIPTION_EXPIRING),
                eq("Subscription Expiring Soon"),
                contains("expiring in 3 days"),
                eq("31"),
                eq(true)
        );

        // Sub 1 (cancelled) did NOT trigger notification with ID "30"
        verify(notificationService, never()).createNotification(
                any(),
                any(),
                any(),
                any(),
                eq("30"),
                anyBoolean()
        );
    }

    @Test
    void testCancelledSubscriptionStillExpiresNormallyWhenTermEnds() {
        Shop shop = new Shop();
        shop.setId(2L);

        Subscription cancelledExpired = new Subscription();
        cancelledExpired.setId(40L);
        cancelledExpired.setStatus(SubscriptionStatus.ACTIVE);
        cancelledExpired.setExpiryDate(LocalDateTime.now().minusDays(1)); // Term ended
        cancelledExpired.setCancelledAt(LocalDateTime.now().minusDays(10));
        cancelledExpired.setShop(shop);

        when(subscriptionRepository.findByStatus(SubscriptionStatus.ACTIVE))
                .thenReturn(List.of(cancelledExpired));

        subscriptionScheduler.processSubscriptionExpiries();

        // Expire subscription must still be called for cancelled subscription whose term ended
        verify(subscriptionService).expireSubscription(40L);
    }
}
