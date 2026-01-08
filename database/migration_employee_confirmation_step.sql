-- Migration: Add employee confirmation step to KPI review flow
-- Description: Adds new review statuses for employee to confirm/reject manager rating
-- Date: 2026-01-07

-- Add new statuses to review_status check constraint
ALTER TABLE kpi_reviews DROP CONSTRAINT IF EXISTS kpi_reviews_review_status_check;

ALTER TABLE kpi_reviews ADD CONSTRAINT kpi_reviews_review_status_check 
CHECK (review_status IN (
    'pending', 
    'employee_submitted', 
    'awaiting_employee_confirmation',
    'completed',
    'rejected'
));

-- Add fields for employee confirmation/rejection
ALTER TABLE kpi_reviews 
ADD COLUMN IF NOT EXISTS employee_confirmation_status VARCHAR(20),
ADD COLUMN IF NOT EXISTS employee_rejection_note TEXT,
ADD COLUMN IF NOT EXISTS employee_confirmation_signature TEXT,
ADD COLUMN IF NOT EXISTS employee_confirmation_signed_at TIMESTAMP;

-- Add index for faster queries on new status
CREATE INDEX IF NOT EXISTS idx_kpi_reviews_status ON kpi_reviews(review_status);

-- Update existing 'manager_submitted' reviews to 'awaiting_employee_confirmation' 
-- (optional - only if you want to migrate existing data)
-- UPDATE kpi_reviews SET review_status = 'awaiting_employee_confirmation' WHERE review_status = 'manager_submitted';

COMMENT ON COLUMN kpi_reviews.employee_confirmation_status IS 'Employee confirmation: approved or rejected';
COMMENT ON COLUMN kpi_reviews.employee_rejection_note IS 'Note provided by employee if they reject manager rating';
COMMENT ON COLUMN kpi_reviews.employee_confirmation_signature IS 'Employee signature when confirming manager rating';
COMMENT ON COLUMN kpi_reviews.employee_confirmation_signed_at IS 'Timestamp when employee confirmed/rejected';
