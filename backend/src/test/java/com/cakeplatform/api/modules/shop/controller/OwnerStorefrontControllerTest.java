package com.cakeplatform.api.modules.shop.controller;

import com.cakeplatform.api.modules.shop.ShopBanner;
import com.cakeplatform.api.modules.shop.ShopBusinessHours;
import com.cakeplatform.api.modules.shop.dto.ShopBannerRequest;
import com.cakeplatform.api.modules.shop.service.OwnerStorefrontService;
import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.security.CustomUserDetails;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OwnerStorefrontControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private OwnerStorefrontService ownerStorefrontService;

    private CustomUserDetails mockUserDetails;
    private Long ownerId = 101L;

    @BeforeEach
    void setUp() {
        User user = new User();
        user.setId(ownerId);
        user.setRole(com.cakeplatform.api.modules.user.UserRole.SHOP_OWNER);
        mockUserDetails = new CustomUserDetails(user);
    }

    @Test
    void testGetBanners_Authorized() throws Exception {
        ShopBanner banner = new ShopBanner();
        banner.setId(1L);
        banner.setImageUrl("test.jpg");
        when(ownerStorefrontService.getBanners(ownerId)).thenReturn(List.of(banner));

        mockMvc.perform(get("/api/owner/storefront/banners")
                .with(user(mockUserDetails)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].imageUrl").value("test.jpg"));
    }

    @Test
    void testGetBanners_Unauthorized() throws Exception {
        mockMvc.perform(get("/api/owner/storefront/banners"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "CUSTOMER")
    void testGetBanners_ForbiddenForCustomer() throws Exception {
        mockMvc.perform(get("/api/owner/storefront/banners"))
                .andExpect(status().isForbidden());
    }

    @Test
    void testCreateBanner_Authorized() throws Exception {
        ShopBannerRequest request = new ShopBannerRequest();
        request.setImageUrl("test.jpg");

        ShopBanner banner = new ShopBanner();
        banner.setId(1L);
        banner.setImageUrl("test.jpg");

        when(ownerStorefrontService.createBanner(eq(ownerId), any(ShopBannerRequest.class))).thenReturn(banner);

        mockMvc.perform(post("/api/owner/storefront/banners")
                .with(user(mockUserDetails))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.imageUrl").value("test.jpg"));
    }

    @Test
    void testSaveBusinessHour_Success() throws Exception {
        com.cakeplatform.api.modules.shop.dto.ShopBusinessHoursRequest request =
                new com.cakeplatform.api.modules.shop.dto.ShopBusinessHoursRequest();
        request.setDayOfWeek("MONDAY");
        request.setIsOpen(true);
        request.setOpenTime(java.time.LocalTime.of(9, 0));
        request.setCloseTime(java.time.LocalTime.of(21, 0));

        ShopBusinessHours saved = new ShopBusinessHours();
        saved.setId(10L);
        saved.setDayOfWeek("MONDAY");
        saved.setIsOpen(true);
        saved.setOpenTime(java.time.LocalTime.of(9, 0));
        saved.setCloseTime(java.time.LocalTime.of(21, 0));

        when(ownerStorefrontService.saveBusinessHour(eq(ownerId), any(com.cakeplatform.api.modules.shop.dto.ShopBusinessHoursRequest.class)))
                .thenReturn(saved);

        mockMvc.perform(post("/api/owner/storefront/business-hours")
                .with(user(mockUserDetails))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dayOfWeek").value("MONDAY"))
                .andExpect(jsonPath("$.isOpen").value(true));
    }

    @Test
    void testSaveBusinessHour_Returns400_WhenServiceThrowsIllegalArgumentException() throws Exception {
        com.cakeplatform.api.modules.shop.dto.ShopBusinessHoursRequest request =
                new com.cakeplatform.api.modules.shop.dto.ShopBusinessHoursRequest();
        request.setDayOfWeek("MONDAY");
        request.setIsOpen(true);
        request.setOpenTime(java.time.LocalTime.of(21, 0));
        request.setCloseTime(java.time.LocalTime.of(9, 0));

        when(ownerStorefrontService.saveBusinessHour(eq(ownerId), any(com.cakeplatform.api.modules.shop.dto.ShopBusinessHoursRequest.class)))
                .thenThrow(new IllegalArgumentException("Closing time must be strictly after opening time"));

        mockMvc.perform(post("/api/owner/storefront/business-hours")
                .with(user(mockUserDetails))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Closing time must be strictly after opening time"));
    }

    @Test
    void testSaveBusinessHour_Returns400_WhenMissingRequiredDayOfWeek() throws Exception {
        String invalidJson = "{\"dayOfWeek\":\"\",\"isOpen\":true,\"openTime\":\"09:00:00\",\"closeTime\":\"21:00:00\"}";

        mockMvc.perform(post("/api/owner/storefront/business-hours")
                .with(user(mockUserDetails))
                .contentType(MediaType.APPLICATION_JSON)
                .content(invalidJson))
                .andExpect(status().isBadRequest());
    }

    @Test
    void testSaveBusinessHour_Returns400_WhenMissingIsOpenFlag() throws Exception {
        String invalidJson = "{\"dayOfWeek\":\"MONDAY\",\"openTime\":\"09:00:00\",\"closeTime\":\"21:00:00\"}";

        mockMvc.perform(post("/api/owner/storefront/business-hours")
                .with(user(mockUserDetails))
                .contentType(MediaType.APPLICATION_JSON)
                .content(invalidJson))
                .andExpect(status().isBadRequest());
    }
}

