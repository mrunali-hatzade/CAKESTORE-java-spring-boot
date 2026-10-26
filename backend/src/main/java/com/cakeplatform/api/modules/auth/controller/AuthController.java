package com.cakeplatform.api.modules.auth.controller;

import com.cakeplatform.api.modules.auth.dto.AuthResponse;
import com.cakeplatform.api.modules.auth.dto.LoginRequest;
import com.cakeplatform.api.modules.auth.dto.RegisterRequest;
import com.cakeplatform.api.modules.auth.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.ModelAttribute;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping(value = "/register", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<AuthResponse> register(
            @Valid @ModelAttribute RegisterRequest request
    ) {
        return ResponseEntity.ok(authService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(
            @Valid @RequestBody LoginRequest request
    ) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<java.util.Map<String, String>> forgotPassword(
            @Valid @RequestBody com.cakeplatform.api.modules.auth.dto.ForgotPasswordRequest request
    ) {
        authService.forgotPassword(request.getEmail());
        java.util.Map<String, String> response = new java.util.HashMap<>();
        response.put("message", "If an account with that email exists, a password reset link has been sent.");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/reset-password")
    public ResponseEntity<java.util.Map<String, String>> resetPassword(
            @Valid @RequestBody com.cakeplatform.api.modules.auth.dto.ResetPasswordRequest request
    ) {
        authService.resetPassword(request.getToken(), request.getNewPassword());
        java.util.Map<String, String> response = new java.util.HashMap<>();
        response.put("message", "Password has been successfully reset.");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/change-password")
    public ResponseEntity<java.util.Map<String, String>> changePassword(
            @Valid @RequestBody com.cakeplatform.api.modules.auth.dto.ChangePasswordRequest request,
            @org.springframework.security.core.annotation.AuthenticationPrincipal com.cakeplatform.api.security.CustomUserDetails userDetails
    ) {
        authService.changePassword(userDetails.getId(), request.getCurrentPassword(), request.getNewPassword());
        java.util.Map<String, String> response = new java.util.HashMap<>();
        response.put("message", "Password has been successfully changed.");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/logout")
    public ResponseEntity<java.util.Map<String, String>> logout(
            jakarta.servlet.http.HttpServletRequest request,
            @org.springframework.security.core.annotation.AuthenticationPrincipal com.cakeplatform.api.security.CustomUserDetails userDetails
    ) {
        String authHeader = request.getHeader("Authorization");
        String rawToken = (authHeader != null && authHeader.startsWith("Bearer ")) ? authHeader.substring(7) : null;
        authService.logout(rawToken, userDetails != null ? userDetails.getUser() : null);
        java.util.Map<String, String> response = new java.util.HashMap<>();
        response.put("message", "Successfully logged out.");
        return ResponseEntity.ok(response);
    }
}
