-- Seed development products for CakeStore Marketplace test bakeries
-- Robust seed products with high-definition imagery and dietary flags (Eggless, Vegan, Gluten-Free)

-- 1. Products for Akurdi Artisan Bakes (Home Bakery - Custom & Truffle Cakes)
INSERT INTO products (
    shop_id, name, description, price, original_price, image_url, availability, status, 
    is_eggless, is_vegan, is_gluten_free, allow_egg_choice, egg_preference_default, ingredients, allergens
)
VALUES
(
    (SELECT id FROM shops WHERE business_name = 'Akurdi Artisan Bakes' LIMIT 1),
    'Belgian Dark Chocolate Truffle Cake',
    'Signature moist dark chocolate sponge layered with 70% Belgian chocolate ganache.',
    650.00,
    750.00,
    'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=800&q=80',
    true,
    'ACTIVE',
    true,
    false,
    false,
    true,
    'EGGLESS',
    'Flour, Cocoa powder, Belgian dark chocolate, Butter, Milk, Sugar',
    'Dairy, Gluten'
),
(
    (SELECT id FROM shops WHERE business_name = 'Akurdi Artisan Bakes' LIMIT 1),
    'Fresh Alphonso Mango Velvet Cake',
    'Seasonal Alphonso mango puree folded into whipped mascarpone cream on delicate vanilla sponge.',
    720.00,
    800.00,
    'https://images.unsplash.com/photo-1535141192574-5d4897c13136?auto=format&fit=crop&w=800&q=80',
    true,
    'ACTIVE',
    true,
    false,
    false,
    true,
    'EGGLESS',
    'Alphonso mangoes, Mascarpone cream, Vanilla sponge, Milk, Sugar',
    'Dairy, Gluten'
),
(
    (SELECT id FROM shops WHERE business_name = 'Akurdi Artisan Bakes' LIMIT 1),
    'Nutella Hazelnut Praline Cake',
    'Rich Nutella frosting layered with slow-roasted Turkish hazelnuts and crispy wafer crumbs.',
    799.00,
    899.00,
    'https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?auto=format&fit=crop&w=800&q=80',
    true,
    'ACTIVE',
    false,
    false,
    false,
    false,
    'REGULAR',
    'Hazelnuts, Nutella, Eggs, Flour, Cocoa, Butter',
    'Eggs, Tree Nuts, Dairy, Gluten'
),
(
    (SELECT id FROM shops WHERE business_name = 'Akurdi Artisan Bakes' LIMIT 1),
    'Red Velvet Cream Cheese Jar',
    'Crumbled red velvet sponge layered with tangy Madagascar vanilla cream cheese frosting in a glass jar.',
    250.00,
    299.00,
    'https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&w=800&q=80',
    true,
    'ACTIVE',
    true,
    false,
    false,
    true,
    'EGGLESS',
    'Cream cheese, Red velvet sponge, Buttermilk, Vanilla extract',
    'Dairy, Gluten'
);

-- 2. Products for Ravet Cake Studio (Cake Studio - Artisan Pastries & Macarons)
INSERT INTO products (
    shop_id, name, description, price, original_price, image_url, availability, status, 
    is_eggless, is_vegan, is_gluten_free, allow_egg_choice, egg_preference_default, ingredients, allergens
)
VALUES
(
    (SELECT id FROM shops WHERE business_name = 'Ravet Cake Studio' LIMIT 1),
    'Rose Pistachio Tres Leches Cake',
    'Traditional soaked sponge infused with Damascus rose water and crushed Iranian green pistachios.',
    850.00,
    950.00,
    'https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?auto=format&fit=crop&w=800&q=80',
    true,
    'ACTIVE',
    true,
    false,
    false,
    true,
    'EGGLESS',
    'Milk, Condensed milk, Evaporated milk, Rose petals, Pistachios, Flour',
    'Dairy, Tree Nuts, Gluten'
),
(
    (SELECT id FROM shops WHERE business_name = 'Ravet Cake Studio' LIMIT 1),
    'Handcrafted French Macaron Box (6 Pcs)',
    'Assorted French macarons made with pure almond flour: Salted Caramel, Dark Raspberry, and Pistachio.',
    450.00,
    520.00,
    'https://images.unsplash.com/photo-1569864358642-9d1684040f43?auto=format&fit=crop&w=800&q=80',
    true,
    'ACTIVE',
    true,
    false,
    true,
    true,
    'EGGLESS',
    'Almond flour, Aquafaba, Icing sugar, Chocolate ganache, Fruit puree',
    'Tree Nuts'
),
(
    (SELECT id FROM shops WHERE business_name = 'Ravet Cake Studio' LIMIT 1),
    'Wild Blueberry Lavender Cheesecake',
    'Slow-baked New York style cheesecake crowned with wild blueberry compote and subtle culinary lavender.',
    890.00,
    999.00,
    'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=800&q=80',
    true,
    'ACTIVE',
    true,
    false,
    false,
    true,
    'EGGLESS',
    'Cream cheese, Blueberries, Lavender, Biscuit crust, Butter',
    'Dairy, Gluten'
);

