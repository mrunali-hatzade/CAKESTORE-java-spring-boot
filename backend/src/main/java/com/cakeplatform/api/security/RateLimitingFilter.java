package com.cakeplatform.api.security;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class RateLimitingFilter implements Filter {

    // Tier 1: Auth endpoints (10 requests per minute per IP)
    private final Map<String, Bucket> authBuckets = new ConcurrentHashMap<>();

    // Tier 2: Abuse-sensitive public actions (20 requests per minute per IP)
    private final Map<String, Bucket> sensitiveBuckets = new ConcurrentHashMap<>();

    // Tier 3: General storefront browsing (120 requests per minute per IP)
    private final Map<String, Bucket> storefrontBuckets = new ConcurrentHashMap<>();

    private Bucket createBucket(int capacity, Duration refillDuration) {
        Refill refill = Refill.greedy(capacity, refillDuration);
        Bandwidth limit = Bandwidth.classic(capacity, refill);
        return Bucket.builder().addLimit(limit).build();
    }

    private String getClientIp(HttpServletRequest request) {
        String xf = request.getHeader("X-Forwarded-For");
        if (xf != null && !xf.trim().isEmpty()) {
            return xf.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest httpRequest = (HttpServletRequest) request;
        String uri = httpRequest.getRequestURI();

        // 1. Explicitly exempt server-to-server webhooks, health checks, and static uploads
        if (uri.startsWith("/api/webhooks/") || uri.equals("/api/health") || uri.startsWith("/uploads/")) {
            chain.doFilter(request, response);
            return;
        }

        // 2. Auth Endpoints: Strict 10 req/min
        if (uri.startsWith("/api/auth/") || (uri.startsWith("/api/customer/storefront/tracking/") && !uri.contains("/orders"))) {
            String ip = getClientIp(httpRequest);
            Bucket bucket = authBuckets.computeIfAbsent(ip, k -> createBucket(10, Duration.ofMinutes(1)));
            if (!bucket.tryConsume(1)) {
                sendRateLimitResponse((HttpServletResponse) response);
                return;
            }
        }
        // 3. Sensitive Public Endpoints: 20 req/min (coupons, payment verification, order checkout, enquiries)
        else if (isSensitiveEndpoint(uri)) {
            String ip = getClientIp(httpRequest);
            Bucket bucket = sensitiveBuckets.computeIfAbsent(ip, k -> createBucket(20, Duration.ofMinutes(1)));
            if (!bucket.tryConsume(1)) {
                sendRateLimitResponse((HttpServletResponse) response);
                return;
            }
        }
        // 4. Storefront General Browsing: Generous 120 req/min
        else if (uri.startsWith("/api/storefront/") || uri.startsWith("/api/customer/storefront/")) {
            String ip = getClientIp(httpRequest);
            Bucket bucket = storefrontBuckets.computeIfAbsent(ip, k -> createBucket(120, Duration.ofMinutes(1)));
            if (!bucket.tryConsume(1)) {
                sendRateLimitResponse((HttpServletResponse) response);
                return;
            }
        }

        chain.doFilter(request, response);
    }

    private boolean isSensitiveEndpoint(String uri) {
        return uri.contains("/verify-payment")
                || uri.contains("/create-payment-order")
                || uri.contains("/coupons/validate")
                || uri.contains("/quote")
                || uri.endsWith("/enquiry")
                || uri.startsWith("/api/contact/enquiries")
                || uri.startsWith("/api/owner/feedback")
                || uri.startsWith("/api/owner/media/upload")
                || isGuestOrderTrackingEndpoint(uri);
    }

    private boolean isGuestOrderTrackingEndpoint(String uri) {
        return (uri.startsWith("/api/storefront/shops/orders/") || uri.startsWith("/api/customer/storefront/orders/"))
                && uri.contains("ORD-");
    }

    private void sendRateLimitResponse(HttpServletResponse response) throws IOException {
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setHeader("Retry-After", "60");
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write("{\"error\":\"Too Many Requests\",\"message\":\"Rate limit exceeded. Please try again later.\",\"retryAfter\":60}");
    }
}
