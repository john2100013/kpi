-- Migration: Add qualitative KPI items support
-- Description: Allows managers to mark KPI items as qualitative (no employee self-rating)
-- Qualitative items use categorical ratings: exceeds, meets, needs_improvement

-- Add is_qualitative flag to kpi_items
ALTER TABLE kpi_items 
ADD COLUMN IF NOT EXISTS is_qualitative BOOLEAN DEFAULT false;

-- Add qualitative_rating to kpi_items for manager's qualitative assessment
ALTER TABLE kpi_items 
ADD COLUMN IF NOT EXISTS qualitative_rating VARCHAR(50) CHECK (qualitative_rating IN ('exceeds', 'meets', 'needs_improvement'));

-- Add qualitative_comment for manager's qualitative feedback
ALTER TABLE kpi_items 
ADD COLUMN IF NOT EXISTS qualitative_comment TEXT;

-- Add index for qualitative items
CREATE INDEX IF NOT EXISTS idx_kpi_items_qualitative ON kpi_items(is_qualitative);

-- Add same fields to kpi_template_items for template support
ALTER TABLE kpi_template_items 
ADD COLUMN IF NOT EXISTS is_qualitative BOOLEAN DEFAULT false;

COMMENT ON COLUMN kpi_items.is_qualitative IS 'If true, this item is qualitative and only requires manager rating (no employee self-rating)';
COMMENT ON COLUMN kpi_items.qualitative_rating IS 'Manager rating for qualitative items: exceeds, meets, or needs_improvement';
COMMENT ON COLUMN kpi_items.qualitative_comment IS 'Optional manager comment for qualitative assessment';

-- Verification query
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'kpi_items' 
    AND column_name IN ('is_qualitative', 'qualitative_rating', 'qualitative_comment')
ORDER BY column_name;
