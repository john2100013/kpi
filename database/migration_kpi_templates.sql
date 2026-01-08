-- Migration: Add KPI Templates Support
-- This migration adds the ability for managers to create reusable KPI templates

-- Create KPI Templates table
CREATE TABLE IF NOT EXISTS kpi_templates (
    id SERIAL PRIMARY KEY,
    manager_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    template_name VARCHAR(255) NOT NULL,
    description TEXT,
    period VARCHAR(50) NOT NULL CHECK (period IN ('quarterly', 'annual')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create KPI Template Items table (stores the actual KPI items for each template)
CREATE TABLE IF NOT EXISTS kpi_template_items (
    id SERIAL PRIMARY KEY,
    template_id INTEGER NOT NULL REFERENCES kpi_templates(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    current_performance_status VARCHAR(255),
    target_value VARCHAR(255),
    expected_completion_date VARCHAR(100), -- Stored as text like "End of Q1" since it's a template
    measure_unit VARCHAR(100),
    goal_weight TEXT,
    item_order INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_kpi_templates_manager_company ON kpi_templates(manager_id, company_id);
CREATE INDEX IF NOT EXISTS idx_kpi_template_items_template_id ON kpi_template_items(template_id);

-- Add helpful comment
COMMENT ON TABLE kpi_templates IS 'Stores reusable KPI templates that managers can use to quickly assign KPIs to multiple employees';
COMMENT ON TABLE kpi_template_items IS 'Stores the individual KPI items for each template';
