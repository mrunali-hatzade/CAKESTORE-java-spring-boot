-- Phase 2.3: Enhance customer_addresses table with structured address fields
ALTER TABLE customer_addresses
ADD COLUMN IF NOT EXISTS address_line_1 VARCHAR(255),
ADD COLUMN IF NOT EXISTS address_line_2 VARCHAR(255),
ADD COLUMN IF NOT EXISTS landmark VARCHAR(255),
ADD COLUMN IF NOT EXISTS city VARCHAR(100),
ADD COLUMN IF NOT EXISTS state VARCHAR(100),
ADD COLUMN IF NOT EXISTS pincode VARCHAR(10),
ADD COLUMN IF NOT EXISTS address_type VARCHAR(20) DEFAULT 'HOME',
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Populate address_line_1 from existing delivery_address where missing
UPDATE customer_addresses
SET address_line_1 = delivery_address
WHERE address_line_1 IS NULL AND delivery_address IS NOT NULL;

-- Populate address_type from label where available
UPDATE customer_addresses
SET address_type = CASE 
    WHEN UPPER(label) LIKE '%WORK%' OR UPPER(label) LIKE '%OFFICE%' THEN 'WORK'
    WHEN UPPER(label) LIKE '%OTHER%' THEN 'OTHER'
    ELSE 'HOME'
END
WHERE address_type IS NULL;

-- Composite index for fast customer address lookups and default address identification
CREATE INDEX IF NOT EXISTS idx_customer_addresses_user_default 
ON customer_addresses(user_id, is_default);

