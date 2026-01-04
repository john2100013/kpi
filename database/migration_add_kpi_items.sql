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
    goal_weight TEXT,  -- Using goal_weight instead of measure_criteria
    item_order INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_kpi_items_kpi_id ON kpi_items(kpi_id);

-- Update existing KPIs: If a KPI has title/description, create a kpi_item for it
-- This migration handles existing data
-- Note: Handles both measure_criteria (old) and goal_weight (new) column names from kpis table
DO $$
BEGIN
    -- Check if kpis table has goal_weight column, otherwise use measure_criteria
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'kpis' AND column_name = 'goal_weight'
    ) THEN
        -- kpis table has goal_weight column
        INSERT INTO kpi_items (kpi_id, title, description, target_value, measure_unit, goal_weight, item_order)
        SELECT 
            id as kpi_id,
            title,
            description,
            target_value,
            measure_unit,
            goal_weight,
            1 as item_order
        FROM kpis
        WHERE title IS NOT NULL AND title != ''
          AND NOT EXISTS (
            SELECT 1 FROM kpi_items WHERE kpi_id = kpis.id
          );
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'kpis' AND column_name = 'measure_criteria'
    ) THEN
        -- kpis table has measure_criteria column (old name)
        INSERT INTO kpi_items (kpi_id, title, description, target_value, measure_unit, goal_weight, item_order)
        SELECT 
            id as kpi_id,
            title,
            description,
            target_value,
            measure_unit,
            measure_criteria as goal_weight,
            1 as item_order
        FROM kpis
        WHERE title IS NOT NULL AND title != ''
          AND NOT EXISTS (
            SELECT 1 FROM kpi_items WHERE kpi_id = kpis.id
          );
    ELSE
        -- Neither column exists, insert without goal_weight
        INSERT INTO kpi_items (kpi_id, title, description, target_value, measure_unit, goal_weight, item_order)
        SELECT 
            id as kpi_id,
            title,
            description,
            target_value,
            measure_unit,
            NULL as goal_weight,
            1 as item_order
        FROM kpis
        WHERE title IS NOT NULL AND title != ''
          AND NOT EXISTS (
            SELECT 1 FROM kpi_items WHERE kpi_id = kpis.id
          );
    END IF;
END $$;

