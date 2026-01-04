-- Migration: Add CC Email Support to Daily Reminder Settings
-- This migration adds CC email field for HR assistants

-- Add CC emails column to daily reminder settings
ALTER TABLE kpi_setting_daily_reminder_settings 
ADD COLUMN IF NOT EXISTS cc_emails TEXT; -- Comma-separated list of email addresses for CC

-- Update comment
COMMENT ON COLUMN kpi_setting_daily_reminder_settings.cc_emails IS 'Comma-separated list of email addresses to CC on daily reminder emails (e.g., hr.assistant@company.com, admin@company.com)';

