package com.cakeplatform.api.modules.storefront;

import com.cakeplatform.api.modules.order.InvoiceService;
import com.cakeplatform.api.modules.order.Order;
import com.cakeplatform.api.modules.storefront.dto.StorefrontOrderTrackingResponse;
import com.cakeplatform.api.modules.user.User;
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
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class CustomerStorefrontGuestTrackingTest {

    @Mock
    private CustomerStorefrontService storefrontService;

    @Mock
    private InvoiceService invoiceService;

    @InjectMocks
    private CustomerStorefrontController storefrontController;

    private Order testOrder;

    @BeforeEach
    void setUp() {
        testOrder = new Order();
        testOrder.setOrderNumber("ORD-12345");
        testOrder.setCustomerPhone("+91 9876543210");
        testOrder.setCustomerName("Test User");
        testOrder.setOrderStatus("CONFIRMED");
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private void setupAuthentication(String userPhone) {
        User mockUser = new User();
        mockUser.setMobile(userPhone);
        mockUser.setRole(com.cakeplatform.api.modules.user.UserRole.CUSTOMER);
        CustomUserDetails userDetails = new CustomUserDetails(mockUser);
        
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                userDetails, null, Collections.singletonList(new SimpleGrantedAuthority("ROLE_CUSTOMER"))
        );
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(auth);
        SecurityContextHolder.setContext(context);
    }
    
    private void setupAnonymousAuthentication() {
        AnonymousAuthenticationToken auth = new AnonymousAuthenticationToken(
                "key", "anonymousUser", Collections.singletonList(new SimpleGrantedAuthority("ROLE_ANONYMOUS"))
        );
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(auth);
        SecurityContextHolder.setContext(context);
    }

    private void setupNoAuthentication() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("1. Authenticated customer accessing their own order succeeds")
    void testAuthenticatedUser_OwnOrder_Success() {
        when(storefrontService.getGuestOrder("ORD-12345")).thenReturn(testOrder);
        setupAuthentication("9876543210");

        ResponseEntity<StorefrontOrderTrackingResponse> response = storefrontController.getGuestOrderDetails("ORD-12345");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("ORD-12345", response.getBody().getOrderNumber());
    }

    @Test
    @DisplayName("2. Authenticated customer accessing another customer's order is denied")
    void testAuthenticatedUser_OtherOrder_Forbidden() {
        when(storefrontService.getGuestOrder("ORD-12345")).thenReturn(testOrder);
        setupAuthentication("9999999999"); // Different phone

        ResponseEntity<StorefrontOrderTrackingResponse> response = storefrontController.getGuestOrderDetails("ORD-12345");

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
    }

    @Test
    @DisplayName("3. Unauthenticated request without JWT is denied (phone alone does not grant access)")
    void testUnauthenticatedGuest_PhoneAlone_Denied() {
        setupAnonymousAuthentication();

        ResponseEntity<StorefrontOrderTrackingResponse> response = storefrontController.getGuestOrderDetails("ORD-12345");

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
    }

    @Test
    @DisplayName("4. Unauthenticated request with null auth is denied")
    void testUnauthenticatedGuest_NoAuth_Unauthorized() {
        setupNoAuthentication();

        ResponseEntity<StorefrontOrderTrackingResponse> response = storefrontController.getGuestOrderDetails("ORD-12345");

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
    }

    @Test
    @DisplayName("5. Authenticated customer accessing own invoice succeeds")
    void testAuthenticatedCustomerInvoice_OwnOrder_Success() throws Exception {
        when(storefrontService.getGuestOrder("ORD-12345")).thenReturn(testOrder);
        when(invoiceService.generateInvoice(testOrder)).thenReturn(new byte[]{1, 2, 3});
        setupAuthentication("9876543210");

        ResponseEntity<byte[]> response = storefrontController.downloadInvoice("ORD-12345");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(3, response.getBody().length);
    }

    @Test
    @DisplayName("6. Unauthenticated invoice request without JWT is denied")
    void testUnauthenticatedInvoice_WithoutJwt_Denied() throws Exception {
        setupAnonymousAuthentication();

        ResponseEntity<byte[]> response = storefrontController.downloadInvoice("ORD-12345");

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
    }
}
