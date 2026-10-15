package com.cakeplatform.api.modules.order.service;

import com.cakeplatform.api.modules.audit.ActivityLoggerService;
import com.cakeplatform.api.modules.notification.EmailService;
import com.cakeplatform.api.modules.notification.SmsService;
import com.cakeplatform.api.modules.order.Order;
import com.cakeplatform.api.modules.order.OrderRepository;
import com.cakeplatform.api.modules.security.ShopAccessValidator;
import com.cakeplatform.api.modules.shop.Shop;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrderStatusNotificationTest {

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private ShopAccessValidator shopAccessValidator;

    @Mock
    private ActivityLoggerService activityLogger;

    @Mock
    private EmailService emailService;

    @Mock
    private SmsService smsService;

    @InjectMocks
    private OrderService orderService;

    private Shop shop;
    private Order order;

    @BeforeEach
    void setUp() {
        shop = new Shop();
        shop.setId(5L);
        shop.setBusinessName("Sweet Cakes Bakery");

        order = new Order();
        order.setId(101L);
        order.setOrderNumber("ORD-98765");
        order.setCustomerName("Pooja");
        order.setCustomerEmail("pooja@example.com");
        order.setCustomerPhone("9876543210");
        order.setOrderStatus("CONFIRMED");
    }

    @Test
    @DisplayName("updateOrderStatus dispatches customer email and SMS notification without failing if credentials are mock/missing")
    void testUpdateOrderStatus_TriggersNotifications() {
        when(shopAccessValidator.validateOrderFulfillmentAccess(1L)).thenReturn(shop);
        when(orderRepository.findByIdAndShopId(101L, 5L)).thenReturn(Optional.of(order));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Order result = orderService.updateOrderStatus(1L, 101L, "PREPARING");

        assertEquals("PREPARING", result.getOrderStatus());
        verify(orderRepository).save(order);
        verify(emailService, times(1)).sendEmail(
                eq("pooja@example.com"),
                contains("ORD-98765"),
                contains("PREPARING")
        );
        verify(smsService, times(1)).sendSms(
                eq("9876543210"),
                contains("ORD-98765")
        );
    }

    @Test
    @DisplayName("updateOrderStatus does not break if notification service throws unexpected exception")
    void testUpdateOrderStatus_SafeAgainstNotificationExceptions() {
        when(shopAccessValidator.validateOrderFulfillmentAccess(1L)).thenReturn(shop);
        when(orderRepository.findByIdAndShopId(101L, 5L)).thenReturn(Optional.of(order));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));

        doThrow(new RuntimeException("Simulated email service error")).when(emailService)
                .sendEmail(anyString(), anyString(), anyString());

        Order result = orderService.updateOrderStatus(1L, 101L, "READY");

        assertEquals("READY", result.getOrderStatus());
        verify(orderRepository).save(order);
    }
}
