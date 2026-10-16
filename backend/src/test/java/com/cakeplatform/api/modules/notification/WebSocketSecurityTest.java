package com.cakeplatform.api.modules.notification;

import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.modules.user.UserRole;
import com.cakeplatform.api.modules.user.UserStatus;
import com.cakeplatform.api.security.CustomUserDetails;
import com.cakeplatform.api.security.CustomUserDetailsService;
import com.cakeplatform.api.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WebSocketSecurityTest {

    @Mock
    private JwtService jwtService;

    @Mock
    private CustomUserDetailsService customUserDetailsService;

    @Mock
    private MessageChannel messageChannel;

    private WebSocketConfig webSocketConfig;
    private ChannelInterceptor interceptor;

    private User adminUser;
    private User ownerUser1;
    private User ownerUser2;
    private User customerUser;
    private User lockedUser;

    private CustomUserDetails adminDetails;
    private CustomUserDetails ownerDetails1;
    private CustomUserDetails ownerDetails2;
    private CustomUserDetails customerDetails;
    private CustomUserDetails lockedDetails;

    @BeforeEach
    void setUp() {
        webSocketConfig = new WebSocketConfig(jwtService, customUserDetailsService);
        interceptor = webSocketConfig.createSecurityChannelInterceptor();

        adminUser = new User();
        adminUser.setId(1L);
        adminUser.setEmail("admin@cakestore.com");
        adminUser.setRole(UserRole.ADMIN);
        adminUser.setStatus(UserStatus.ACTIVE);
        adminUser.setDeleted(false);
        adminDetails = new CustomUserDetails(adminUser);

        ownerUser1 = new User();
        ownerUser1.setId(101L);
        ownerUser1.setEmail("owner1@cakestore.com");
        ownerUser1.setRole(UserRole.SHOP_OWNER);
        ownerUser1.setStatus(UserStatus.ACTIVE);
        ownerUser1.setDeleted(false);
        ownerDetails1 = new CustomUserDetails(ownerUser1);

        ownerUser2 = new User();
        ownerUser2.setId(102L);
        ownerUser2.setEmail("owner2@cakestore.com");
        ownerUser2.setRole(UserRole.SHOP_OWNER);
        ownerUser2.setStatus(UserStatus.ACTIVE);
        ownerUser2.setDeleted(false);
        ownerDetails2 = new CustomUserDetails(ownerUser2);

        customerUser = new User();
        customerUser.setId(201L);
        customerUser.setEmail("cust@cakestore.com");
        customerUser.setRole(UserRole.CUSTOMER);
        customerUser.setStatus(UserStatus.ACTIVE);
        customerUser.setDeleted(false);
        customerDetails = new CustomUserDetails(customerUser);

        lockedUser = new User();
        lockedUser.setId(301L);
        lockedUser.setEmail("locked@cakestore.com");
        lockedUser.setRole(UserRole.SHOP_OWNER);
        lockedUser.setStatus(UserStatus.LOCKED);
        lockedUser.setDeleted(false);
        lockedDetails = new CustomUserDetails(lockedUser);
    }

    private Message<?> createConnectMessage(String token) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        if (token != null) {
            accessor.setNativeHeader("Authorization", "Bearer " + token);
        }
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }

    private Message<?> createSubscribeMessage(CustomUserDetails userDetails, String destination) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        accessor.setDestination(destination);
        if (userDetails != null) {
            UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                    userDetails, null, userDetails.getAuthorities()
            );
            accessor.setUser(auth);
        }
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }

    private Message<?> createSendMessage(CustomUserDetails userDetails, String destination) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SEND);
        accessor.setDestination(destination);
        if (userDetails != null) {
            UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                    userDetails, null, userDetails.getAuthorities()
            );
            accessor.setUser(auth);
        }
        return MessageBuilder.createMessage("hello".getBytes(), accessor.getMessageHeaders());
    }

    // -------------------------------------------------------------
    // CONNECT TESTS
    // -------------------------------------------------------------

    @Test
    @DisplayName("1. Valid Admin CONNECT succeeds and sets authentication")
    void testValidAdminConnect_succeeds() {
        when(jwtService.extractUsername("valid-admin-jwt")).thenReturn("admin@cakestore.com");
        when(customUserDetailsService.loadUserByUsername("admin@cakestore.com")).thenReturn(adminDetails);
        when(jwtService.isTokenValid("valid-admin-jwt", adminDetails)).thenReturn(true);

        Message<?> connectMsg = createConnectMessage("valid-admin-jwt");
        Message<?> result = interceptor.preSend(connectMsg, messageChannel);

        assertNotNull(result);
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(result);
        assertNotNull(accessor.getUser());
        assertEquals("admin@cakestore.com", accessor.getUser().getName());
    }

    @Test
    @DisplayName("2. CONNECT without JWT is rejected with AccessDeniedException")
    void testConnectWithoutJwt_rejected() {
        Message<?> connectMsg = createConnectMessage(null);

        AccessDeniedException ex = assertThrows(AccessDeniedException.class, () ->
                interceptor.preSend(connectMsg, messageChannel)
        );
        assertTrue(ex.getMessage().contains("Missing or invalid Authorization header"));
    }

    @Test
    @DisplayName("3. CONNECT with malformed or invalid JWT is rejected")
    void testConnectWithMalformedJwt_rejected() {
        when(jwtService.extractUsername("malformed-jwt")).thenReturn(null);

        Message<?> connectMsg = createConnectMessage("malformed-jwt");

        AccessDeniedException ex = assertThrows(AccessDeniedException.class, () ->
                interceptor.preSend(connectMsg, messageChannel)
        );
        assertTrue(ex.getMessage().contains("Authentication required: Invalid token subject"));
    }

    @Test
    @DisplayName("4. Expired JWT is rejected")
    void testConnectWithExpiredJwt_rejected() {
        when(jwtService.extractUsername("expired-jwt")).thenReturn("admin@cakestore.com");
        when(customUserDetailsService.loadUserByUsername("admin@cakestore.com")).thenReturn(adminDetails);
        when(jwtService.isTokenValid("expired-jwt", adminDetails)).thenReturn(false);

        Message<?> connectMsg = createConnectMessage("expired-jwt");

        AccessDeniedException ex = assertThrows(AccessDeniedException.class, () ->
                interceptor.preSend(connectMsg, messageChannel)
        );
        assertTrue(ex.getMessage().contains("Token is invalid or expired"));
    }

    @Test
    @DisplayName("5. Locked user account is rejected upon CONNECT")
    void testConnectWithLockedUser_rejected() {
        when(jwtService.extractUsername("locked-jwt")).thenReturn("locked@cakestore.com");
        when(customUserDetailsService.loadUserByUsername("locked@cakestore.com")).thenReturn(lockedDetails);
        when(jwtService.isTokenValid("locked-jwt", lockedDetails)).thenReturn(true);

        Message<?> connectMsg = createConnectMessage("locked-jwt");

        AccessDeniedException ex = assertThrows(AccessDeniedException.class, () ->
                interceptor.preSend(connectMsg, messageChannel)
        );
        assertTrue(ex.getMessage().contains("Account is inactive or locked"));
    }

    // -------------------------------------------------------------
    // SUBSCRIBE TESTS: ADMIN QUEUE
    // -------------------------------------------------------------

    @Test
    @DisplayName("6. Admin can subscribe to their own admin queue")
    void testAdminSubscribe_ownQueue_succeeds() {
        Message<?> msg = createSubscribeMessage(adminDetails, "/queue/admin-notifications-1");
        Message<?> result = interceptor.preSend(msg, messageChannel);
        assertNotNull(result);
    }

    @Test
    @DisplayName("7. Admin CANNOT subscribe to another admin's queue")
    void testAdminSubscribe_otherAdminQueue_rejected() {
        Message<?> msg = createSubscribeMessage(adminDetails, "/queue/admin-notifications-2");

        AccessDeniedException ex = assertThrows(AccessDeniedException.class, () ->
                interceptor.preSend(msg, messageChannel)
        );
        assertTrue(ex.getMessage().contains("Cannot subscribe to another administrator's notification queue"));
    }

    @Test
    @DisplayName("8. Shop owner CANNOT subscribe to an admin queue")
    void testOwnerSubscribe_adminQueue_rejected() {
        Message<?> msg = createSubscribeMessage(ownerDetails1, "/queue/admin-notifications-1");

        AccessDeniedException ex = assertThrows(AccessDeniedException.class, () ->
                interceptor.preSend(msg, messageChannel)
        );
        assertTrue(ex.getMessage().contains("Admin role required"));
    }

    @Test
    @DisplayName("9. Customer CANNOT subscribe to an admin queue")
    void testCustomerSubscribe_adminQueue_rejected() {
        Message<?> msg = createSubscribeMessage(customerDetails, "/queue/admin-notifications-1");

        AccessDeniedException ex = assertThrows(AccessDeniedException.class, () ->
                interceptor.preSend(msg, messageChannel)
        );
        assertTrue(ex.getMessage().contains("Admin role required"));
    }

    // -------------------------------------------------------------
    // SUBSCRIBE TESTS: OWNER QUEUE
    // -------------------------------------------------------------

    @Test
    @DisplayName("10. Shop owner can subscribe to their own owner queue")
    void testOwnerSubscribe_ownQueue_succeeds() {
        Message<?> msg = createSubscribeMessage(ownerDetails1, "/queue/notifications-101");
        Message<?> result = interceptor.preSend(msg, messageChannel);
        assertNotNull(result);
    }

    @Test
    @DisplayName("11. Shop owner CANNOT subscribe to another owner's queue")
    void testOwnerSubscribe_otherOwnerQueue_rejected() {
        Message<?> msg = createSubscribeMessage(ownerDetails1, "/queue/notifications-102");

        AccessDeniedException ex = assertThrows(AccessDeniedException.class, () ->
                interceptor.preSend(msg, messageChannel)
        );
        assertTrue(ex.getMessage().contains("Cannot subscribe to another shop owner's notification queue"));
    }

    @Test
    @DisplayName("12. Customer CANNOT subscribe to an owner queue")
    void testCustomerSubscribe_ownerQueue_rejected() {
        Message<?> msg = createSubscribeMessage(customerDetails, "/queue/notifications-101");

        AccessDeniedException ex = assertThrows(AccessDeniedException.class, () ->
                interceptor.preSend(msg, messageChannel)
        );
        assertTrue(ex.getMessage().contains("SHOP_OWNER role required"));
    }

    @Test
    @DisplayName("13. Admin CANNOT subscribe to an owner queue (policy isolation)")
    void testAdminSubscribe_ownerQueue_rejected() {
        Message<?> msg = createSubscribeMessage(adminDetails, "/queue/notifications-101");

        AccessDeniedException ex = assertThrows(AccessDeniedException.class, () ->
                interceptor.preSend(msg, messageChannel)
        );
        assertTrue(ex.getMessage().contains("SHOP_OWNER role required"));
    }

    // -------------------------------------------------------------
    // SUBSCRIBE TESTS: ANONYMOUS & MALFORMED DESTINATIONS
    // -------------------------------------------------------------

    @Test
    @DisplayName("14. Anonymous session subscribing is rejected")
    void testAnonymousSubscribe_rejected() {
        Message<?> msg = createSubscribeMessage(null, "/queue/admin-notifications-1");

        AccessDeniedException ex = assertThrows(AccessDeniedException.class, () ->
                interceptor.preSend(msg, messageChannel)
        );
        assertTrue(ex.getMessage().contains("Authentication required to subscribe"));
    }

    @Test
    @DisplayName("15. Wildcard and arbitrary destinations are rejected")
    void testWildcardAndArbitraryDestinations_rejected() {
        Message<?> msg1 = createSubscribeMessage(adminDetails, "/queue/**");
        assertThrows(AccessDeniedException.class, () -> interceptor.preSend(msg1, messageChannel));

        Message<?> msg2 = createSubscribeMessage(adminDetails, "/queue/admin-notifications-*");
        assertThrows(AccessDeniedException.class, () -> interceptor.preSend(msg2, messageChannel));

        Message<?> msg3 = createSubscribeMessage(adminDetails, "/topic/broadcast");
        assertThrows(AccessDeniedException.class, () -> interceptor.preSend(msg3, messageChannel));
    }

    @Test
    @DisplayName("16. Malformed destination format is rejected")
    void testMalformedDestination_rejected() {
        Message<?> msg = createSubscribeMessage(adminDetails, "/queue/admin-notifications-abc");

        AccessDeniedException ex = assertThrows(AccessDeniedException.class, () ->
                interceptor.preSend(msg, messageChannel)
        );
        assertTrue(ex.getMessage().contains("Subscription destination is not permitted"));
    }

    // -------------------------------------------------------------
    // SEND TESTS: CLIENT REJECTION
    // -------------------------------------------------------------

    @Test
    @DisplayName("17. Client-originated SEND is rejected unconditionally")
    void testClientSend_rejected() {
        Message<?> msg = createSendMessage(adminDetails, "/queue/admin-notifications-1");

        AccessDeniedException ex = assertThrows(AccessDeniedException.class, () ->
                interceptor.preSend(msg, messageChannel)
        );
        assertTrue(ex.getMessage().contains("Client-side publishing is disabled"));
    }

    // -------------------------------------------------------------
    // NON-INTERCEPTED FRAMES (DISCONNECT, HEARTBEAT)
    // -------------------------------------------------------------

    @Test
    @DisplayName("18. DISCONNECT frame passes through unhindered")
    void testDisconnect_passesThrough() {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.DISCONNECT);
        Message<?> msg = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        Message<?> result = interceptor.preSend(msg, messageChannel);
        assertNotNull(result);
    }
}
