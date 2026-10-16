package com.cakeplatform.api.modules.settings;

import com.cakeplatform.api.modules.settings.dto.GlobalSettingsDTO;
import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.modules.user.UserRepository;
import com.cakeplatform.api.modules.user.UserRole;
import com.cakeplatform.api.modules.user.UserStatus;
import com.cakeplatform.api.security.CustomUserDetails;
import com.cakeplatform.api.security.JwtService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@org.springframework.test.annotation.DirtiesContext(classMode = org.springframework.test.annotation.DirtiesContext.ClassMode.AFTER_CLASS)
public class AdminSettingsSecurityE2ETest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private GlobalSettingsService globalSettingsService;

    @Autowired
    private GlobalSettingsRepository globalSettingsRepository;

    private String adminToken;
    private String ownerToken;
    private String customerToken;

    private static final String TEST_RAW_KEY_SECRET = "super_secret_rzp_key_999";
    private static final String TEST_RAW_WEBHOOK_SECRET = "super_secret_rzp_webhook_888";

    @BeforeEach
    void setUp() {
        String uniq = UUID.randomUUID().toString().substring(0, 8);

        // 1. Admin User
        User admin = new User();
        admin.setEmail("admin_settings_" + uniq + "@test.com");
        admin.setPasswordHash("hashed_pw");
        admin.setRole(UserRole.ADMIN);
        admin.setStatus(UserStatus.ACTIVE);
        admin = userRepository.save(admin);
        adminToken = jwtService.generateToken(new CustomUserDetails(admin));

        // 2. Shop Owner User
        User owner = new User();
        owner.setEmail("owner_settings_" + uniq + "@test.com");
        owner.setPasswordHash("hashed_pw");
        owner.setRole(UserRole.SHOP_OWNER);
        owner.setStatus(UserStatus.ACTIVE);
        owner = userRepository.save(owner);
        ownerToken = jwtService.generateToken(new CustomUserDetails(owner));

        // 3. Customer User
        User customer = new User();
        customer.setEmail("customer_settings_" + uniq + "@test.com");
        customer.setPasswordHash("hashed_pw");
        customer.setRole(UserRole.CUSTOMER);
        customer.setStatus(UserStatus.ACTIVE);
        customer = userRepository.save(customer);
        customerToken = jwtService.generateToken(new CustomUserDetails(customer));

        // Initialize Settings with test credentials
        GlobalSettingsDTO initDTO = new GlobalSettingsDTO();
        initDTO.setPlatformName("CakeStore Platform");
        initDTO.setSupportEmail("support@cakestore.test");
        initDTO.setRazorpayKeyId("rzp_test_initial_key_id");
        initDTO.setRazorpayKeySecret(TEST_RAW_KEY_SECRET);
        initDTO.setRazorpayWebhookSecret(TEST_RAW_WEBHOOK_SECRET);
        initDTO.setPlatformCurrency("INR");
        globalSettingsService.updateSettings(initDTO);
    }

    @Test
    @DisplayName("AUTHENTICATION: Unauthenticated GET /api/admin/settings is rejected")
    void testUnauthenticatedGetSettingsRejected() throws Exception {
        mockMvc.perform(get("/api/admin/settings"))
                .andExpect(status().is4xxClientError());
    }

    @Test
    @DisplayName("AUTHENTICATION: Unauthenticated PUT /api/admin/settings is rejected")
    void testUnauthenticatedPutSettingsRejected() throws Exception {
        GlobalSettingsDTO dto = new GlobalSettingsDTO();
        dto.setPlatformName("Hacked Name");

        mockMvc.perform(put("/api/admin/settings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().is4xxClientError());
    }

    @Test
    @DisplayName("AUTHORIZATION: SHOP_OWNER token cannot GET /api/admin/settings")
    void testShopOwnerCannotGetSettings() throws Exception {
        mockMvc.perform(get("/api/admin/settings")
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("AUTHORIZATION: SHOP_OWNER token cannot PUT /api/admin/settings")
    void testShopOwnerCannotPutSettings() throws Exception {
        GlobalSettingsDTO dto = new GlobalSettingsDTO();
        dto.setPlatformName("Unauthorized Shop Owner Update");

        mockMvc.perform(put("/api/admin/settings")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("AUTHORIZATION: CUSTOMER token cannot GET /api/admin/settings")
    void testCustomerCannotGetSettings() throws Exception {
        mockMvc.perform(get("/api/admin/settings")
                        .header("Authorization", "Bearer " + customerToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("AUTHORIZATION: CUSTOMER token cannot PUT /api/admin/settings")
    void testCustomerCannotPutSettings() throws Exception {
        GlobalSettingsDTO dto = new GlobalSettingsDTO();
        dto.setPlatformName("Unauthorized Customer Update");

        mockMvc.perform(put("/api/admin/settings")
                        .header("Authorization", "Bearer " + customerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("DATA PROTECTION: ROLE_ADMIN GET /api/admin/settings returns settings without raw secrets")
    void testAdminCanGetSettingsWithoutExposingSecrets() throws Exception {
        mockMvc.perform(get("/api/admin/settings")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.platformName").value("CakeStore Platform"))
                .andExpect(jsonPath("$.supportEmail").value("support@cakestore.test"))
                .andExpect(jsonPath("$.razorpayKeyId").value("rzp_test_initial_key_id"))
                .andExpect(jsonPath("$.razorpayKeySecretConfigured").value(true))
                .andExpect(jsonPath("$.razorpayWebhookSecretConfigured").value(true))
                .andExpect(jsonPath("$.razorpayKeySecret").doesNotExist())
                .andExpect(jsonPath("$.razorpayWebhookSecret").doesNotExist())
                .andExpect(content().string(not(containsString(TEST_RAW_KEY_SECRET))))
                .andExpect(content().string(not(containsString(TEST_RAW_WEBHOOK_SECRET))));
    }

    @Test
    @DisplayName("FUNCTIONAL: ROLE_ADMIN PUT updates secrets securely and never echoes them back")
    void testAdminCanUpdateSettingsAndSecretsFunctionally() throws Exception {
        String newKeySecret = "updated_rzp_key_secret_777";
        String newWebhookSecret = "updated_rzp_webhook_secret_666";

        GlobalSettingsDTO updateDTO = new GlobalSettingsDTO();
        updateDTO.setPlatformName("CakeStore Artisanal Network");
        updateDTO.setSupportEmail("help@cakestore.in");
        updateDTO.setRazorpayKeyId("rzp_test_new_key_id");
        updateDTO.setRazorpayKeySecret(newKeySecret);
        updateDTO.setRazorpayWebhookSecret(newWebhookSecret);
        updateDTO.setPlatformCurrency("INR");

        mockMvc.perform(put("/api/admin/settings")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateDTO)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.platformName").value("CakeStore Artisanal Network"))
                .andExpect(jsonPath("$.supportEmail").value("help@cakestore.in"))
                .andExpect(jsonPath("$.razorpayKeyId").value("rzp_test_new_key_id"))
                .andExpect(jsonPath("$.razorpayKeySecretConfigured").value(true))
                .andExpect(jsonPath("$.razorpayWebhookSecretConfigured").value(true))
                .andExpect(jsonPath("$.razorpayKeySecret").doesNotExist())
                .andExpect(jsonPath("$.razorpayWebhookSecret").doesNotExist())
                .andExpect(content().string(not(containsString(newKeySecret))))
                .andExpect(content().string(not(containsString(newWebhookSecret))));

        // Authoritatively verify internal service state contains updated secret values
        GlobalSettings internalSettings = globalSettingsService.getSettings();
        assertEquals("CakeStore Artisanal Network", internalSettings.getPlatformName());
        assertEquals(newKeySecret, internalSettings.getRazorpayKeySecret());
        assertEquals(newWebhookSecret, internalSettings.getRazorpayWebhookSecret());
    }

    @Test
    @DisplayName("PRESERVATION: Leaving secrets blank preserves existing configured secrets")
    void testBlankSecretInUpdatePreservesExistingSecret() throws Exception {
        GlobalSettingsDTO partialDTO = new GlobalSettingsDTO();
        partialDTO.setPlatformName("CakeStore Renamed Only");
        partialDTO.setRazorpayKeySecret(""); // Empty string indicating no change
        partialDTO.setRazorpayWebhookSecret(null); // Null indicating no change

        mockMvc.perform(put("/api/admin/settings")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(partialDTO)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.platformName").value("CakeStore Renamed Only"))
                .andExpect(jsonPath("$.razorpayKeySecretConfigured").value(true))
                .andExpect(jsonPath("$.razorpayWebhookSecretConfigured").value(true));

        // Verify secrets were NOT erased
        GlobalSettings internalSettings = globalSettingsService.getSettings();
        assertEquals(TEST_RAW_KEY_SECRET, internalSettings.getRazorpayKeySecret());
        assertEquals(TEST_RAW_WEBHOOK_SECRET, internalSettings.getRazorpayWebhookSecret());
    }

    @Test
    @DisplayName("VALIDATION: Blank platformName (empty string) is rejected with HTTP 400")
    void testBlankPlatformNameEmptyRejected() throws Exception {
        GlobalSettingsDTO invalidDTO = new GlobalSettingsDTO();
        invalidDTO.setPlatformName("");

        mockMvc.perform(put("/api/admin/settings")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidDTO)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("VALIDATION: Blank platformName (whitespace only) is rejected with HTTP 400")
    void testBlankPlatformNameWhitespaceRejected() throws Exception {
        GlobalSettingsDTO invalidDTO = new GlobalSettingsDTO();
        invalidDTO.setPlatformName("    ");

        mockMvc.perform(put("/api/admin/settings")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidDTO)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("VALIDATION: Oversized platformName (> 255 chars) is rejected with HTTP 400")
    void testOversizedPlatformNameRejected() throws Exception {
        GlobalSettingsDTO invalidDTO = new GlobalSettingsDTO();
        invalidDTO.setPlatformName("A".repeat(256));

        mockMvc.perform(put("/api/admin/settings")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidDTO)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("VALIDATION: Malformed non-empty supportEmail is rejected with HTTP 400")
    void testMalformedSupportEmailRejected() throws Exception {
        GlobalSettingsDTO invalidDTO = new GlobalSettingsDTO();
        invalidDTO.setSupportEmail("not-a-valid-email");

        mockMvc.perform(put("/api/admin/settings")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidDTO)))
                .andExpect(status().isBadRequest());

        GlobalSettingsDTO invalidDTO2 = new GlobalSettingsDTO();
        invalidDTO2.setSupportEmail("missingdomain@");

        mockMvc.perform(put("/api/admin/settings")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidDTO2)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("VALIDATION: Blank supportEmail is rejected with HTTP 400")
    void testBlankSupportEmailRejected() throws Exception {
        GlobalSettingsDTO invalidDTO = new GlobalSettingsDTO();
        invalidDTO.setSupportEmail("   ");

        mockMvc.perform(put("/api/admin/settings")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidDTO)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("VALIDATION: Oversized supportEmail (> 255 chars) is rejected with HTTP 400")
    void testOversizedSupportEmailRejected() throws Exception {
        GlobalSettingsDTO invalidDTO = new GlobalSettingsDTO();
        invalidDTO.setSupportEmail("a".repeat(245) + "@domain.com");

        mockMvc.perform(put("/api/admin/settings")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidDTO)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("VALIDATION: Valid platformName and supportEmail update successfully with HTTP 200")
    void testValidPlatformNameAndEmailAccepted() throws Exception {
        GlobalSettingsDTO validDTO = new GlobalSettingsDTO();
        validDTO.setPlatformName("Sweet Delights Co.");
        validDTO.setSupportEmail("contact@sweetdelights.co");

        mockMvc.perform(put("/api/admin/settings")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validDTO)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.platformName").value("Sweet Delights Co."))
                .andExpect(jsonPath("$.supportEmail").value("contact@sweetdelights.co"));
    }

    @Test
    @DisplayName("PARTIAL UPDATE: Omitted fields preserve existing values without overwrite")
    void testPartialUpdatePreservesOmittedFields() throws Exception {
        // Current state: platformName="CakeStore Platform", supportEmail="support@cakestore.test", platformCurrency="INR"
        GlobalSettingsDTO partialDTO = new GlobalSettingsDTO();
        partialDTO.setPlatformName("New Single Updated Name");
        // supportEmail, razorpayKeyId, secrets, platformCurrency are all omitted (null)

        mockMvc.perform(put("/api/admin/settings")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(partialDTO)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.platformName").value("New Single Updated Name"))
                .andExpect(jsonPath("$.supportEmail").value("support@cakestore.test"))
                .andExpect(jsonPath("$.platformCurrency").value("INR"))
                .andExpect(jsonPath("$.razorpayKeyId").value("rzp_test_initial_key_id"))
                .andExpect(jsonPath("$.razorpayKeySecretConfigured").value(true))
                .andExpect(jsonPath("$.razorpayWebhookSecretConfigured").value(true));

        GlobalSettings settings = globalSettingsService.getSettings();
        assertEquals("New Single Updated Name", settings.getPlatformName());
        assertEquals("support@cakestore.test", settings.getSupportEmail());
        assertEquals("INR", settings.getPlatformCurrency());
        assertEquals(TEST_RAW_KEY_SECRET, settings.getRazorpayKeySecret());
    }

    @Test
    @DisplayName("CURRENCY: Updating platformCurrency persists and returns on reload")
    void testPlatformCurrencyUpdateAndPersistence() throws Exception {
        GlobalSettingsDTO currencyDTO = new GlobalSettingsDTO();
        currencyDTO.setPlatformCurrency("USD");

        mockMvc.perform(put("/api/admin/settings")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(currencyDTO)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.platformCurrency").value("USD"));

        // Verify GET returns updated currency
        mockMvc.perform(get("/api/admin/settings")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.platformCurrency").value("USD"));

        GlobalSettings settings = globalSettingsService.getSettings();
        assertEquals("USD", settings.getPlatformCurrency());
    }
}
