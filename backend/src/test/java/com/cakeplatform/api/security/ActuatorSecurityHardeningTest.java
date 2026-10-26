package com.cakeplatform.api.security;

import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.modules.user.UserRepository;
import com.cakeplatform.api.modules.user.UserRole;
import com.cakeplatform.api.modules.user.UserStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.HashMap;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class ActuatorSecurityHardeningTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        org.springframework.security.core.context.SecurityContextHolder.clearContext();
    }

    private String createBearerToken(String email, UserRole role) {
        User user = userRepository.findByEmailIgnoreCase(email).orElse(null);
        if (user == null) {
            user = new User();
            user.setEmail(email);
            user.setFullName("Test " + role.name());
            user.setPasswordHash(passwordEncoder.encode("Password123!"));
            user.setRole(role);
            user.setStatus(UserStatus.ACTIVE);
            user.setMobile("9" + String.format("%09d", Math.abs((long) email.hashCode() % 1000000000L)));
            user.setTokenVersion(1);
            user = userRepository.save(user);
        }
        CustomUserDetails userDetails = new CustomUserDetails(user);
        return jwtService.generateToken(new HashMap<>(), userDetails);
    }

    @Test
    @DisplayName("1. Anonymous caller can access /actuator/health")
    void testAnonymousAccessToHealthPermitted() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("2. Anonymous caller can access /actuator/health/readiness probe")
    void testAnonymousAccessToReadinessProbePermitted() throws Exception {
        mockMvc.perform(get("/actuator/health/readiness"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("3. Anonymous caller can access /actuator/health/liveness probe")
    void testAnonymousAccessToLivenessProbePermitted() throws Exception {
        mockMvc.perform(get("/actuator/health/liveness"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("4. Anonymous caller can access /actuator/info")
    void testAnonymousAccessToInfoPermitted() throws Exception {
        mockMvc.perform(get("/actuator/info"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("5. Anonymous caller to base /actuator is rejected with 401 Unauthorized")
    void testAnonymousAccessToBaseActuatorRejected() throws Exception {
        mockMvc.perform(get("/actuator"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("6. Anonymous caller to /actuator/prometheus is rejected with 401 Unauthorized")
    void testAnonymousAccessToPrometheusRejected() throws Exception {
        mockMvc.perform(get("/actuator/prometheus"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("7. Authenticated SHOP_OWNER is rejected from base /actuator with 403 Forbidden")
    void testShopOwnerAccessToBaseActuatorForbidden() throws Exception {
        String token = createBearerToken("actuator.owner1@cakestore.test", UserRole.SHOP_OWNER);

        mockMvc.perform(get("/actuator")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("8. Authenticated SHOP_OWNER is rejected from /actuator/prometheus with 403 Forbidden")
    void testShopOwnerAccessToPrometheusForbidden() throws Exception {
        String token = createBearerToken("actuator.owner2@cakestore.test", UserRole.SHOP_OWNER);

        mockMvc.perform(get("/actuator/prometheus")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("9. Authenticated CUSTOMER is rejected from /actuator/prometheus with 403 Forbidden")
    void testCustomerAccessToPrometheusForbidden() throws Exception {
        String token = createBearerToken("actuator.customer@cakestore.test", UserRole.CUSTOMER);

        mockMvc.perform(get("/actuator/prometheus")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("10. Authenticated ADMIN with JWT is authorized to access base /actuator discovery (200 OK)")
    void testAdminAccessToBaseActuatorAuthorized() throws Exception {
        String token = createBearerToken("actuator.admin@cakestore.test", UserRole.ADMIN);

        mockMvc.perform(get("/actuator")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("11. Authenticated ADMIN with SecurityMockPostProcessor is authorized on base /actuator (200 OK)")
    void testAdminMockUserAccessToBaseActuatorAuthorized() throws Exception {
        mockMvc.perform(get("/actuator")
                        .with(user("admin").authorities(new SimpleGrantedAuthority("ROLE_ADMIN"))))
                .andExpect(status().isOk());
    }
}
