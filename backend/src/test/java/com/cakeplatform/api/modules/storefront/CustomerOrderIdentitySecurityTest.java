package com.cakeplatform.api.modules.storefront;

import com.cakeplatform.api.modules.order.InvoiceService;
import com.cakeplatform.api.modules.order.Order;
import com.cakeplatform.api.modules.shop.Shop;
import com.cakeplatform.api.modules.shop.ShopRepository;
import com.cakeplatform.api.modules.storefront.dto.GuestOrderRequest;
import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.modules.user.UserRepository;
import com.cakeplatform.api.modules.user.UserRole;
import com.cakeplatform.api.security.CustomUserDetails;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class CustomerOrderIdentitySecurityTest {

    @Mock
    private CustomerStorefrontService storefrontService;

    @Mock
    private InvoiceService invoiceService;

    @InjectMocks
    private CustomerStorefrontController storefrontController;

    private GuestOrderRequest sampleRequest;

    @BeforeEach
    void setUp() {
        sampleRequest = new GuestOrderRequest();
        sampleRequest.setCustomerName("Rohan Verma");
        sampleRequest.setCustomerEmail("rohan@example.com");
        sampleRequest.setCustomerPhone("9876543210");
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private void setupCustomerAuth(String phone) {
        SecurityContext context = mock(SecurityContext.class);
        Authentication auth = mock(Authentication.class);

        User customer = new User();
        customer.setId(101L);
        customer.setMobile(phone);
        customer.setRole(UserRole.CUSTOMER);
        CustomUserDetails userDetails = new CustomUserDetails(customer);

        when(context.getAuthentication()).thenReturn(auth);
        when(auth.isAuthenticated()).thenReturn(true);
        when(auth.getPrincipal()).thenReturn(userDetails);
        doReturn(Collections.singletonList(new SimpleGrantedAuthority("ROLE_CUSTOMER"))).when(auth).getAuthorities();

        SecurityContextHolder.setContext(context);
    }

    private void setupOwnerAuth(String phone) {
        SecurityContext context = mock(SecurityContext.class);
        Authentication auth = mock(Authentication.class);

        User owner = new User();
        owner.setId(202L);
        owner.setMobile(phone);
        owner.setRole(UserRole.SHOP_OWNER);
        CustomUserDetails userDetails = new CustomUserDetails(owner);

        when(context.getAuthentication()).thenReturn(auth);
        when(auth.isAuthenticated()).thenReturn(true);
        when(auth.getPrincipal()).thenReturn(userDetails);
        doReturn(Collections.singletonList(new SimpleGrantedAuthority("ROLE_SHOP_OWNER"))).when(auth).getAuthorities();

        SecurityContextHolder.setContext(context);
    }

    private void setupAnonymousAuth() {
        SecurityContext context = mock(SecurityContext.class);
        Authentication auth = mock(Authentication.class);

        when(context.getAuthentication()).thenReturn(auth);
        when(auth.isAuthenticated()).thenReturn(true);
        when(auth.getPrincipal()).thenReturn("anonymousUser");

        SecurityContextHolder.setContext(context);
    }

    @Test
    @DisplayName("1. Valid CUSTOMER JWT with matching phone associates customer identity")
    void testCustomerAuth_MatchingPhone_Success() {
        setupCustomerAuth("9876543210");
        Order mockOrder = new Order();
        mockOrder.setOrderNumber("ORD-11111");

        when(storefrontService.placeGuestOrder(eq(1L), eq(sampleRequest), any(CustomUserDetails.class)))
                .thenReturn(mockOrder);

        ResponseEntity<Order> response = storefrontController.placeGuestOrder(1L, sampleRequest);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(mockOrder, response.getBody());
        verify(storefrontService).placeGuestOrder(eq(1L), eq(sampleRequest), any(CustomUserDetails.class));
    }

    @Test
    @DisplayName("2. Valid CUSTOMER JWT with mismatched phone is rejected with 403 Forbidden")
    void testCustomerAuth_MismatchedPhone_Forbidden() {
        setupCustomerAuth("9999988888"); // Authenticated with different phone

        ResponseEntity<Order> response = storefrontController.placeGuestOrder(1L, sampleRequest);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        verify(storefrontService, never()).placeGuestOrder(any(), any(), any());
    }

    @Test
    @DisplayName("3. SHOP_OWNER JWT cannot be used as customer identity (403 Forbidden)")
    void testOwnerAuth_AttemptingCustomerOrder_Forbidden() {
        setupOwnerAuth("9876543210");

        ResponseEntity<Order> response = storefrontController.placeGuestOrder(1L, sampleRequest);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        verify(storefrontService, never()).placeGuestOrder(any(), any(), any());
    }

    @Test
    @DisplayName("4. Anonymous guest order passes without customer principal (No 403)")
    void testAnonymousGuestOrder_PlacedWithoutCustomerIdentity() {
        setupAnonymousAuth();
        Order mockOrder = new Order();
        mockOrder.setOrderNumber("ORD-GUEST-01");

        when(storefrontService.placeGuestOrder(eq(1L), eq(sampleRequest), isNull()))
                .thenReturn(mockOrder);

        ResponseEntity<Order> response = storefrontController.placeGuestOrder(1L, sampleRequest);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(mockOrder, response.getBody());
        verify(storefrontService).placeGuestOrder(eq(1L), eq(sampleRequest), isNull());
    }

    @Test
    @DisplayName("5. Unauthenticated request without security context places guest order with null customer")
    void testNullAuth_PlacedWithoutCustomerIdentity() {
        SecurityContext context = mock(SecurityContext.class);
        when(context.getAuthentication()).thenReturn(null);
        SecurityContextHolder.setContext(context);

        Order mockOrder = new Order();
        mockOrder.setOrderNumber("ORD-GUEST-02");

        when(storefrontService.placeGuestOrder(eq(1L), eq(sampleRequest), isNull()))
                .thenReturn(mockOrder);

        ResponseEntity<Order> response = storefrontController.placeGuestOrder(1L, sampleRequest);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(mockOrder, response.getBody());
        verify(storefrontService).placeGuestOrder(eq(1L), eq(sampleRequest), isNull());
    }
}

