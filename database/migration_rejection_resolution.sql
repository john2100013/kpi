-- Migration: Add rejection resolution tracking to kpi_reviews table
-- Date: 2026-01-08
-- Description: Adds columns to track when HR resolves rejection issues

-- Add rejection resolution columns
ALTER TABLE kpi_reviews 
ADD COLUMN IF NOT EXISTS rejection_resolved_status VARCHAR(20),
ADD COLUMN IF NOT EXISTS rejection_resolved_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS rejection_resolved_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS rejection_resolved_note TEXT;

-- Create index for resolved status
CREATE INDEX IF NOT EXISTS idx_kpi_reviews_rejection_resolved 
ON kpi_reviews(rejection_resolved_status);

-- Add comment to explain the column
COMMENT ON COLUMN kpi_reviews.rejection_resolved_status IS 'Status of rejection resolution: resolved, or NULL if not resolved';
COMMENT ON COLUMN kpi_reviews.rejection_resolved_at IS 'Timestamp when the rejection was marked as resolved';
COMMENT ON COLUMN kpi_reviews.rejection_resolved_by IS 'User ID of HR person who resolved the issue';
COMMENT ON COLUMN kpi_reviews.rejection_resolved_note IS 'HR note explaining resolution action';
