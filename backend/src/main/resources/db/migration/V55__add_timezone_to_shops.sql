-- V55: Add timezone configuration to shops for accurate operating hours and open now evaluation
ALTER TABLE shops ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Asia/Kolkata';

-- Create an index to support fast operating hours lookups by day and status
CREATE INDEX IF NOT EXISTS idx_shop_business_hours_day_open ON shop_business_hours(day_of_week, is_open);

