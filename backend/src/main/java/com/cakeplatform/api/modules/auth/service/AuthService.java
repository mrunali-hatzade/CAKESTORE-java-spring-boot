package com.cakeplatform.api.modules.auth.service;

import com.cakeplatform.api.modules.auth.dto.AuthResponse;
import com.cakeplatform.api.modules.auth.dto.LoginRequest;
import com.cakeplatform.api.modules.auth.dto.RegisterRequest;
import com.cakeplatform.api.modules.shop.Shop;
import com.cakeplatform.api.modules.shop.ShopRepository;
import com.cakeplatform.api.modules.shop.ShopStatus;
import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.modules.user.UserRepository;
import com.cakeplatform.api.modules.user.UserRole;
import com.cakeplatform.api.modules.user.UserStatus;
import com.cakeplatform.api.security.CustomUserDetails;
import com.cakeplatform.api.security.JwtService;
import com.cakeplatform.api.modules.media.StorageService;
import com.cakeplatform.api.modules.shop.BusinessDocument;
import com.cakeplatform.api.modules.shop.BusinessDocumentRepository;
import com.cakeplatform.api.modules.notification.AdminNotificationCategory;
import com.cakeplatform.api.modules.notification.AdminNotificationPriority;
import com.cakeplatform.api.modules.notification.AdminNotificationService;
import com.cakeplatform.api.modules.notification.AdminNotificationType;

