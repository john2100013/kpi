-- Migration: Add Multi-Tenancy Support and HR Settings
-- This migration adds company support and HR configuration settings

-- Create Companies table
CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add company_id to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE;

-- Add company_id to kpis table
ALTER TABLE kpis ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE;

-- Add company_id to kpi_reviews table
ALTER TABLE kpi_reviews ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE;

-- Add company_id to notifications table
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE;

-- Add company_id to kpi_setting_reminders table
ALTER TABLE kpi_setting_reminders ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE;

-- Add company_id to kpi_review_reminders table
ALTER TABLE kpi_review_reminders ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE;

-- Create KPI Period Settings table (for HR configuration)
CREATE TABLE IF NOT EXISTS kpi_period_settings (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    period_type VARCHAR(50) NOT NULL CHECK (period_type IN ('quarterly', 'yearly')),
    quarter VARCHAR(20), -- Only for quarterly (Q1, Q2, Q3, Q4)
    year INTEGER NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, period_type, quarter, year)
);

-- Create Reminder Settings table (for HR configuration)
CREATE TABLE IF NOT EXISTS reminder_settings (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    reminder_type VARCHAR(100) NOT NULL CHECK (reminder_type IN ('kpi_setting', 'kpi_review')),
    period_type VARCHAR(50) CHECK (period_type IN ('quarterly', 'yearly')),
    reminder_number INTEGER NOT NULL, -- 1st, 2nd, 3rd, etc.
    reminder_days_before INTEGER NOT NULL, -- Days before event (e.g., 14 for 2 weeks)
    reminder_label VARCHAR(255), -- Human-readable label (e.g., "2 weeks", "1 week")
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, reminder_type, period_type, reminder_number)
);

-- Create Setting: KPI Setting Meeting Daily Reminder
CREATE TABLE IF NOT EXISTS kpi_setting_daily_reminder_settings (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
    send_daily_reminders BOOLEAN DEFAULT false, -- Whether to send daily reminders when meeting is due
    days_before_meeting INTEGER DEFAULT 3, -- Start sending daily reminders X days before meeting
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_kpis_company ON kpis(company_id);
CREATE INDEX IF NOT EXISTS idx_kpi_reviews_company ON kpi_reviews(company_id);
CREATE INDEX IF NOT EXISTS idx_notifications_company ON notifications(company_id);
CREATE INDEX IF NOT EXISTS idx_kpi_setting_reminders_company ON kpi_setting_reminders(company_id);
CREATE INDEX IF NOT EXISTS idx_kpi_review_reminders_company ON kpi_review_reminders(company_id);
CREATE INDEX IF NOT EXISTS idx_kpi_period_settings_company ON kpi_period_settings(company_id);
CREATE INDEX IF NOT EXISTS idx_reminder_settings_company ON reminder_settings(company_id);

-- For existing data: Create a default company and assign all existing records to it
-- Note: This assumes existing data should all belong to one company
DO $$
DECLARE
    default_company_id INTEGER;
BEGIN
    -- Create default company
    INSERT INTO companies (name, domain) 
    VALUES ('Default Company', NULL)
    ON CONFLICT DO NOTHING
    RETURNING id INTO default_company_id;
    
    -- If company already exists, get its ID
    IF default_company_id IS NULL THEN
        SELECT id INTO default_company_id FROM companies WHERE name = 'Default Company' LIMIT 1;
    END IF;
    
    -- Update existing users
    UPDATE users SET company_id = default_company_id WHERE company_id IS NULL;
    
    -- Update existing kpis
    UPDATE kpis k SET company_id = (
        SELECT company_id FROM users WHERE id = k.employee_id LIMIT 1
    ) WHERE company_id IS NULL;
    
    -- Update existing kpi_reviews
    UPDATE kpi_reviews kr SET company_id = (
        SELECT company_id FROM users WHERE id = kr.employee_id LIMIT 1
    ) WHERE company_id IS NULL;
    
    -- Update existing notifications
    UPDATE notifications n SET company_id = (
        SELECT company_id FROM users WHERE id = n.recipient_id LIMIT 1
    ) WHERE company_id IS NULL;
    
    -- Update existing kpi_setting_reminders
    UPDATE kpi_setting_reminders ksr SET company_id = (
        SELECT company_id FROM users WHERE id = ksr.employee_id LIMIT 1
    ) WHERE company_id IS NULL;
    
    -- Update existing kpi_review_reminders
    UPDATE kpi_review_reminders krr SET company_id = (
        SELECT company_id FROM users WHERE id = krr.employee_id LIMIT 1
    ) WHERE company_id IS NULL;
END $$;

