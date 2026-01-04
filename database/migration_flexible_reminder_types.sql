-- Migration: Make reminder_type more flexible in kpi_setting_reminders
-- This allows any reminder days_before value from reminder_settings to be tracked

-- Drop the existing CHECK constraint
ALTER TABLE kpi_setting_reminders 
DROP CONSTRAINT IF EXISTS kpi_setting_reminders_reminder_type_check;

-- Add a more flexible constraint that allows custom reminder types
-- This allows values like '2_weeks', '1_week', '3_days', '2_days', '1_day', 'meeting_day', 
-- and also 'custom_X_days' format for any other days_before values
ALTER TABLE kpi_setting_reminders 
ADD CONSTRAINT kpi_setting_reminders_reminder_type_check 
CHECK (
  reminder_type IN ('2_weeks', '1_week', '3_days', '2_days', '1_day', 'meeting_day', 'daily_overdue') 
  OR reminder_type LIKE 'custom_%_days'
);

