-- Migration: Add KPI Items table to support multiple KPI rows per form
-- This allows managers to create one KPI form with multiple KPI items (rows)

-- Create KPI Items table
CREATE TABLE IF NOT EXISTS kpi_items (
    id SERIAL PRIMARY KEY,
    kpi_id INTEGER NOT NULL REFERENCES kpis(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    target_value VARCHAR(255),
    measure_unit VARCHAR(100),
    measure_criteria TEXT,
    item_order INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_kpi_items_kpi_id ON kpi_items(kpi_id);

-- Update existing KPIs: If a KPI has title/description, create a kpi_item for it
-- This migration handles existing data
INSERT INTO kpi_items (kpi_id, title, description, target_value, measure_unit, measure_criteria, item_order)
SELECT 
    id as kpi_id,
    title,
    description,
    target_value,
    measure_unit,
    measure_criteria,
    1 as item_order
FROM kpis
WHERE title IS NOT NULL AND title != ''
ON CONFLICT DO NOTHING;

