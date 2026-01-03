-- Migration: Add Power Automate Integration and Email Templates
-- This migration adds email templates and Power Automate webhook URLs

-- Create Email Templates table (for HR to manage email templates)
CREATE TABLE IF NOT EXISTS email_templates (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    template_type VARCHAR(100) NOT NULL CHECK (template_type IN (
        'kpi_setting_reminder',
        'kpi_review_reminder',
        'kpi_assigned',
        'kpi_acknowledged',
        'self_rating_submitted',
        'review_completed'
    )),
    subject VARCHAR(500) NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, template_type)
);

-- Create Meeting Schedules table (for managers to schedule meetings)
CREATE TABLE IF NOT EXISTS meeting_schedules (
    id SERIAL PRIMARY KEY,
    kpi_id INTEGER REFERENCES kpis(id) ON DELETE CASCADE,
    review_id INTEGER REFERENCES kpi_reviews(id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    manager_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    meeting_type VARCHAR(50) NOT NULL CHECK (meeting_type IN ('kpi_setting', 'kpi_review')),
    scheduled_date DATE NOT NULL,
    scheduled_time TIME,
    location VARCHAR(255),
    notes TEXT,
    status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Power Automate Configuration table
CREATE TABLE IF NOT EXISTS power_automate_config (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
    webhook_url TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create HR Email Notification Settings table
CREATE TABLE IF NOT EXISTS hr_email_notification_settings (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
    receive_email_notifications BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_email_templates_company ON email_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_type ON email_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_meeting_schedules_kpi ON meeting_schedules(kpi_id);
CREATE INDEX IF NOT EXISTS idx_meeting_schedules_review ON meeting_schedules(review_id);
CREATE INDEX IF NOT EXISTS idx_meeting_schedules_company ON meeting_schedules(company_id);
CREATE INDEX IF NOT EXISTS idx_meeting_schedules_date ON meeting_schedules(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_power_automate_config_company ON power_automate_config(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_email_notification_settings_company ON hr_email_notification_settings(company_id);

