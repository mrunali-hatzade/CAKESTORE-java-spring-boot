package com.cakeplatform.api.modules.notification;

import com.cakeplatform.api.security.CustomUserDetails;
import com.cakeplatform.api.security.CustomUserDetailsService;
import com.cakeplatform.api.security.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import java.security.Principal;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
@Slf4j
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final JwtService jwtService;
    private final CustomUserDetailsService customUserDetailsService;

    private static final Pattern ADMIN_NOTIF_PATTERN = Pattern.compile("^/queue/admin-notifications-(\\d+)$");
    private static final Pattern OWNER_NOTIF_PATTERN = Pattern.compile("^/queue/notifications-(\\d+)$");

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/queue");
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws-endpoint")
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(createSecurityChannelInterceptor());
    }

    public ChannelInterceptor createSecurityChannelInterceptor() {
        return new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
                if (accessor == null || accessor.getCommand() == null) {
                    return message;
                }

                StompCommand command = accessor.getCommand();

                if (StompCommand.CONNECT.equals(command)) {
                    if (!accessor.isMutable()) {
                        accessor = StompHeaderAccessor.wrap(message);
                    }
                    handleConnect(accessor);
                    return MessageBuilder.createMessage(message.getPayload(), accessor.getMessageHeaders());
                } else if (StompCommand.SUBSCRIBE.equals(command)) {
                    handleSubscribe(accessor);
                } else if (StompCommand.SEND.equals(command)) {
                    handleSend(accessor);
                }

                return message;
            }
        };
    }

    private void handleConnect(StompHeaderAccessor accessor) {
        String authHeader = accessor.getFirstNativeHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            log.warn("[WS-AUTH] STOMP CONNECT rejected: Missing or invalid Authorization Bearer header");
            throw new AccessDeniedException("Authentication required: Missing or invalid Authorization header");
        }

        String jwt = authHeader.substring(7).trim();
        if (jwt.isEmpty()) {
            log.warn("[WS-AUTH] STOMP CONNECT rejected: Empty JWT token");
            throw new AccessDeniedException("Authentication required: Empty JWT token");
        }

        try {
            String username = jwtService.extractUsername(jwt);
            if (username == null || username.trim().isEmpty()) {
                log.warn("[WS-AUTH] STOMP CONNECT rejected: Could not extract subject from JWT");
                throw new AccessDeniedException("Authentication required: Invalid token subject");
            }

            UserDetails userDetails = customUserDetailsService.loadUserByUsername(username);
            if (userDetails == null || !jwtService.isTokenValid(jwt, userDetails)) {
                log.warn("[WS-AUTH] STOMP CONNECT rejected: JWT validation failed for user '{}'", username);
                throw new AccessDeniedException("Authentication required: Token is invalid or expired");
            }

            if (!userDetails.isAccountNonLocked() || !userDetails.isEnabled()) {
                log.warn("[WS-AUTH] STOMP CONNECT rejected: Account is locked or disabled for user '{}'", username);
                throw new AccessDeniedException("Account is inactive or locked");
            }

            UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                    userDetails, null, userDetails.getAuthorities()
            );
            accessor.setUser(authToken);
            SecurityContextHolder.getContext().setAuthentication(authToken);
            log.info("[WS-AUTH] STOMP CONNECT authenticated for user '{}' with authorities {}", username, userDetails.getAuthorities());
        } catch (AccessDeniedException ade) {
            throw ade;
        } catch (Exception ex) {
            log.warn("[WS-AUTH] STOMP CONNECT rejected due to error: {}", ex.getMessage());
            throw new AccessDeniedException("Authentication failed: " + ex.getMessage(), ex);
        }
    }

    private void handleSubscribe(StompHeaderAccessor accessor) {
        Principal principal = accessor.getUser();
        if (!(principal instanceof Authentication auth) || !auth.isAuthenticated()) {
            log.warn("[WS-AUTH] STOMP SUBSCRIBE rejected: Unauthenticated session");
            throw new AccessDeniedException("Authentication required to subscribe to notifications");
        }

        Object principalObj = auth.getPrincipal();
        if (!(principalObj instanceof CustomUserDetails userDetails)) {
            log.warn("[WS-AUTH] STOMP SUBSCRIBE rejected: Incompatible principal type {}", principalObj != null ? principalObj.getClass() : "null");
            throw new AccessDeniedException("Invalid authentication principal");
        }

        String destination = accessor.getDestination();
        if (destination == null || destination.trim().isEmpty()) {
            log.warn("[WS-AUTH] STOMP SUBSCRIBE rejected: Destination is empty");
            throw new AccessDeniedException("Destination cannot be empty");
        }

        Long authenticatedUserId = userDetails.getId();
        boolean isAdmin = userDetails.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch("ROLE_ADMIN"::equals);
        boolean isOwner = userDetails.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch("ROLE_SHOP_OWNER"::equals);

        Matcher adminMatcher = ADMIN_NOTIF_PATTERN.matcher(destination);
        if (adminMatcher.matches()) {
            if (!isAdmin) {
                log.warn("[WS-AUTH] STOMP SUBSCRIBE rejected: Non-admin user {} tried to subscribe to admin destination {}", authenticatedUserId, destination);
                throw new AccessDeniedException("Access denied: Admin role required for destination " + destination);
            }
            Long targetUserId = Long.parseLong(adminMatcher.group(1));
            if (!authenticatedUserId.equals(targetUserId)) {
                log.warn("[WS-AUTH] STOMP SUBSCRIBE rejected: Admin {} tried to subscribe to admin {} destination", authenticatedUserId, targetUserId);
                throw new AccessDeniedException("Access denied: Cannot subscribe to another administrator's notification queue");
            }
            log.debug("[WS-AUTH] STOMP SUBSCRIBE authorized: Admin {} to {}", authenticatedUserId, destination);
            return;
        }

        Matcher ownerMatcher = OWNER_NOTIF_PATTERN.matcher(destination);
        if (ownerMatcher.matches()) {
            if (!isOwner) {
                log.warn("[WS-AUTH] STOMP SUBSCRIBE rejected: User {} without SHOP_OWNER role tried to subscribe to owner destination {}", authenticatedUserId, destination);
                throw new AccessDeniedException("Access denied: SHOP_OWNER role required for destination " + destination);
            }
            Long targetUserId = Long.parseLong(ownerMatcher.group(1));
            if (!authenticatedUserId.equals(targetUserId)) {
                log.warn("[WS-AUTH] STOMP SUBSCRIBE rejected: Owner {} tried to subscribe to owner {} destination", authenticatedUserId, targetUserId);
                throw new AccessDeniedException("Access denied: Cannot subscribe to another shop owner's notification queue");
            }
            log.debug("[WS-AUTH] STOMP SUBSCRIBE authorized: Owner {} to {}", authenticatedUserId, destination);
            return;
        }

        log.warn("[WS-AUTH] STOMP SUBSCRIBE rejected: Unknown or unauthorized destination '{}' for user {}", destination, authenticatedUserId);
        throw new AccessDeniedException("Access denied: Subscription destination is not permitted");
    }

    private void handleSend(StompHeaderAccessor accessor) {
        log.warn("[WS-AUTH] STOMP SEND rejected: Client publishing is disabled for destination '{}'", accessor.getDestination());
        throw new AccessDeniedException("Client-side publishing is disabled");
    }
}

