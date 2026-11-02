-- Seed development shops for CakeStore Marketplace V2 Real Testing
-- Production-quality seed data for Pune & Pimpri-Chinchwad region

-- 1. Ensure dedicated shop owner user accounts exist
INSERT INTO users (email, password_hash, role, full_name, mobile, status, is_deleted)
VALUES
('owner@example.com', '$2a$10$bVeUDfataJ6KUMZqEMrQ0.JQKHzOCw0M6TkRjSuoiQbqZOVdydQhu', 'SHOP_OWNER', 'Mrunali Hatzade', '+91 9876543210', 'ACTIVE', false),
('ravet.studio@example.com', '$2a$10$bVeUDfataJ6KUMZqEMrQ0.JQKHzOCw0M6TkRjSuoiQbqZOVdydQhu', 'SHOP_OWNER', 'Chef Ananya Sharma', '+91 9876543211', 'ACTIVE', false),
('nigdi.sweets@example.com', '$2a$10$bVeUDfataJ6KUMZqEMrQ0.JQKHzOCw0M6TkRjSuoiQbqZOVdydQhu', 'SHOP_OWNER', 'Vikram Patil', '+91 9876543212', 'ACTIVE', false),
('baner.dessert@example.com', '$2a$10$bVeUDfataJ6KUMZqEMrQ0.JQKHzOCw0M6TkRjSuoiQbqZOVdydQhu', 'SHOP_OWNER', 'Chef Pierre Deshmukh', '+91 9876543213', 'ACTIVE', false),
('wakad.cloud@example.com', '$2a$10$bVeUDfataJ6KUMZqEMrQ0.JQKHzOCw0M6TkRjSuoiQbqZOVdydQhu', 'SHOP_OWNER', 'Rohan Kulkarni', '+91 9876543214', 'ACTIVE', false),
('kothrud.bakes@example.com', '$2a$10$bVeUDfataJ6KUMZqEMrQ0.JQKHzOCw0M6TkRjSuoiQbqZOVdydQhu', 'SHOP_OWNER', 'Sunita Joshi', '+91 9876543215', 'ACTIVE', false),
('pending.baker@example.com', '$2a$10$bVeUDfataJ6KUMZqEMrQ0.JQKHzOCw0M6TkRjSuoiQbqZOVdydQhu', 'SHOP_OWNER', 'Suresh Shinde', '+91 9999900001', 'ACTIVE', false),
('inactive.studio@example.com', '$2a$10$bVeUDfataJ6KUMZqEMrQ0.JQKHzOCw0M6TkRjSuoiQbqZOVdydQhu', 'SHOP_OWNER', 'Kavita Gore', '+91 9999900002', 'ACTIVE', false),
('suspended.cloud@example.com', '$2a$10$bVeUDfataJ6KUMZqEMrQ0.JQKHzOCw0M6TkRjSuoiQbqZOVdydQhu', 'SHOP_OWNER', 'Gaurav Mane', '+91 9999900003', 'ACTIVE', false)
ON CONFLICT (email) DO UPDATE 
SET status = 'ACTIVE', is_deleted = false, role = 'SHOP_OWNER';

