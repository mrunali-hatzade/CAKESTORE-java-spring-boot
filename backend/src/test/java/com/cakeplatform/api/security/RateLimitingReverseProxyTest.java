package com.cakeplatform.api.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.filter.ForwardedHeaderFilter;

import java.io.IOException;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

public class RateLimitingReverseProxyTest {

    private RateLimitingFilter rateLimitingFilter;
    private ForwardedHeaderFilter forwardedHeaderFilter;

    @BeforeEach
    void setUp() {
        rateLimitingFilter = new RateLimitingFilter();
        forwardedHeaderFilter = new ForwardedHeaderFilter();
    }

    private MockHttpServletResponse executeFilterChain(MockHttpServletRequest request) throws ServletException, IOException {
        MockHttpServletResponse response = new MockHttpServletResponse();

        // Simulate Spring's filter chain: ForwardedHeaderFilter (HIGHEST_PRECEDENCE) -> RateLimitingFilter
        FilterChain chain = new FilterChain() {
            @Override
            public void doFilter(ServletRequest req, ServletResponse res) throws IOException, ServletException {
                rateLimitingFilter.doFilter(req, res, new MockFilterChain());
            }
        };

        forwardedHeaderFilter.doFilter(request, response, chain);
        return response;
    }

    @Test
    @DisplayName("1. Direct request without proxy header resolves the underlying connection remote address")
    void testDirectRequest_UsesRemoteAddress() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
        request.setRemoteAddr("192.168.1.50");

        AtomicReference<String> capturedIp = new AtomicReference<>();
        forwardedHeaderFilter.doFilter(request, new MockHttpServletResponse(), (req, res) -> {
            capturedIp.set(req.getRemoteAddr());
        });

        assertEquals("192.168.1.50", capturedIp.get(), "Direct connection must use socket remote address");
    }

    @Test
    @DisplayName("2. Request passing through configured ForwardedHeaderFilter resolves expected client IP from X-Forwarded-For")
    void testForwardedRequest_ResolvesClientIp() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
        request.setRemoteAddr("10.0.0.1"); // Reverse proxy internal address
        request.addHeader("X-Forwarded-For", "203.0.113.195");

        AtomicReference<String> capturedIp = new AtomicReference<>();
        forwardedHeaderFilter.doFilter(request, new MockHttpServletResponse(), (req, res) -> {
            capturedIp.set(req.getRemoteAddr());
        });

        assertEquals("203.0.113.195", capturedIp.get(), "ForwardedHeaderFilter must extract true client IP from X-Forwarded-For");
    }

    @Test
    @DisplayName("3. Multi-proxy chain in X-Forwarded-For resolves the originating client IP")
    void testMultiProxyChain_ResolvesOriginClientIp() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
        request.setRemoteAddr("10.0.0.1"); // Immediate upstream reverse proxy
        request.addHeader("X-Forwarded-For", "198.51.100.42, 172.16.0.5");

        AtomicReference<String> capturedIp = new AtomicReference<>();
        forwardedHeaderFilter.doFilter(request, new MockHttpServletResponse(), (req, res) -> {
            capturedIp.set(req.getRemoteAddr());
        });

        assertEquals("198.51.100.42", capturedIp.get(), "Must resolve the first (originating) client IP in proxy chain");
    }

    @Test
    @DisplayName("4. Distinct client IPs behind reverse proxy do NOT share rate limit buckets")
    void testDistinctClientsBehindProxy_DoNotShareBuckets() throws Exception {
        String clientA_Ip = "203.0.113.10";
        String clientB_Ip = "203.0.113.20";

        // Client A makes 10 requests (reaches auth endpoint capacity)
        for (int i = 0; i < 10; i++) {
            MockHttpServletRequest reqA = new MockHttpServletRequest("POST", "/api/auth/login");
            reqA.setRemoteAddr("10.0.0.1"); // Same reverse proxy IP
            reqA.addHeader("X-Forwarded-For", clientA_Ip);
            MockHttpServletResponse resA = executeFilterChain(reqA);
            assertEquals(200, resA.getStatus(), "Client A request " + (i + 1) + " should succeed");
        }

        // Client A 11th request is blocked with HTTP 429
        MockHttpServletRequest reqA11 = new MockHttpServletRequest("POST", "/api/auth/login");
        reqA11.setRemoteAddr("10.0.0.1");
        reqA11.addHeader("X-Forwarded-For", clientA_Ip);
        MockHttpServletResponse resA11 = executeFilterChain(reqA11);
        assertEquals(429, resA11.getStatus(), "Client A should be rate-limited at 10 req/min");

        // Client B behind the SAME reverse proxy makes request 1 -> MUST SUCCEED (separate bucket)
        MockHttpServletRequest reqB = new MockHttpServletRequest("POST", "/api/auth/login");
        reqB.setRemoteAddr("10.0.0.1"); // Same reverse proxy IP!
        reqB.addHeader("X-Forwarded-For", clientB_Ip);
        MockHttpServletResponse resB = executeFilterChain(reqB);
        assertEquals(200, resB.getStatus(), "Client B must not be affected by Client A's rate-limiting");
    }

    @Test
    @DisplayName("5. Authentication rate limit (10 req/min) enforced per forwarded client IP")
    void testRateLimitEnforcedPerForwardedIp() throws Exception {
        String clientIp = "198.51.100.99";

        for (int i = 0; i < 10; i++) {
            MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/auth/login");
            req.setRemoteAddr("10.0.0.1");
            req.addHeader("X-Forwarded-For", clientIp);
            MockHttpServletResponse res = executeFilterChain(req);
            assertEquals(200, res.getStatus());
        }

        // 11th request
        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/auth/login");
        req.setRemoteAddr("10.0.0.1");
        req.addHeader("X-Forwarded-For", clientIp);
        MockHttpServletResponse res = executeFilterChain(req);
        assertEquals(429, res.getStatus());
        assertEquals("60", res.getHeader("Retry-After"));
    }
}