import com.cakeplatform.api.modules.auth.repository.PasswordResetTokenRepository;
import com.cakeplatform.api.modules.auth.entity.PasswordResetToken;
import com.cakeplatform.api.modules.email.EmailService;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import org.springframework.beans.factory.annotation.Value;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final ShopRepository shopRepository;
    private final com.cakeplatform.api.modules.subscription.SubscriptionRepository subscriptionRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final StorageService storageService;
    private final BusinessDocumentRepository businessDocumentRepository;
    private final AdminNotificationService adminNotificationService;
    private final com.cakeplatform.api.modules.location.service.LocationValidationService locationValidationService;

    @org.springframework.beans.factory.annotation.Autowired
    private PasswordResetTokenRepository passwordResetTokenRepository;
    
    @org.springframework.beans.factory.annotation.Autowired
    private EmailService emailService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.cakeplatform.api.modules.shop.ShopStorefrontSettingsRepository shopStorefrontSettingsRepository;
    
    @Value("${FRONTEND_BASE_URL:http://localhost:3001}")
    private String frontendBaseUrl;



    @org.springframework.beans.factory.annotation.Autowired
    public AuthService(
            UserRepository userRepository,
            ShopRepository shopRepository,
            com.cakeplatform.api.modules.subscription.SubscriptionRepository subscriptionRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            AuthenticationManager authenticationManager,
            StorageService storageService,
            BusinessDocumentRepository businessDocumentRepository,
            AdminNotificationService adminNotificationService,
            @org.springframework.beans.factory.annotation.Autowired(required = false)
            com.cakeplatform.api.modules.location.service.LocationValidationService locationValidationService) {
        this.userRepository = userRepository;
        this.shopRepository = shopRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.authenticationManager = authenticationManager;
        this.storageService = storageService;
        this.businessDocumentRepository = businessDocumentRepository;
        this.adminNotificationService = adminNotificationService;
        this.locationValidationService = locationValidationService;
    }

    public AuthService(
            UserRepository userRepository,
            ShopRepository shopRepository,
            com.cakeplatform.api.modules.subscription.SubscriptionRepository subscriptionRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            AuthenticationManager authenticationManager,
            StorageService storageService,
            BusinessDocumentRepository businessDocumentRepository,
            AdminNotificationService adminNotificationService) {
        this(userRepository, shopRepository, subscriptionRepository, passwordEncoder, jwtService, authenticationManager, storageService, businessDocumentRepository, adminNotificationService, null);
    }

    public static String normalizeEmail(String rawEmail) {
        if (rawEmail == null) {
            return null;
        }
        return rawEmail.trim().toLowerCase();
    }

    public static String normalizeIndianMobile(String rawMobile) {
        if (rawMobile == null) {
            return null;
        }
        String digitsOnly = rawMobile.replaceAll("\\D", "");
        if (digitsOnly.startsWith("91") && digitsOnly.length() == 12) {
            digitsOnly = digitsOnly.substring(2);
        } else if (digitsOnly.startsWith("0") && digitsOnly.length() == 11) {
            digitsOnly = digitsOnly.substring(1);
        }
        return digitsOnly.isEmpty() ? null : digitsOnly;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String normalizedEmail = normalizeEmail(request.getEmail());
        String normalizedMobile = normalizeIndianMobile(request.getMobile());
        String normalizedBusinessPhone = normalizeIndianMobile(request.getBusinessPhone());
        if (normalizedBusinessPhone == null || normalizedBusinessPhone.isEmpty()) {
            normalizedBusinessPhone = normalizedMobile;
        }

        // 0. Location Hierarchy Validation (Bakery Owner Registration)
        if (locationValidationService != null) {
            com.cakeplatform.api.modules.location.dto.LocationValidationDTO locDTO =
                    com.cakeplatform.api.modules.location.dto.LocationValidationDTO.builder()
                            .state(request.getState())
                            .district(request.getDistrict())
                            .city(request.getCity())
                            .area(request.getArea())
                            .pincode(request.getPincode())
                            .build();
            locationValidationService.validateLocation(locDTO);
        }

        java.util.Map<String, String> fieldErrors = new java.util.HashMap<>();

        // 1. Authoritative duplicate checks
        boolean emailExists = normalizedEmail != null && !normalizedEmail.isEmpty() 
                && (userRepository.findByEmail(normalizedEmail).isPresent() || userRepository.existsByEmailIgnoreCase(normalizedEmail));
        boolean mobileExists = normalizedMobile != null && !normalizedMobile.isEmpty() 
                && (userRepository.existsByMobile(normalizedMobile) || userRepository.findByMobile(normalizedMobile).isPresent());

        if (emailExists) {
            fieldErrors.put("email", "This email is already registered. Please login or use another email.");
        }
        if (mobileExists) {
            fieldErrors.put("mobile", "This phone number is already registered. Please use another number.");
        }

        if (!fieldErrors.isEmpty()) {
            String errorMsg;
            if (emailExists && mobileExists) {
                errorMsg = "Email and phone number are already registered.";
            } else if (emailExists) {
                errorMsg = fieldErrors.get("email");
            } else {
                errorMsg = fieldErrors.get("mobile");
            }
            throw new com.cakeplatform.api.exception.DuplicateResourceException(errorMsg, fieldErrors);
        }

        // 2. Create User
        User user = new User();
        user.setEmail(normalizedEmail);
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setFullName(request.getFullName() != null ? request.getFullName().trim() : null);
        user.setMobile(normalizedMobile);
        user.setRole(UserRole.SHOP_OWNER);
        user.setStatus(UserStatus.ACTIVE);
        
        User savedUser = userRepository.save(user);

        // 3. One Owner -> One Shop verification
        if (shopRepository.existsByOwnerId(savedUser.getId())) {
            throw new com.cakeplatform.api.exception.DuplicateResourceException("An owner account can only own one bakery store.");
        }

        // 4. Create Shop (PENDING)
        Shop shop = new Shop();
        shop.setOwner(savedUser);
        shop.setBusinessName(request.getBusinessName() != null ? request.getBusinessName().trim() : null);
        
        // Use provided business phone/email or fallback to user's canonical mobile/email
        shop.setPhone(normalizedBusinessPhone);
        shop.setEmail(request.getBusinessEmail() != null ? normalizeEmail(request.getBusinessEmail()) : normalizedEmail);
        
        shop.setDescription(request.getBusinessDescription());
        shop.setYearsInBusiness(request.getYearsInBusiness());
        shop.setFssaiRegistration(request.getFssaiRegistration());
        
        try {
            if (request.getBusinessType() != null) {
                shop.setBusinessType(com.cakeplatform.api.modules.shop.BusinessType.valueOf(request.getBusinessType().toUpperCase()));
            }
        } catch (IllegalArgumentException e) {
            // ignore or log
        }
        
        shop.setAddressLine1(request.getAddressLine1());
        shop.setAddressLine2(request.getAddressLine2());
        shop.setArea(request.getArea());
        shop.setCity(request.getCity());
        shop.setDistrict(request.getDistrict());
        shop.setState(request.getState());
        shop.setPincode(request.getPincode());
        shop.setLatitude(request.getLatitude());
        shop.setLongitude(request.getLongitude());
        
        // Also combine into existing full address field for backward compatibility
        String fullAddress = request.getAddressLine1();
        if (request.getAddressLine2() != null && !request.getAddressLine2().isEmpty()) {
            fullAddress += ", " + request.getAddressLine2();
        }
        shop.setAddress(fullAddress);
        
        shop.setStatus(ShopStatus.PENDING); // Explicitly set to PENDING
        shop.setVerificationStatus(com.cakeplatform.api.modules.shop.VerificationStatus.PROCESSING);

        Shop savedShop = shopRepository.save(shop);

        // Auto-enable address privacy by default for newly registered home bakers
        if (savedShop.getBusinessType() == com.cakeplatform.api.modules.shop.BusinessType.HOME_BAKERY && shopStorefrontSettingsRepository != null) {
            try {
                com.cakeplatform.api.modules.shop.ShopStorefrontSettings settings = com.cakeplatform.api.modules.shop.ShopStorefrontSettings.builder()
                        .shop(savedShop)
                        .hideStreetAddress(true)
                        .build();
                shopStorefrontSettingsRepository.save(settings);
            } catch (Exception ignored) {}
        }

        // 3. Dispatch Admin Notifications: NEW_BAKERY & BAKERY_AWAITING_APPROVAL
        try {
            adminNotificationService.dispatchAdminNotification(
                    AdminNotificationType.NEW_BAKERY,
                    "New Bakery Registered: " + savedShop.getBusinessName(),
                    String.format("%s registered by %s (%s) in %s, %s",
                            savedShop.getBusinessName(),
                            savedUser.getFullName(),
                            savedUser.getEmail(),
                            savedShop.getCity() != null ? savedShop.getCity() : "N/A",
                            savedShop.getState() != null ? savedShop.getState() : "N/A"),
                    AdminNotificationPriority.NORMAL,
                    AdminNotificationCategory.BAKERY,
                    savedShop.getId().toString(),
                    "SHOP",
                    "/admin/shops/" + savedShop.getId()
            );

            if (savedShop.getStatus() == ShopStatus.PENDING) {
                adminNotificationService.dispatchAdminNotification(
                        AdminNotificationType.BAKERY_AWAITING_APPROVAL,
                        "Bakery Awaiting Approval: " + savedShop.getBusinessName(),
                        String.format("%s is awaiting administrative review and approval.", savedShop.getBusinessName()),
                        AdminNotificationPriority.HIGH,
                        AdminNotificationCategory.BAKERY,
                        savedShop.getId().toString(),
                        "SHOP",
                        "/admin/shops/" + savedShop.getId()
                );
            }
        } catch (Exception ex) {
            log.error("Failed to dispatch admin notification for new bakery registration: {}", ex.getMessage());
        }

        // 4. Process Verification Document
        if (request.getVerificationFile() != null && !request.getVerificationFile().isEmpty()) {
            com.cakeplatform.api.modules.security.ShopContextHolder.setShopId(savedShop.getId());
            String fileUrl;
            try {
                fileUrl = storageService.storeFile(request.getVerificationFile(), "verifications");
            } finally {
                com.cakeplatform.api.modules.security.ShopContextHolder.clear();
            }
            
            BusinessDocument doc = new BusinessDocument();
            doc.setShop(savedShop);
            doc.setDocumentType(com.cakeplatform.api.modules.shop.DocumentType.FSSAI_CERTIFICATE);
            doc.setFileUrl(fileUrl);
            doc.setStatus(com.cakeplatform.api.modules.shop.VerificationStatus.PROCESSING);
            
            BusinessDocument savedDoc = businessDocumentRepository.save(doc);

            try {
                adminNotificationService.dispatchAdminNotification(
                        AdminNotificationType.VERIFICATION_SUBMITTED,
                        "Verification Submitted: " + savedShop.getBusinessName(),
                        String.format("FSSAI / Business document submitted for %s.", savedShop.getBusinessName()),
                        AdminNotificationPriority.HIGH,
                        AdminNotificationCategory.BAKERY,
                        savedDoc.getId().toString(),
                        "BUSINESS_DOCUMENT",
                        "/admin/shops/" + savedShop.getId()
                );
            } catch (Exception ex) {
                log.error("Failed to dispatch admin notification for verification document: {}", ex.getMessage());
            }
        }

        CustomUserDetails userDetails = new CustomUserDetails(savedUser);
        String jwtToken = jwtService.generateToken(userDetails);

        return AuthResponse.builder()
                .id(savedUser.getId())
                .shopId(savedShop != null ? savedShop.getId() : null)
                .token(jwtToken)
                .email(savedUser.getEmail())
                .role(savedUser.getRole().name())
                .fullName(savedUser.getFullName())
                .shopStatus(shop.getStatus().name())
                .subscriptionStatus("NONE")
                .build();
    }

    public AuthResponse login(LoginRequest request) {
        String rawIdentifier = request.getIdentifier();
        if (rawIdentifier == null || rawIdentifier.trim().isEmpty()) {
            throw new IllegalArgumentException("Mobile number or Email is required");
        }
        rawIdentifier = rawIdentifier.trim();

        // Check if identifier is an Indian mobile number
        String normalizedMobile = normalizeIndianMobile(rawIdentifier);
        String normalizedEmail = normalizeEmail(rawIdentifier);

        // Determine user lookup
        User user = null;
        if (normalizedMobile != null && !normalizedMobile.isEmpty()) {
            user = userRepository.findByMobile(normalizedMobile).orElse(null);
        }
        if (user == null) {
            user = userRepository.findByEmailIgnoreCase(normalizedEmail != null ? normalizedEmail : rawIdentifier).orElse(null);
        }

        if (user == null) {
            throw new IllegalArgumentException("Invalid user credentials");
        }

        // Authenticate via AuthenticationManager using the user's primary credential format
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        rawIdentifier,
                        request.getPassword()
                )
        );
                
        // Fetch shop status for the response
        java.util.Optional<Shop> ownerShop = shopRepository.findFirstByOwnerId(user.getId());
        String shopStatus = null;
        String subscriptionStatus = "NONE";
        
        if (ownerShop.isPresent()) {
            Shop shop = ownerShop.get();
            shopStatus = shop.getStatus().name();
            var latestSub = subscriptionRepository.findFirstByShopIdOrderByCreatedAtDesc(shop.getId());
            if (latestSub.isPresent()) {
                subscriptionStatus = latestSub.get().getStatus().name();
            }
        }

        CustomUserDetails userDetails = new CustomUserDetails(user);
        java.util.Map<String, Object> extraClaims = new java.util.HashMap<>();
        extraClaims.put("role", user.getRole().name());
        String jwtToken = jwtService.generateToken(extraClaims, userDetails);

        return AuthResponse.builder()
                .id(user.getId())
                .shopId(ownerShop.map(Shop::getId).orElse(null))
                .token(jwtToken)
                .email(user.getEmail())
                .role(user.getRole().name())
                .fullName(user.getFullName())
                .shopStatus(shopStatus)
                .subscriptionStatus(subscriptionStatus)
                .build();
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(token.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if(hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception e) {
            throw new RuntimeException("Failed to hash token", e);
        }
    }

    private String generateSecureToken() {
        SecureRandom random = new SecureRandom();
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        StringBuilder hexString = new StringBuilder();
        for (byte b : bytes) {
            String hex = Integer.toHexString(0xff & b);
            if(hex.length() == 1) hexString.append('0');
            hexString.append(hex);
        }
        return hexString.toString();
    }

    @Value("${password-reset.token-validity-minutes:15}")
    private int tokenValidityMinutes;

    @Transactional
    public void forgotPassword(String email) {
        String normalizedEmail = normalizeEmail(email);
        if (normalizedEmail == null) return;
        
        java.util.Optional<User> userOpt = userRepository.findByEmailIgnoreCase(normalizedEmail);
        if (userOpt.isEmpty()) {
            return;
        }
        
        User user = userOpt.get();
        if (passwordResetTokenRepository != null) {
            passwordResetTokenRepository.invalidateAllTokensForUser(user);
            
            String rawToken = generateSecureToken();
            String tokenHash = hashToken(rawToken);
            
            PasswordResetToken resetToken = new PasswordResetToken();
            resetToken.setUser(user);
            resetToken.setTokenHash(tokenHash);
            resetToken.setExpiryDate(LocalDateTime.now().plusMinutes(tokenValidityMinutes));
            resetToken.setUsed(false);
            passwordResetTokenRepository.save(resetToken);
            
            String resetLink = frontendBaseUrl + "/reset-password#token=" + rawToken;
            if (emailService != null) emailService.sendPasswordResetEmail(user.getEmail(), resetLink);
        }
    }

    @Transactional
    public void resetPassword(String token, String newPassword) {
        String tokenHash = hashToken(token);
        PasswordResetToken resetToken = passwordResetTokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> new IllegalArgumentException("Invalid or expired token"));
                
        if (resetToken.isUsed() || resetToken.getExpiryDate().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("Invalid or expired token");
        }
        
        if (newPassword == null || newPassword.length() < 8) {
            throw new IllegalArgumentException("Password must be at least 8 characters long");
        }
        
        User user = resetToken.getUser();
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        
        resetToken.setUsed(true);
        passwordResetTokenRepository.save(resetToken);
    }

    @Transactional
    public void changePassword(Long userId, String currentPassword, String newPassword) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new IllegalArgumentException("Current password is incorrect");
        }

        if (newPassword == null || newPassword.length() < 8) {
            throw new IllegalArgumentException("New password must be at least 8 characters long");
        }

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }
}
