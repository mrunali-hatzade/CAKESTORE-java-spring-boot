package com.cakeplatform.api.security;

import com.cakeplatform.api.modules.shop.Shop;
import com.cakeplatform.api.modules.shop.ShopRepository;
import com.cakeplatform.api.modules.shop.ShopStatus;
import com.cakeplatform.api.modules.shop.VerificationStatus;
import com.cakeplatform.api.modules.subscription.Subscription;
import com.cakeplatform.api.modules.subscription.SubscriptionRepository;
import com.cakeplatform.api.modules.subscription.SubscriptionStatus;
import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.modules.user.UserRepository;
import com.cakeplatform.api.modules.user.UserRole;
import com.cakeplatform.api.modules.user.UserStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import org.springframework.beans.factory.annotation.Autowired;

@Component
@org.springframework.context.annotation.Profile("!prod")
@ConditionalOnProperty(name = "app.demo-data.enabled", havingValue = "true")
@RequiredArgsConstructor
@Slf4j
public class AdminUserInitializer implements ApplicationRunner {

    private final UserRepository userRepository;
    private final ShopRepository shopRepository;
    private final SubscriptionRepository subscriptionRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.admin.default-email:admin@cakeplatform.com}")
    private String adminEmail;

    @Value("${app.admin.default-password:Password123!}")
    private String adminPassword;

    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        // 1. Initialize default admin
        User admin = resolveOrRestoreUser(adminEmail, "Platform Administrator", "9999999999", UserRole.ADMIN, adminPassword);
        log.info("Platform administrator role and credentials synchronized.");

        // 2. Initialize frontend demo admin
        resolveOrRestoreUser("admin@cakestore.com", "Demo Administrator", "9999999998", UserRole.ADMIN, "admin123");
        log.info("Demo administrator role and credentials synchronized.");

        // 3. Initialize frontend demo owner
        User demoOwner = resolveOrRestoreUser("owner@sweetdelight.com", "Sweet Delight Owner", "9876543210", UserRole.SHOP_OWNER, "password123");
        resolveOrRestoreShop(demoOwner, "Sweet Delight Bakery", "owner@sweetdelight.com", "9876543210", "Artisanal handcrafted cakes and confectionery", "Mumbai", "Maharashtra", "400001");
        log.info("Demo bakery owner and shop initialized successfully.");

        // 4. Initialize personal user account
        User personalUser = resolveOrRestoreUser("mrunalithatzade20@gmail.com", "Mrunali", "9876543211", UserRole.SHOP_OWNER, "password123");
        resolveOrRestoreShop(personalUser, "Mrunali's Artisanal Bakery", "mrunalithatzade20@gmail.com", "9876543211", "Handcrafted custom cakes & bakery delicacies", "Pune", "Maharashtra", "411001");
        log.info("Personal bakery account initialized successfully.");

        // 5. Initialize owner@example.com for testing convenience (matches auth.http)
        User exampleOwner = resolveOrRestoreUser("owner@example.com", "Demo Shop Owner", "9876543212", UserRole.SHOP_OWNER, "Password123!");
        resolveOrRestoreShop(exampleOwner, "Jane's Amazing Cakes", "owner@example.com", "9876543212", "Handcrafted custom cakes & bakery delicacies", "Pune", "Maharashtra", "411001");
        log.info("Demo owner@example.com initialized successfully.");
    }

    private void resolveOrRestoreShop(User owner, String businessName, String email, String phone, String description, String city, String state, String pincode) {
        java.util.List<Long> ids = jdbcTemplate.queryForList("SELECT id FROM shops WHERE owner_id = ?", Long.class, owner.getId());
        if (!ids.isEmpty()) {
            Long shopId = ids.get(0);
            jdbcTemplate.update("UPDATE shops SET is_deleted = false, status = 'ACTIVE' WHERE id = ?", shopId);
            jdbcTemplate.update("UPDATE subscriptions SET status = 'ACTIVE', expiry_date = ? WHERE shop_id = ?", 
                    LocalDateTime.now().plusMonths(1), shopId);
            return;
        }

        if (shopRepository.findByOwnerId(owner.getId()).isEmpty()) {
            Shop shop = new Shop();
            shop.setOwner(owner);
            shop.setBusinessName(businessName);
            shop.setEmail(email);
            shop.setPhone(phone);
            shop.setDescription(description);
            shop.setCity(city);
            shop.setState(state);
            shop.setPincode(pincode);
            shop.setStatus(ShopStatus.ACTIVE);
            shop.setVerificationStatus(VerificationStatus.VERIFIED);
            Shop savedShop = shopRepository.save(shop);

            Subscription subscription = new Subscription();
            subscription.setShop(savedShop);
            subscription.setStatus(SubscriptionStatus.ACTIVE);
            subscription.setAmount(new BigDecimal("999.00"));
            subscription.setStartDate(LocalDateTime.now());
            subscription.setExpiryDate(LocalDateTime.now().plusMonths(1));
            subscriptionRepository.save(subscription);
        }
    }

    private User resolveOrRestoreUser(String email, String fullName, String mobile, UserRole role, String password) {
        // First check if a soft-deleted record exists bypassing Hibernate's @SQLRestriction
        java.util.List<Long> ids = jdbcTemplate.queryForList("SELECT id FROM users WHERE email = ?", Long.class, email);
        if (!ids.isEmpty()) {
            Long id = ids.get(0);
            // Physically restore it and update fields
            jdbcTemplate.update("UPDATE users SET is_deleted = false, role = ?, password_hash = ?, status = 'ACTIVE' WHERE id = ?",
                    role.name(), passwordEncoder.encode(password), id);
            return userRepository.findById(id).orElseThrow();
        }

        // Try standard find
        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) {
            user = new User();
            user.setEmail(email);
            user.setFullName(fullName);
            user.setMobile(mobile);
            user.setRole(role);
            user.setStatus(UserStatus.ACTIVE);
        } else {
            user.setRole(role);
            user.setStatus(UserStatus.ACTIVE);
        }
        user.setPasswordHash(passwordEncoder.encode(password));
        return userRepository.save(user);
    }
}
