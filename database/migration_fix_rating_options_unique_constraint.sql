-- Migration: Fix rating_options unique constraint to include rating_type
-- Description: Allows same rating_value for different rating types (yearly, quarterly, qualitative)

-- Drop the old unique constraint
ALTER TABLE rating_options 
DROP CONSTRAINT IF EXISTS rating_options_company_id_rating_value_key;

-- Add new unique constraint that includes rating_type
-- This allows the same rating_value for different types (e.g., 1.00 for both yearly and quarterly)
ALTER TABLE rating_options 
ADD CONSTRAINT rating_options_company_id_rating_value_rating_type_key 
UNIQUE (company_id, rating_value, rating_type);

-- Verification query
SELECT 
    id,
    company_id,
    rating_value,
    label,
    rating_type,
    is_active,
    display_order
FROM rating_options 
ORDER BY company_id, rating_type, display_order;

COMMENT ON CONSTRAINT rating_options_company_id_rating_value_rating_type_key ON rating_options 
IS 'Ensures unique rating values per company and rating type';
