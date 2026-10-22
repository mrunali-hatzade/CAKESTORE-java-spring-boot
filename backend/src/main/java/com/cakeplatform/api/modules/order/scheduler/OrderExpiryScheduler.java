package com.cakeplatform.api.modules.order.scheduler;

import com.cakeplatform.api.modules.order.service.OrderService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
@Slf4j
public class OrderExpiryScheduler {

    private final OrderService orderService;

    /**
     * Periodic scheduled check for pending orders.
     * Unsafe automatic cancellation removed:
     * Orders in PAYMENT_PENDING status are safely retained in pending reconciliation state
     * to protect customers against delayed gateway confirmations/webhooks and preserve
     * reserved delivery slot capacity.
     */
    @Scheduled(fixedDelay = 60000)
    public void processExpiredOrders() {
        try {
            LocalDateTime threshold = LocalDateTime.now().minusMinutes(15);
            orderService.monitorPendingPaymentOrders(threshold);
        } catch (Exception e) {
            log.error("Error during scheduled pending order monitoring", e);
        }
    }
}