-- 3. Products for Nigdi Sweet Treats (Bakery Shop - Daily Bakes & Tea Cakes)
INSERT INTO products (
    shop_id, name, description, price, original_price, image_url, availability, status, 
    is_eggless, is_vegan, is_gluten_free, allow_egg_choice, egg_preference_default, ingredients, allergens
)
VALUES
(
    (SELECT id FROM shops WHERE business_name = 'Nigdi Sweet Treats' LIMIT 1),
    'Classic Eggless Vanilla Sponge Cake',
    'Feather-light golden vanilla sponge cake topped with buttercream rosettes and candied cherries.',
    380.00,
    450.00,
    'https://images.unsplash.com/photo-1542826438-bd32f43d626f?auto=format&fit=crop&w=800&q=80',
    true,
    'ACTIVE',
    true,
    false,
    false,
    false,
    'EGGLESS',
    'Flour, Condensed milk, Butter, Vanilla, Milk',
    'Dairy, Gluten'
),
(
    (SELECT id FROM shops WHERE business_name = 'Nigdi Sweet Treats' LIMIT 1),
    'Pineapple Cream Pastry Box (4 Pcs)',
    'Layered vanilla pastry with real diced pineapple chunks, fruit glaze, and fluffy non-dairy whipped cream.',
    320.00,
    380.00,
    'https://images.unsplash.com/photo-1506459225024-1428097a7e18?auto=format&fit=crop&w=800&q=80',
    true,
    'ACTIVE',
    true,
    false,
    false,
    false,
    'EGGLESS',
    'Pineapple, Whipped cream, Flour, Sugar, Glaze',
    'Gluten'
),
(
    (SELECT id FROM shops WHERE business_name = 'Nigdi Sweet Treats' LIMIT 1),
    'Cardamom Mawa Tea Cake Loaf',
    'Rich traditional mawa cake scented with green cardamom pods and crunchy slivered almonds.',
    420.00,
    480.00,
    'https://images.unsplash.com/photo-1607958996333-41aef7caefaa?auto=format&fit=crop&w=800&q=80',
    true,
    'ACTIVE',
    false,
    false,
    false,
    false,
    'REGULAR',
    'Mawa (khoya), Whole eggs, Butter, Cardamom, Flour, Almonds',
    'Dairy, Eggs, Tree Nuts, Gluten'
);

-- 4. Products for Baner Dessert Boutique (Dessert Studio - European Fine Pastries)
INSERT INTO products (
    shop_id, name, description, price, original_price, image_url, availability, status, 
    is_eggless, is_vegan, is_gluten_free, allow_egg_choice, egg_preference_default, ingredients, allergens
)
VALUES
(
    (SELECT id FROM shops WHERE business_name = 'Baner Dessert Boutique' LIMIT 1),
    'Opera Gateau Parisienne',
    'Almond joconde sponge soaked in espresso syrup, layered with French dark ganache and coffee buttercream.',
    950.00,
    1100.00,
    'https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?auto=format&fit=crop&w=800&q=80',
    true,
    'ACTIVE',
    false,
    false,
    false,
    false,
    'REGULAR',
    'Almond meal, Espresso, Cocoa, Butter, Whole eggs, Sugar',
    'Dairy, Eggs, Tree Nuts, Gluten'
),
(
    (SELECT id FROM shops WHERE business_name = 'Baner Dessert Boutique' LIMIT 1),
    'Classic Tiramisu Mascarpone Bowl',
    'Savoiardi ladyfingers steeped in Italian espresso, layered with delicate mascarpone sabayon and cocoa dusting.',
    550.00,
    620.00,
    'https://images.unsplash.com/photo-1571115177098-24ec42ed204d?auto=format&fit=crop&w=800&q=80',
    true,
    'ACTIVE',
    true,
    false,
    false,
    true,
    'EGGLESS',
    'Mascarpone cheese, Espresso, Savoiardi biscuits, Cocoa powder',
    'Dairy, Gluten'
),
(
    (SELECT id FROM shops WHERE business_name = 'Baner Dessert Boutique' LIMIT 1),
    'Vegan Dark Chocolate Raspberry Mousse Tart',
    '100% plant-based almond-date crust filled with silky avocado cacao mousse and organic raspberry coulis.',
    480.00,
    550.00,
    'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=800&q=80',
    true,
    'ACTIVE',
    true,
    true,
    true,
    false,
    'EGGLESS',
    'Organic cacao, Medjool dates, Almonds, Raspberries, Coconut cream, Agave',
    'Tree Nuts'
);

