package com.cakeplatform.api.modules.e2e;

import com.cakeplatform.api.modules.order.Order;
import com.cakeplatform.api.modules.order.OrderRepository;
import com.cakeplatform.api.modules.payment.PaymentRepository;
import com.cakeplatform.api.modules.product.Product;
import com.cakeplatform.api.modules.product.ProductRepository;
import com.cakeplatform.api.modules.shop.Shop;
import com.cakeplatform.api.modules.shop.ShopRepository;
import com.cakeplatform.api.modules.shop.ShopStatus;
import com.cakeplatform.api.modules.storefront.CustomerStorefrontService;
import com.cakeplatform.api.modules.storefront.dto.GuestOrderRequest;
import com.cakeplatform.api.modules.storefront.dto.StorefrontOrderItem;
import com.cakeplatform.api.modules.subscription.Subscription;
import com.cakeplatform.api.modules.subscription.SubscriptionRepository;
import com.cakeplatform.api.modules.subscription.SubscriptionStatus;
import com.cakeplatform.api.modules.shop.ShopDeliveryConfig;
import com.cakeplatform.api.modules.shop.ShopDeliveryConfigRepository;
import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.modules.user.UserRepository;
import com.cakeplatform.api.modules.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
public class Day3Phase2E2ETest {

    @Mock private ShopRepository shopRepository;
    @Mock private ProductRepository productRepository;
    @Mock private OrderRepository orderRepository;
    @Mock private SubscriptionRepository subscriptionRepository;
    @Mock private UserRepository userRepository;
    @Mock private ShopDeliveryConfigRepository shopDeliveryConfigRepository;
    
    @InjectMocks
    private CustomerStorefrontService customerStorefrontService;

    private User ownerA;
    private Shop shopA;
    private Product productA;
    
    private User ownerB;
    private Shop shopB;
    
