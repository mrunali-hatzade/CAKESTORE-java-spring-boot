package com.cakeplatform.api.modules.admin;

import com.cakeplatform.api.exception.ResourceNotFoundException;
import com.cakeplatform.api.modules.admin.dto.AdminOrderDetailResponse;
import com.cakeplatform.api.modules.admin.dto.AdminOrderSummaryResponse;
import com.cakeplatform.api.modules.order.Order;
import com.cakeplatform.api.modules.order.OrderItem;
import com.cakeplatform.api.modules.order.OrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminOrderService {

    private final OrderRepository orderRepository;

    public Page<AdminOrderSummaryResponse> getCrossShopOrders(
            int page,
            int size,
            String query,
            String status,
            String paymentStatus,
            Long shopId,
            LocalDate startDate,
            LocalDate endDate) {

        int boundedSize = Math.min(Math.max(size, 1), 50);
        int boundedPage = Math.max(page, 0);
        Pageable pageable = PageRequest.of(boundedPage, boundedSize);

        LocalDateTime startDateTime = startDate != null ? startDate.atStartOfDay() : LocalDateTime.of(2000, 1, 1, 0, 0);
        LocalDateTime endDateTime = endDate != null ? endDate.atTime(LocalTime.MAX) : LocalDateTime.of(2099, 12, 31, 23, 59, 59);

        Page<Order> orderPage = orderRepository.findAdminCrossShopOrders(
                shopId,
                status,
                paymentStatus,
                startDateTime,
                endDateTime,
                query,
                pageable
        );

        return orderPage.map(this::toOrderSummaryResponse);
    }

    public AdminOrderDetailResponse getOrderDetails(Long id) {
        if (id == null) {
            throw new IllegalArgumentException("Order ID cannot be null");
        }
        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found with id: " + id));

        return toOrderDetailResponse(order);
    }

    private AdminOrderSummaryResponse toOrderSummaryResponse(Order order) {
        Long shopId = order.getShop() != null ? order.getShop().getId() : null;
        String shopName = order.getShop() != null ? order.getShop().getBusinessName() : null;
        int itemCount = order.getItems() != null ? order.getItems().size() : 0;

        return AdminOrderSummaryResponse.builder()
                .id(order.getId())
                .orderNumber(order.getOrderNumber())
                .shopId(shopId)
                .shopName(shopName)
                .customerName(order.getCustomerName())
                .customerPhoneMasked(AdminOrderSummaryResponse.maskPhone(order.getCustomerPhone()))
                .customerEmailMasked(AdminOrderSummaryResponse.maskEmail(order.getCustomerEmail()))
                .totalAmount(order.getTotalAmount())
                .subtotal(order.getSubtotal())
                .deliveryCharge(order.getDeliveryCharge())
                .discountAmount(order.getDiscountAmount())
                .couponCode(order.getCouponCode())
                .orderStatus(order.getOrderStatus())
                .paymentStatus(order.getPaymentStatus())
                .paymentMethod(order.getPaymentMethod())
                .transactionId(order.getTransactionId())
                .itemCount(itemCount)
                .deliveryDate(order.getDeliveryDate())
                .deliverySlotDetails(order.fetchDeliverySlotDetails())
                .createdAt(order.getCreatedAt())
                .paidAt(order.getPaidAt())
                .build();
    }

    private AdminOrderDetailResponse toOrderDetailResponse(Order order) {
        Long shopId = order.getShop() != null ? order.getShop().getId() : null;
        String shopName = order.getShop() != null ? order.getShop().getBusinessName() : null;
        String shopPhone = order.getShop() != null ? order.getShop().getPhone() : null;

        List<AdminOrderDetailResponse.AdminOrderItemDto> itemDtos = new ArrayList<>();
        if (order.getItems() != null) {
            for (OrderItem item : order.getItems()) {
                itemDtos.add(AdminOrderDetailResponse.AdminOrderItemDto.builder()
                        .id(item.getId())
                        .productId(item.getProduct() != null ? item.getProduct().getId() : null)
                        .productNameSnapshot(item.getProductNameSnapshot())
                        .variantName(item.getVariantName())
                        .unitPrice(item.getUnitPrice())
                        .quantity(item.getQuantity())
                        .totalPrice(item.getTotalPrice())
                        .dietaryPreference(item.getDietaryPreference())
                        .cakeMessage(item.getCakeMessage())
                        .addonsSummary(item.getAddonsSummary())
                        .productImageUrl(item.getProductImageUrl())
                        .build());
            }
        }

        return AdminOrderDetailResponse.builder()
                .id(order.getId())
                .orderNumber(order.getOrderNumber())
                .shopId(shopId)
                .shopName(shopName)
                .shopPhone(shopPhone)
                .customerName(order.getCustomerName())
                .customerPhone(order.getCustomerPhone())
                .customerEmail(order.getCustomerEmail())
                .deliveryAddress(order.getDeliveryAddress())
                .specialInstructions(order.getSpecialInstructions())
                .subtotal(order.getSubtotal())
                .deliveryCharge(order.getDeliveryCharge())
                .discountAmount(order.getDiscountAmount())
                .totalAmount(order.getTotalAmount())
                .couponCode(order.getCouponCode())
                .orderStatus(order.getOrderStatus())
                .paymentStatus(order.getPaymentStatus())
                .paymentMethod(order.getPaymentMethod())
                .transactionId(order.getTransactionId())
                .razorpayOrderId(order.getRazorpayOrderId())
                .deliveryDate(order.getDeliveryDate())
                .deliverySlotDetails(order.fetchDeliverySlotDetails())
                .createdAt(order.getCreatedAt())
                .paidAt(order.getPaidAt())
                .items(itemDtos)
                .build();
    }
}
