-- Migration: Add Support for Template-Specific Power Automate Webhook URLs
-- This allows different webhook URLs for different email template types

-- First, ensure power_automate_config table exists (create if it doesn't)
CREATE TABLE IF NOT EXISTS power_automate_config (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL DEFAULT 1,
    webhook_url TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Option 1: Modify existing power_automate_config table to support template types
-- First, drop the UNIQUE constraint on company_id if it exists
ALTER TABLE power_automate_config DROP CONSTRAINT IF EXISTS power_automate_config_company_id_key;

-- Add template_type column (nullable for backward compatibility)
ALTER TABLE power_automate_config ADD COLUMN IF NOT EXISTS template_type VARCHAR(100);

-- Add CHECK constraint for valid template types
ALTER TABLE power_automate_config DROP CONSTRAINT IF EXISTS power_automate_config_template_type_check;
ALTER TABLE power_automate_config ADD CONSTRAINT power_automate_config_template_type_check 
  CHECK (template_type IS NULL OR template_type IN (
    'kpi_assigned',
    'kpi_acknowledged',
    'self_rating_submitted',
    'review_completed',
    'kpi_setting_reminder',
    'kpi_review_reminder',
    'overdue_kpi_reminder',
    'meeting_scheduled'
  ));

-- Create unique constraint on company_id + template_type
ALTER TABLE power_automate_config DROP CONSTRAINT IF EXISTS power_automate_config_company_template_unique;
ALTER TABLE power_automate_config ADD CONSTRAINT power_automate_config_company_template_unique 
  UNIQUE(company_id, template_type);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_power_automate_config_template ON power_automate_config(template_type);

-- Update existing records to have NULL template_type (for backward compatibility)
-- This allows the system to fall back to a default URL if template-specific URL doesn't exist
UPDATE power_automate_config SET template_type = NULL WHERE template_type IS NULL;