-- 2. Realistic ACTIVE Bakeries with coordinates, business types, and branding
INSERT INTO shops (
    owner_id, business_name, description, phone, email, address, area, city, district, state, pincode, 
    latitude, longitude, business_category, business_type, status, verification_status,
    is_owner_enabled, is_marketplace_restricted, timezone, cover_image_url, logo_url
)
VALUES 
(
    (SELECT id FROM users WHERE email = 'owner@example.com' LIMIT 1),
    'Akurdi Artisan Bakes',
    'Handcrafted customized birthday and truffle cakes made with premium Belgian chocolate.',
    '+91 9876543210',
    'akurdi.bakes@example.com',
    'Shop 4, Near Akurdi Railway Station, Sector 28',
    'Akurdi',
    'Pimpri-Chinchwad',
    'Pune',
    'Maharashtra',
    '411035',
    18.6495,
    73.7707,
    'Custom Cakes',
    'HOME_BAKERY',
    'ACTIVE',
    'VERIFIED',
    true,
    false,
    'Asia/Kolkata',
    'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&w=200&q=80'
),
(
    (SELECT id FROM users WHERE email = 'ravet.studio@example.com' LIMIT 1),
    'Ravet Cake Studio',
    'Boutique cake studio specializing in layered celebration cakes, macarons and cupcakes.',
    '+91 9876543211',
    'ravet.studio@example.com',
    'Plot 12, Shinde Vasti, Ravet BRTS Road',
    'Ravet',
    'Pimpri-Chinchwad',
    'Pune',
    'Maharashtra',
    '412101',
    18.6477,
    73.7439,
    'Artisan Pastries',
    'CAKE_STUDIO',
    'ACTIVE',
    'VERIFIED',
    true,
    false,
    'Asia/Kolkata',
    'https://images.unsplash.com/photo-1535141192574-5d4897c13136?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&w=200&q=80'
),
(
    (SELECT id FROM users WHERE email = 'nigdi.sweets@example.com' LIMIT 1),
    'Nigdi Sweet Treats',
    'Freshly baked everyday sponge cakes, eggless pastries and tea cakes.',
    '+91 9876543212',
    'nigdi.sweets@example.com',
    'Main Market, Pradhikaran, Nigdi',
    'Nigdi',
    'Pimpri-Chinchwad',
    'Pune',
    'Maharashtra',
    '411044',
    18.6548,
    73.7667,
    'Bakery Shop',
    'BAKERY_SHOP',
    'ACTIVE',
    'VERIFIED',
    true,
    false,
    'Asia/Kolkata',
    'https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&w=200&q=80'
),
(
    (SELECT id FROM users WHERE email = 'baner.dessert@example.com' LIMIT 1),
    'Baner Dessert Boutique',
    'Artisan European desserts, mousse cakes and custom anniversary centerpieces.',
    '+91 9876543213',
    'baner.dessert@example.com',
    'High Street, Baner Road',
    'Baner',
    'Pune',
    'Pune',
    'Maharashtra',
    '411045',
    18.5590,
    73.7868,
    'Dessert Studio',
    'CAKE_STUDIO',
    'ACTIVE',
    'VERIFIED',
    true,
    false,
    'Asia/Kolkata',
    'https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&w=200&q=80'
),
(
    (SELECT id FROM users WHERE email = 'wakad.cloud@example.com' LIMIT 1),
    'Wakad Cloud Cakes',
    'Online cloud bakery offering express 2-hour doorstep deliveries for midnight birthdays.',
    '+91 9876543214',
    'wakad.cloud@example.com',
    'Dange Chowk, Wakad',
    'Wakad',
    'Pune',
    'Pune',
    'Maharashtra',
    '411057',
    18.5987,
    73.7684,
    'Online Bakery',
    'ONLINE_CAKE_BUSINESS',
    'ACTIVE',
    'VERIFIED',
    true,
    false,
    'Asia/Kolkata',
    'https://images.unsplash.com/photo-1557925923-cd4648e211a0?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&w=200&q=80'
),
(
    (SELECT id FROM users WHERE email = 'kothrud.bakes@example.com' LIMIT 1),
    'Kothrud Heritage Bakes',
    'Traditional Maharashtrian tea cakes, mawa cakes and authentic oven-fresh bakes.',
    '+91 9876543215',
    'kothrud.bakes@example.com',
    'Near Karve Statue, Kothrud',
    'Kothrud',
    'Pune',
    'Pune',
    'Maharashtra',
    '411038',
    18.5074,
    73.8077,
    'Bakery Shop',
    'BAKERY_SHOP',
    'ACTIVE',
    'VERIFIED',
    true,
    false,
    'Asia/Kolkata',
    'https://images.unsplash.com/photo-1519869325930-281384150729?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&w=200&q=80'
);

