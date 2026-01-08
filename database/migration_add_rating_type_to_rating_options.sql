-- Migration: Add rating_type to rating_options
-- Description: Allows different rating scales for yearly, quarterly, and qualitative KPIs

-- First, add the column without constraint
ALTER TABLE rating_options 
ADD COLUMN IF NOT EXISTS rating_type VARCHAR(20) DEFAULT 'quarterly';

-- Update existing records to be quarterly (default for backward compatibility)
UPDATE rating_options 
SET rating_type = 'quarterly' 
WHERE rating_type IS NULL;

-- Now add the constraint
ALTER TABLE rating_options 
ADD CONSTRAINT rating_options_rating_type_check 
CHECK (rating_type IN ('yearly', 'quarterly', 'qualitative'));

-- Add index for rating_type
CREATE INDEX IF NOT EXISTS idx_rating_options_type ON rating_options(rating_type, is_active);

-- Add comment
COMMENT ON COLUMN rating_options.rating_type IS 'Type of rating: yearly, quarterly, or qualitative';

-- Verification query
SELECT 
    id,
    rating_value,
    label,
    rating_type,
    is_active,
    display_order
FROM rating_options 
ORDER BY rating_type, display_order;
