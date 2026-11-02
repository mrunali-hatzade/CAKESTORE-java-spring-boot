package com.cakeplatform.api.modules.storefront;

import com.cakeplatform.api.modules.order.InvoiceService;
import com.cakeplatform.api.modules.order.Order;
import com.cakeplatform.api.modules.storefront.dto.StorefrontOrderTrackingResponse;
import com.cakeplatform.api.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class CustomerPrivacySecurityTest {

    @Mock
    private CustomerStorefrontService storefrontService;

    @Mock
    private InvoiceService invoiceService;

    @Mock
    private JwtService jwtService;

    @InjectMocks
    private CustomerStorefrontController controller;

    private Order mockOrder;

    @BeforeEach
    void setUp() {
        mockOrder = new Order();
        mockOrder.setId(101L);
        mockOrder.setOrderNumber("ORD-12345");
        mockOrder.setCustomerPhone("9876543210");
        mockOrder.setOrderStatus("CONFIRMED");
    }

    @Test
    @DisplayName("Unauthenticated order lookup returns 401")
    void testUnauthenticatedOrderLookup_Returns401() {
        org.springframework.security.core.context.SecurityContextHolder.clearContext();
        ResponseEntity<StorefrontOrderTrackingResponse> response = controller.getGuestOrderDetails("ORD-12345");
        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
    }

    @Test
    @DisplayName("Unauthenticated invoice lookup returns 401")
    void testUnauthenticatedInvoiceLookup_Returns401() throws Exception {
        org.springframework.security.core.context.SecurityContextHolder.clearContext();
        ResponseEntity<byte[]> response = controller.downloadInvoice("ORD-12345");
        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
    }

    @Test
    @DisplayName("Invalid JWT / empty context returns 401")
    void testInvalidJwtOrderLookup_Returns401() {
        org.springframework.security.core.context.SecurityContextHolder.clearContext();
        ResponseEntity<StorefrontOrderTrackingResponse> response = controller.getGuestOrderDetails("ORD-12345");
        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
    }

    private void setupSecurityContext(String phone, String role) {
        com.cakeplatform.api.modules.user.User mockUser = new com.cakeplatform.api.modules.user.User();
        mockUser.setMobile(phone);
        mockUser.setRole(com.cakeplatform.api.modules.user.UserRole.valueOf(role.replace("ROLE_", "")));
        com.cakeplatform.api.security.CustomUserDetails mockPrincipal = new com.cakeplatform.api.security.CustomUserDetails(mockUser);
        org.springframework.security.authentication.UsernamePasswordAuthenticationToken auth = 
            new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                mockPrincipal, null, java.util.Collections.singletonList(new org.springframework.security.core.authority.SimpleGrantedAuthority(role))
        );
        org.springframework.security.core.context.SecurityContext context = org.springframework.security.core.context.SecurityContextHolder.createEmptyContext();
        context.setAuthentication(auth);
        org.springframework.security.core.context.SecurityContextHolder.setContext(context);
    }

    @Test
    @DisplayName("Customer A accessing Customer B's order returns 403 Forbidden")
    void testCustomerAAccessingCustomerBOrder_Returns403() {
        when(storefrontService.getGuestOrder("ORD-12345")).thenReturn(mockOrder);
        setupSecurityContext("1111111111", "ROLE_CUSTOMER");

        ResponseEntity<StorefrontOrderTrackingResponse> response = controller.getGuestOrderDetails("ORD-12345");
        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
    }
    
    @Test
    @DisplayName("Customer A accessing Customer B's invoice returns 403 Forbidden")
    void testCustomerAAccessingCustomerBInvoice_Returns403() throws Exception {
        when(storefrontService.getGuestOrder("ORD-12345")).thenReturn(mockOrder);
        setupSecurityContext("1111111111", "ROLE_CUSTOMER");

        ResponseEntity<byte[]> response = controller.downloadInvoice("ORD-12345");
        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
    }

    @Test
    @DisplayName("Customer accessing own order with matching phone returns 200 with sanitized DTO")
    void testCustomerAAccessingOwnOrder_Returns200() {
        when(storefrontService.getGuestOrder("ORD-12345")).thenReturn(mockOrder);
        setupSecurityContext("9876543210", "ROLE_CUSTOMER");

        ResponseEntity<StorefrontOrderTrackingResponse> response = controller.getGuestOrderDetails("ORD-12345");
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("ORD-12345", response.getBody().getOrderNumber());
        assertEquals("CONFIRMED", response.getBody().getStatus());
    }

    @Test
    @DisplayName("Customer accessing own invoice with matching phone returns 200")
    void testCustomerAAccessingOwnInvoice_Returns200() throws Exception {
        when(storefrontService.getGuestOrder("ORD-12345")).thenReturn(mockOrder);
        setupSecurityContext("9876543210", "ROLE_CUSTOMER");
        when(invoiceService.generateInvoice(mockOrder)).thenReturn(new byte[]{1, 2, 3});

        ResponseEntity<byte[]> response = controller.downloadInvoice("ORD-12345");
        assertEquals(HttpStatus.OK, response.getStatusCode());
    }

    @Test
    @DisplayName("Shop owner token accessing customer order tracking returns 403 Forbidden")
    void testShopOwnerToken_AccessingOrder_Returns403() {
        setupSecurityContext("9876543210", "ROLE_SHOP_OWNER");
        ResponseEntity<StorefrontOrderTrackingResponse> response = controller.getGuestOrderDetails("ORD-12345");
        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
    }

    @Test
    @DisplayName("Super admin token accessing customer order tracking returns 403 Forbidden")
    void testAdminToken_AccessingOrder_Returns403() {
        setupSecurityContext("9876543210", "ROLE_ADMIN");
        ResponseEntity<StorefrontOrderTrackingResponse> response = controller.getGuestOrderDetails("ORD-12345");
        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
    }
}
