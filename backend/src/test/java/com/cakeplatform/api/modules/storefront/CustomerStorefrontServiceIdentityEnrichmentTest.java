package com.cakeplatform.api.modules.storefront;

import com.cakeplatform.api.modules.order.Order;
import com.cakeplatform.api.modules.order.OrderRepository;
import com.cakeplatform.api.modules.product.Product;
import com.cakeplatform.api.modules.product.ProductRepository;
import com.cakeplatform.api.modules.shop.Shop;
import com.cakeplatform.api.modules.shop.ShopDeliveryConfig;
import com.cakeplatform.api.modules.shop.ShopDeliveryConfigRepository;
import com.cakeplatform.api.modules.shop.ShopRepository;
import com.cakeplatform.api.modules.shop.service.DeliveryEligibilityService;
import com.cakeplatform.api.modules.shop.service.DeliveryEligibilityService.DeliveryEligibilityResult;
import com.cakeplatform.api.modules.storefront.dto.GuestOrderRequest;
import com.cakeplatform.api.modules.storefront.dto.StorefrontOrderItem;
import com.cakeplatform.api.modules.subscription.Subscription;
import com.cakeplatform.api.modules.subscription.SubscriptionRepository;
import com.cakeplatform.api.modules.subscription.SubscriptionStatus;
import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.modules.user.UserRepository;
import com.cakeplatform.api.modules.user.UserRole;
import com.cakeplatform.api.security.CustomUserDetails;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class CustomerStorefrontServiceIdentityEnrichmentTest {

    @Mock
    private ShopRepository shopRepository;

    @Mock
    private ProductRepository productRepository;

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ShopDeliveryConfigRepository shopDeliveryConfigRepository;

    @Mock
    private SubscriptionRepository subscriptionRepository;

    @Mock
    private DeliveryEligibilityService deliveryEligibilityService;

    @InjectMocks
    private CustomerStorefrontService storefrontService;

    private Shop shop;
    private Product product;
    private GuestOrderRequest request;

    @BeforeEach
    void setUp() {
        shop = new Shop();
        shop.setId(10L);
        shop.setBusinessName("Sweet Delights");
        shop.setStatus(com.cakeplatform.api.modules.shop.ShopStatus.ACTIVE);

        Subscription activeSub = new Subscription();
        activeSub.setId(1L);
        activeSub.setStatus(SubscriptionStatus.ACTIVE);
        activeSub.setExpiryDate(LocalDateTime.now().plusDays(30));
        lenient().when(subscriptionRepository.findFirstByShopIdOrderByCreatedAtDesc(anyLong()))
                .thenReturn(Optional.of(activeSub));

        product = new Product();
        product.setId(100L);
        product.setPrice(BigDecimal.valueOf(500.00));
        product.setStatus("ACTIVE");
        product.setAvailability(true);
        product.setShop(shop);

        StorefrontOrderItem item = new StorefrontOrderItem();
        item.setProductId(100L);
        item.setQuantity(1);

        request = new GuestOrderRequest();
        request.setDeliveryDate(LocalDate.now().plusDays(1));
        request.setFulfillmentMethod("SELF_PICKUP");
        request.setPaymentMethod("COD");
        request.setCustomerPhone("9876543210");
        request.setCustomerName("Pooja Kulkarni");
        request.setCustomerEmail("pooja@example.com");
        request.setItems(List.of(item));

        when(shopRepository.findById(10L)).thenReturn(Optional.of(shop));
        lenient().when(productRepository.findByIdAndShopId(100L, 10L)).thenReturn(Optional.of(product));
        lenient().when(orderRepository.save(any(Order.class))).thenAnswer(i -> i.getArgument(0));

        ShopDeliveryConfig deliveryConfig = ShopDeliveryConfig.builder()
                .shop(shop)
                .deliveryEnabled(true)
                .deliveryChargeType("FIXED")
                .fixedChargeAmount(BigDecimal.valueOf(50.00))
                .build();
        lenient().when(shopDeliveryConfigRepository.findByShopId(10L)).thenReturn(Optional.of(deliveryConfig));
        storefrontService.setDeliveryEligibilityService(deliveryEligibilityService);
        lenient().when(deliveryEligibilityService.evaluateEligibility(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(DeliveryEligibilityResult.allowed(null, null));
    }

    @Test
    @DisplayName("1. Authenticated customer: missing name and email are enriched safely into User")
    void testAuthenticatedCustomer_EnrichesMissingProfileFields() {
        User user = new User();
        user.setId(55L);
        user.setMobile("9876543210");
        user.setRole(UserRole.CUSTOMER);
        user.setFullName(null);
        user.setEmail(null);
        CustomUserDetails userDetails = new CustomUserDetails(user);

        when(userRepository.existsByEmailIgnoreCase("pooja@example.com")).thenReturn(false);
        when(userRepository.save(any(User.class))).thenAnswer(i -> i.getArgument(0));

        Order order = storefrontService.placeGuestOrder(10L, request, userDetails);

        assertNotNull(order.getCustomer());
        assertEquals(55L, order.getCustomer().getId());
        assertEquals("Pooja Kulkarni", user.getFullName());
        assertEquals("pooja@example.com", user.getEmail());
        verify(userRepository).save(user);
    }

    @Test
    @DisplayName("2. Authenticated customer: existing non-empty name and email are NOT overwritten")
    void testAuthenticatedCustomer_PreservesExistingNameAndEmail() {
        User user = new User();
        user.setId(55L);
        user.setMobile("9876543210");
        user.setRole(UserRole.CUSTOMER);
        user.setFullName("Pooja Existing");
        user.setEmail("existing@example.com");
        CustomUserDetails userDetails = new CustomUserDetails(user);

        request.setCustomerName("New Name From Checkout");
        request.setCustomerEmail("newemail@example.com");

        Order order = storefrontService.placeGuestOrder(10L, request, userDetails);

        assertNotNull(order.getCustomer());
        assertEquals("Pooja Existing", user.getFullName());
        assertEquals("existing@example.com", user.getEmail());
        // User record was not modified
        verify(userRepository, never()).save(user);
    }

    @Test
    @DisplayName("3. Authenticated customer with mismatched phone throws AccessDeniedException")
    void testAuthenticatedCustomer_MismatchedPhone_ThrowsAccessDenied() {
        User user = new User();
        user.setId(55L);
        user.setMobile("9999900000"); // Different phone
        user.setRole(UserRole.CUSTOMER);
        CustomUserDetails userDetails = new CustomUserDetails(user);

        assertThrows(AccessDeniedException.class, () ->
                storefrontService.placeGuestOrder(10L, request, userDetails)
        );
        verify(orderRepository, never()).save(any(Order.class));
    }

    @Test
    @DisplayName("4. Non-customer user (e.g. SHOP_OWNER) throws AccessDeniedException")
    void testOwnerUser_ThrowsAccessDenied() {
        User user = new User();
        user.setId(88L);
        user.setMobile("9876543210");
        user.setRole(UserRole.SHOP_OWNER);
        CustomUserDetails userDetails = new CustomUserDetails(user);

        assertThrows(AccessDeniedException.class, () ->
                storefrontService.placeGuestOrder(10L, request, userDetails)
        );
        verify(orderRepository, never()).save(any(Order.class));
    }

    @Test
    @DisplayName("5. Unauthenticated guest order: order placed without customer linkage (customer=null)")
    void testAnonymousGuestOrder_PlacesOrderWithNullCustomer() {
        Order order = storefrontService.placeGuestOrder(10L, request, null);

        assertNull(order.getCustomer());
        assertEquals("9876543210", order.getCustomerPhone());
        assertEquals("Pooja Kulkarni", order.getCustomerName());
        assertEquals("pooja@example.com", order.getCustomerEmail());
        verify(userRepository, never()).findByMobile(any());
        verify(userRepository, never()).save(any());
    }
}
