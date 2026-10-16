package com.cakeplatform.api.modules.notification;

import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.modules.user.UserRepository;
import com.cakeplatform.api.modules.user.UserRole;
import com.cakeplatform.api.modules.user.UserStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.Collections;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class BroadcastCommittedEventListener {

    private final BroadcastHistoryRepository broadcastHistoryRepository;
    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final EmailService emailService;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onBroadcastCommitted(BroadcastCommittedEvent event) {
        Long broadcastId = event.getBroadcastId();
        log.info("[AFTER_COMMIT] Starting best-effort WebSocket and Email dispatch for broadcast id={}", broadcastId);

        BroadcastHistory history = broadcastHistoryRepository.findById(broadcastId).orElse(null);
        if (history == null) {
            log.warn("[AFTER_COMMIT] Broadcast history not found for id={}", broadcastId);
            return;
        }

        List<User> targets;
        if ("SPECIFIC".equalsIgnoreCase(history.getTargetType())) {
            User owner = userRepository.findById(history.getTargetOwnerId()).orElse(null);
            targets = (owner != null && owner.getRole() == UserRole.SHOP_OWNER && owner.getStatus() == UserStatus.ACTIVE && !owner.isDeleted())
                    ? List.of(owner)
                    : Collections.emptyList();
        } else {
            targets = userRepository.findByRoleAndStatus(UserRole.SHOP_OWNER, UserStatus.ACTIVE);
        }

        for (User recipient : targets) {
            // Push WebSocket notification
            try {
                String destination = "/queue/notifications-" + recipient.getId();
                // Send lightweight notification payload
                messagingTemplate.convertAndSend(destination, history);
                log.info("[AFTER_COMMIT] WebSocket emitted to {}", destination);
            } catch (Exception ex) {
                log.error("[AFTER_COMMIT] Failed to push WebSocket to user {}: {}", recipient.getId(), ex.getMessage());
            }

            // Send Email if requested
            if (Boolean.TRUE.equals(history.getSentEmail())) {
                try {
                    emailService.sendEmail(recipient.getEmail(), history.getTitle(), history.getMessage());
                } catch (Exception ex) {
                    log.error("[AFTER_COMMIT] Failed to dispatch email to user {}: {}", recipient.getEmail(), ex.getMessage());
                }
            }
        }
        log.info("[AFTER_COMMIT] Finished best-effort dispatch for broadcast id={}", broadcastId);
    }
}