-- 3. Non-ACTIVE Shops to verify marketplace filter boundaries (PENDING, INACTIVE, SUSPENDED)
INSERT INTO shops (
    owner_id, business_name, description, phone, email, address, area, city, district, state, pincode, 
    latitude, longitude, business_category, business_type, status, verification_status,
    is_owner_enabled, is_marketplace_restricted, timezone
)
VALUES 
(
    (SELECT id FROM users WHERE email = 'pending.baker@example.com' LIMIT 1),
    'Pending Baker Akurdi',
    'Akurdi home baker currently undergoing verification.',
    '+91 9999900001',
    'pending.akurdi@example.com',
    'Sector 27, Akurdi',
    'Akurdi',
    'Pimpri-Chinchwad',
    'Pune',
    'Maharashtra',
    '411035',
    18.6490,
    73.7710,
    'Custom Cakes',
    'HOME_BAKERY',
    'PENDING',
    'PROCESSING',
    true,
    false,
    'Asia/Kolkata'
),
(
    (SELECT id FROM users WHERE email = 'inactive.studio@example.com' LIMIT 1),
    'Inactive Studio Baner',
    'Temporarily closed boutique studio.',
    '+91 9999900002',
    'inactive.baner@example.com',
    'Baner Link Road',
    'Baner',
    'Pune',
    'Pune',
    'Maharashtra',
    '411045',
    18.5595,
    73.7870,
    'Dessert Studio',
    'CAKE_STUDIO',
    'INACTIVE',
    'VERIFIED',
    false,
    false,
    'Asia/Kolkata'
),
(
    (SELECT id FROM users WHERE email = 'suspended.cloud@example.com' LIMIT 1),
    'Suspended Cakes Wakad',
    'Bakery suspended due to policy violation.',
    '+91 9999900003',
    'suspended.wakad@example.com',
    'Datta Mandir Road, Wakad',
    'Wakad',
    'Pune',
    'Pune',
    'Maharashtra',
    '411057',
    18.5990,
    73.7680,
    'Online Bakery',
    'ONLINE_CAKE_BUSINESS',
    'SUSPENDED',
    'VERIFIED',
    true,
    true,
    'Asia/Kolkata'
);

-- 4. Active Subscriptions for all active bakeries
INSERT INTO subscriptions (shop_id, status, amount, start_date, expiry_date)
SELECT s.id, 'ACTIVE', 999.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 year'
FROM shops s
WHERE s.status = 'ACTIVE';

-- 5. Delivery Configuration for all active bakeries (Radius 20 km & Free Delivery above ₹1000)
INSERT INTO shop_delivery_configs (
    shop_id, delivery_charge_type, fixed_charge_amount, min_order_for_free_delivery, 
    delivery_enabled, max_delivery_radius_km, serviceable_pincodes, delivery_notes
)
SELECT 
    s.id,
    'FIXED',
    50.00,
    1000.00,
    true,
    20.0,
    '411035,412101,411044,411045,411057,411038,411001,411004,411007,411016,411027,411033',
    'Fresh doorstep delivery within 20 km radius in insulated temperature-controlled cake boxes.'
FROM shops s
WHERE s.status = 'ACTIVE';

-- 6. Operating Hours: Open 7 days a week from 09:00 to 22:00
INSERT INTO shop_business_hours (shop_id, day_of_week, is_open, open_time, close_time)
SELECT s.id, d.day, true, '09:00:00'::time, '22:00:00'::time
FROM shops s
CROSS JOIN (
    VALUES ('MONDAY'), ('TUESDAY'), ('WEDNESDAY'), ('THURSDAY'), ('FRIDAY'), ('SATURDAY'), ('SUNDAY')
) AS d(day)
WHERE s.status = 'ACTIVE';

-- 7. High-rating customer feedback & reviews for social proof
INSERT INTO feedback (shop_id, rating, customer_display_name, comment, is_approved)
SELECT s.id, 5, 'Pooja Kulkarni', 'Ordered a birthday truffle cake. It was absolutely moist, fresh, and divine! Highly recommended.', true
FROM shops s WHERE s.status = 'ACTIVE';

INSERT INTO feedback (shop_id, rating, customer_display_name, comment, is_approved)
SELECT s.id, 5, 'Rahul Mehta', 'Flawless presentation and arrived right on time in pristine condition. Best bakes in town!', true
FROM shops s WHERE s.status = 'ACTIVE';