-- 5. Products for Wakad Cloud Cakes (Online Bakery - Midnight Birthdays & Express)
INSERT INTO products (
    shop_id, name, description, price, original_price, image_url, availability, status, 
    is_eggless, is_vegan, is_gluten_free, allow_egg_choice, egg_preference_default, ingredients, allergens
)
VALUES
(
    (SELECT id FROM shops WHERE business_name = 'Wakad Cloud Cakes' LIMIT 1),
    'Midnight Express Black Forest Cake',
    'Classic German chocolate sponge soaked in cherry syrup with sweet black cherries and vanilla cream.',
    599.00,
    699.00,
    'https://images.unsplash.com/photo-1557925923-cd4648e211a0?auto=format&fit=crop&w=800&q=80',
    true,
    'ACTIVE',
    true,
    false,
    false,
    true,
    'EGGLESS',
    'Chocolate sponge, Dark sweet cherries, Whipped cream, Chocolate shavings',
    'Dairy, Gluten'
),
(
    (SELECT id FROM shops WHERE business_name = 'Wakad Cloud Cakes' LIMIT 1),
    'Vegan Strawberry Silk Celebration Cake',
    'Plant-based strawberry sponge frosted with organic coconut cream and crowned with fresh Mahabaleshwar strawberries.',
    750.00,
    850.00,
    'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?auto=format&fit=crop&w=800&q=80',
    true,
    'ACTIVE',
    true,
    true,
    false,
    false,
    'EGGLESS',
    'Fresh strawberries, Coconut milk cream, Oat milk, Organic cane sugar, Flour',
    'Gluten'
),
(
    (SELECT id FROM shops WHERE business_name = 'Wakad Cloud Cakes' LIMIT 1),
    'Caramel Butterscotch Bento Cake (250g)',
    'Cute Korean-style bento box cake with crunchy butterscotch bits and salted caramel drip.',
    350.00,
    399.00,
    'https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?auto=format&fit=crop&w=800&q=80',
    true,
    'ACTIVE',
    true,
    false,
    false,
    true,
    'EGGLESS',
    'Butterscotch praline, Vanilla sponge, Caramel cream',
    'Dairy, Gluten'
);

-- 6. Products for Kothrud Heritage Bakes (Bakery Shop - Authentic Oven-Fresh Bakes)
INSERT INTO products (
    shop_id, name, description, price, original_price, image_url, availability, status, 
    is_eggless, is_vegan, is_gluten_free, allow_egg_choice, egg_preference_default, ingredients, allergens
)
VALUES
(
    (SELECT id FROM shops WHERE business_name = 'Kothrud Heritage Bakes' LIMIT 1),
    'Royal Shahi Mawa Cake',
    'Authentic bakery-style dense mawa cake baked to golden perfection using slow-simmered khoya and saffron.',
    499.00,
    550.00,
    'https://images.unsplash.com/photo-1519869325930-281384150729?auto=format&fit=crop&w=800&q=80',
    true,
    'ACTIVE',
    false,
    false,
    false,
    false,
    'REGULAR',
    'Fresh mawa, Eggs, Pure ghee, Saffron, Cardamom, Flour',
    'Dairy, Eggs, Gluten'
),
(
    (SELECT id FROM shops WHERE business_name = 'Kothrud Heritage Bakes' LIMIT 1),
    'Pure Ghee Walnut Plum Cake',
    'Festive spiced dark cake loaded with rum-free black raisins, orange peel, and Californian walnuts.',
    650.00,
    720.00,
    'https://images.unsplash.com/photo-1576618148400-f54bed99fcfd?auto=format&fit=crop&w=800&q=80',
    true,
    'ACTIVE',
    false,
    false,
    false,
    false,
    'REGULAR',
    'Walnuts, Black raisins, Candied ginger, Spices, Ghee, Eggs',
    'Dairy, Eggs, Tree Nuts, Gluten'
),
(
    (SELECT id FROM shops WHERE business_name = 'Kothrud Heritage Bakes' LIMIT 1),
    'Roasted Almond Honey Tea Loaf',
    'Eggless afternoon tea loaf infused with wild forest honey and coated with toasted almond flakes.',
    420.00,
    480.00,
    'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80',
    true,
    'ACTIVE',
    true,
    false,
    false,
    false,
    'EGGLESS',
    'Forest honey, Toasted almonds, Whole wheat flour, Butter, Cinnamon',
    'Dairy, Tree Nuts, Gluten'
);
