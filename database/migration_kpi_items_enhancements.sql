-- Migration: Enhance KPI Items table with new columns
-- Adds: current_performance_status, expected_completion_date
-- Renames: measure_criteria to goal_weight

-- Add new columns to kpi_items
ALTER TABLE kpi_items 
  ADD COLUMN IF NOT EXISTS current_performance_status VARCHAR(255),
  ADD COLUMN IF NOT EXISTS expected_completion_date DATE;

-- Rename measure_criteria to goal_weight
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'kpi_items' AND column_name = 'measure_criteria'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'kpi_items' AND column_name = 'goal_weight'
  ) THEN
    ALTER TABLE kpi_items RENAME COLUMN measure_criteria TO goal_weight;
  END IF;
END $$;

-- Create rating_options table for storing rating scale options
CREATE TABLE IF NOT EXISTS rating_options (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    rating_value DECIMAL(3,2) NOT NULL CHECK (rating_value IN (1.00, 1.25, 1.50)),
    label VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, rating_value)
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_rating_options_company ON rating_options(company_id);

