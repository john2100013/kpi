-- Setup Power Automate Configuration Table
-- Run this script to create the power_automate_config table if it doesn't exist

-- Create Power Automate Configuration table
-- Note: If you're using multi-tenancy, this references companies table
-- If not using multi-tenancy, you can use company_id = 1 for single company setup

-- Option 1: If you have companies table (multi-tenancy)
CREATE TABLE IF NOT EXISTS power_automate_config (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL UNIQUE,
    webhook_url TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Option 2: If you DON'T have companies table (single company)
-- Uncomment and use this instead:
/*
CREATE TABLE IF NOT EXISTS power_automate_config (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL DEFAULT 1,
    webhook_url TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id)
);
*/

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_power_automate_config_company ON power_automate_config(company_id);

-- Example: Insert or update webhook URL
-- Replace 'YOUR_WEBHOOK_URL_HERE' with your actual Power Automate webhook URL
-- Replace 1 with your actual company_id (or use 1 for single company)
/*
INSERT INTO power_automate_config (company_id, webhook_url, is_active)
VALUES (1, 'YOUR_WEBHOOK_URL_HERE', true)
ON CONFLICT (company_id) 
DO UPDATE SET 
    webhook_url = EXCLUDED.webhook_url, 
    is_active = true,
    updated_at = CURRENT_TIMESTAMP;
*/

