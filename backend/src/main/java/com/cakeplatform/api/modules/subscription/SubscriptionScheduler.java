package com.cakeplatform.api.modules.subscription;

import com.cakeplatform.api.modules.notification.NotificationService;
import com.cakeplatform.api.modules.notification.NotificationType;
import com.cakeplatform.api.modules.shop.Shop;
import com.cakeplatform.api.modules.user.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
@EnableScheduling
@RequiredArgsConstructor
@Slf4j
public class SubscriptionScheduler {

    private final SubscriptionRepository subscriptionRepository;
    private final SubscriptionService subscriptionService;
    private final NotificationService notificationService;
    private final com.cakeplatform.api.modules.notification.AdminNotificationService adminNotificationService;

    @Scheduled(cron = "0 0 0 * * ?")
    public void processSubscriptionExpiries() {
        log.info("Running daily subscription expiry check...");
        
        List<Subscription> activeSubscriptions = subscriptionRepository.findByStatus(SubscriptionStatus.ACTIVE);

        LocalDateTime now = LocalDateTime.now();

        for (Subscription sub : activeSubscriptions) {
            try {
                if (sub.getExpiryDate() == null) continue;

                long daysUntilExpiry = ChronoUnit.DAYS.between(now.toLocalDate(), sub.getExpiryDate().toLocalDate());

                if (daysUntilExpiry == 7 || daysUntilExpiry == 5 || daysUntilExpiry == 3 || daysUntilExpiry == 1) {
                    if (sub.getCancelledAt() == null) {
                        sendExpiringNotification(sub, daysUntilExpiry);
                    } else {
                        log.debug("Skipping expiring notification for cancelled subscription ID {}", sub.getId());
                    }
                } else if (daysUntilExpiry <= 0) {
                    log.info("Subscription ID {} for Shop ID {} has expired (daysUntilExpiry: {}). Triggering expiration workflow...",
                            sub.getId(), sub.getShop().getId(), daysUntilExpiry);
                    subscriptionService.expireSubscription(sub.getId());
                }
            } catch (Exception ex) {
                log.error("Failed to process expiration for subscription ID {}: {}", sub.getId(), ex.getMessage(), ex);
            }
        }
    }

    private void sendExpiringNotification(Subscription sub, long daysLeft) {
        Shop shop = sub.getShop();
        User owner = shop.getOwner();
        String message = String.format("Your subscription for %s is expiring in %d days. Please renew to avoid service interruption.", 
                                        shop.getBusinessName(), daysLeft);
                                        
        notificationService.createNotification(
                owner,
                NotificationType.SUBSCRIPTION_EXPIRING,
                "Subscription Expiring Soon",
                message,
                sub.getId().toString(),
                true
        );

        try {
            adminNotificationService.dispatchAdminNotification(
                    com.cakeplatform.api.modules.notification.AdminNotificationType.SUBSCRIPTION_EXPIRING,
                    "Subscription Expiring: " + shop.getBusinessName(),
                    String.format("Subscription for %s is expiring in %d day(s).", shop.getBusinessName(), daysLeft),
                    com.cakeplatform.api.modules.notification.AdminNotificationPriority.HIGH,
                    com.cakeplatform.api.modules.notification.AdminNotificationCategory.SUBSCRIPTIONS,
                    sub.getId() + "-expiring-" + daysLeft,
                    "SUBSCRIPTION",
                    "/admin/shops/" + shop.getId()
            );
        } catch (Exception ignored) {}

        log.info("Sent expiring notification to Shop ID {}", shop.getId());
    }
}
