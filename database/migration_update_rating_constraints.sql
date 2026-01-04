-- Migration: Update rating constraints to support new rating scale (1.00, 1.25, 1.50)
-- Remove old CHECK constraints and add new ones
-- Also updates column types and handles existing data

-- Step 1: Drop old CHECK constraints
ALTER TABLE kpi_reviews 
  DROP CONSTRAINT IF EXISTS kpi_reviews_employee_rating_check;

ALTER TABLE kpi_reviews 
  DROP CONSTRAINT IF EXISTS kpi_reviews_manager_rating_check;

-- Step 2: Set existing invalid ratings to NULL (ratings not in new scale)
-- This handles existing data that uses the old 1-5 scale
UPDATE kpi_reviews 
SET employee_rating = NULL 
WHERE employee_rating IS NOT NULL 
  AND employee_rating NOT IN (1.00, 1.25, 1.50);

UPDATE kpi_reviews 
SET manager_rating = NULL 
WHERE manager_rating IS NOT NULL 
  AND manager_rating NOT IN (1.00, 1.25, 1.50);

-- Step 3: Change column types from DECIMAL(3,1) to DECIMAL(3,2) to support new scale
ALTER TABLE kpi_reviews 
  ALTER COLUMN employee_rating TYPE DECIMAL(3,2);

ALTER TABLE kpi_reviews 
  ALTER COLUMN manager_rating TYPE DECIMAL(3,2);

-- Step 4: Add new signature columns for separate self-rating and manager review signatures
ALTER TABLE kpi_reviews 
  ADD COLUMN IF NOT EXISTS employee_self_rating_signature TEXT;

ALTER TABLE kpi_reviews 
  ADD COLUMN IF NOT EXISTS manager_review_signature TEXT;

ALTER TABLE kpi_reviews 
  ADD COLUMN IF NOT EXISTS employee_self_rating_signed_at TIMESTAMP;

ALTER TABLE kpi_reviews 
  ADD COLUMN IF NOT EXISTS manager_review_signed_at TIMESTAMP;

-- Step 5: Add new CHECK constraints for new rating scale (only allows 1.00, 1.25, 1.50)
ALTER TABLE kpi_reviews 
  ADD CONSTRAINT kpi_reviews_employee_rating_check 
  CHECK (employee_rating IS NULL OR employee_rating IN (1.00, 1.25, 1.50));

ALTER TABLE kpi_reviews 
  ADD CONSTRAINT kpi_reviews_manager_rating_check 
  CHECK (manager_rating IS NULL OR manager_rating IN (1.00, 1.25, 1.50));

