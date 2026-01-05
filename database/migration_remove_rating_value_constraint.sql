-- Migration: Remove constraint on rating_value to allow any numeric value
-- This allows flexibility in rating scales per company

-- Drop the existing CHECK constraint on rating_value
ALTER TABLE rating_options 
  DROP CONSTRAINT IF EXISTS rating_options_rating_value_check;

-- The rating_value column will now accept any DECIMAL(3,2) value without restriction

