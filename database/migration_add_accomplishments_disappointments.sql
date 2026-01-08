-- Migration: Add major accomplishments and disappointments fields to kpi_reviews table
-- This allows employees to document their accomplishments and disappointments
-- and managers to provide comments on both

-- Add major accomplishments field (employee enters)
ALTER TABLE kpi_reviews 
ADD COLUMN IF NOT EXISTS major_accomplishments TEXT;

-- Add manager comment on major accomplishments
ALTER TABLE kpi_reviews 
ADD COLUMN IF NOT EXISTS major_accomplishments_manager_comment TEXT;

-- Add disappointments field (employee enters)
ALTER TABLE kpi_reviews 
ADD COLUMN IF NOT EXISTS disappointments TEXT;

-- Add manager comment on disappointments
ALTER TABLE kpi_reviews 
ADD COLUMN IF NOT EXISTS disappointments_manager_comment TEXT;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_kpi_reviews_accomplishments 
ON kpi_reviews(id) 
WHERE major_accomplishments IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kpi_reviews_disappointments 
ON kpi_reviews(id) 
WHERE disappointments IS NOT NULL;

-- Verify the changes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'kpi_reviews'
AND column_name IN (
  'major_accomplishments',
  'major_accomplishments_manager_comment',
  'disappointments',
  'disappointments_manager_comment'
)
ORDER BY column_name;