    @BeforeEach
    void setUp() {
        ownerA = new User();
        ownerA.setId(101L);
        ownerA.setRole(UserRole.SHOP_OWNER);
        
        shopA = new Shop();
        shopA.setId(1L);
        shopA.setOwner(ownerA);
        shopA.setStatus(ShopStatus.ACTIVE);
        
        productA = new Product();
        productA.setId(10L);
        productA.setShop(shopA);
        productA.setName("Chocolate Truffle");
        productA.setPrice(new BigDecimal("500.00"));
        productA.setAvailability(true);
        productA.setStatus("ACTIVE");
        
        ownerB = new User();
        ownerB.setId(102L);
        ownerB.setRole(UserRole.SHOP_OWNER);
        
        shopB = new Shop();
        shopB.setId(2L);
        shopB.setOwner(ownerB);
        shopB.setStatus(ShopStatus.ACTIVE);
        
        when(shopRepository.findById(1L)).thenReturn(Optional.of(shopA));
        when(shopRepository.findById(2L)).thenReturn(Optional.of(shopB));
        
        Subscription activeSubA = new Subscription();
        activeSubA.setId(1L);
        activeSubA.setShop(shopA);
        activeSubA.setStatus(SubscriptionStatus.ACTIVE);
        activeSubA.setExpiryDate(java.time.LocalDateTime.now().plusDays(30));
        when(subscriptionRepository.findFirstByShopIdOrderByCreatedAtDesc(1L)).thenReturn(Optional.of(activeSubA));
        
        Subscription activeSubB = new Subscription();
        activeSubB.setId(2L);
        activeSubB.setShop(shopB);
        activeSubB.setStatus(SubscriptionStatus.ACTIVE);
        activeSubB.setExpiryDate(java.time.LocalDateTime.now().plusDays(30));
        when(subscriptionRepository.findFirstByShopIdOrderByCreatedAtDesc(2L)).thenReturn(Optional.of(activeSubB));

        when(productRepository.findByShopId(1L)).thenReturn(List.of(productA));
        when(productRepository.findByIdAndShopId(10L, 1L)).thenReturn(Optional.of(productA));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));

        when(shopDeliveryConfigRepository.findByShopId(1L)).thenReturn(Optional.of(
                ShopDeliveryConfig.builder()
                        .shop(shopA)
                        .deliveryEnabled(true)
                        .deliveryChargeType("FIXED")
                        .fixedChargeAmount(new BigDecimal("50.00"))
                        .minOrderForFreeDelivery(new BigDecimal("2000.00"))
                        .build()
        ));
    }

    @Test
    @DisplayName("E2E: Product belongs to correct shop and is visible on storefront")
    void testProductVisibilityAndIsolation() {
        // Customer visits Shop A
        List<Product> shopAProducts = customerStorefrontService.getShopProducts(1L);
        assertEquals(1, shopAProducts.size());
        assertEquals("Chocolate Truffle", shopAProducts.get(0).getName());
        
        // Customer visits Shop B
        List<Product> shopBProducts = customerStorefrontService.getShopProducts(2L);
        assertTrue(shopBProducts.isEmpty(), "Shop B should not see Shop A's products");
    }
    
    @Test
    @DisplayName("E2E: Customer Order Journey - Correct financial values and shop isolation")
    void testCustomerOrderJourney_FinancialValues() {
        GuestOrderRequest request = new GuestOrderRequest();
        request.setCustomerName("Alice");
        request.setDeliveryAddress("Flat 101, MG Road, Pune");
        request.setDeliveryDate(LocalDate.now().plusDays(1));
        request.setPaymentMethod("COD");
        
        StorefrontOrderItem item = new StorefrontOrderItem();
        item.setProductId(10L);
        item.setQuantity(2);
        request.setItems(List.of(item));
        
        Order order = customerStorefrontService.placeGuestOrder(1L, request);
        
        assertNotNull(order);
        assertEquals(shopA, order.getShop());
        assertEquals(0, new BigDecimal("1000.00").compareTo(order.getSubtotal()));
        assertEquals(0, new BigDecimal("50.0").compareTo(order.getDeliveryCharge()));
        assertEquals("PENDING", order.getPaymentStatus());
        assertEquals("NEW", order.getOrderStatus());
    }
    
    @Test
    @DisplayName("E2E: Customer Order Journey - Cannot buy product from wrong shop")
    void testCustomerOrderJourney_WrongShop() {
        GuestOrderRequest request = new GuestOrderRequest();
        request.setCustomerName("Bob");
        request.setDeliveryAddress("Flat 202, FC Road, Pune");
        request.setDeliveryDate(LocalDate.now().plusDays(1));
        
        StorefrontOrderItem item = new StorefrontOrderItem();
        item.setProductId(10L); // Product 10 belongs to Shop 1
        item.setQuantity(1);
        request.setItems(List.of(item));
        
        // Attempt to buy Product 10 from Shop 2
        RuntimeException exception = assertThrows(RuntimeException.class, () -> {
            customerStorefrontService.placeGuestOrder(2L, request);
        });
        
        assertTrue(exception.getMessage().contains("Product not found or does not belong to shop"));
    }
    
    @Test
    @DisplayName("E2E: Customer Access during Shop Lifecycle States")
    void testCustomerAccessDuringShopLifecycle() {
        // Active
        assertNotNull(customerStorefrontService.getShopDetails(1L));
        
        // Expired
        shopA.setStatus(ShopStatus.EXPIRED);
        RuntimeException exExpired = assertThrows(RuntimeException.class, () -> customerStorefrontService.getShopDetails(1L));
        assertEquals("Shop is currently unavailable", exExpired.getMessage());
        
        // Suspended
        shopA.setStatus(ShopStatus.SUSPENDED);
        RuntimeException exSuspended = assertThrows(RuntimeException.class, () -> customerStorefrontService.getShopDetails(1L));
        assertEquals("Shop is currently unavailable", exSuspended.getMessage());
        
        // Pending
        shopA.setStatus(ShopStatus.PENDING);
        RuntimeException exPending = assertThrows(RuntimeException.class, () -> customerStorefrontService.getShopDetails(1L));
        assertEquals("Shop is currently unavailable or pending approval", exPending.getMessage());
    }
}
