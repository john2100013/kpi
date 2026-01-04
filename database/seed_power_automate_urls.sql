-- Seed Power Automate Webhook URLs for Different Email Template Types
-- Replace company_id = 1 with your actual company_id if different

-- First, ensure the power_automate_config table exists and has the template_type column
-- Run migration_power_automate_template_urls.sql first if needed

-- Insert or update webhook URLs for each template type
-- Company ID: 1 (change if you have a different company_id)

-- 1. KPI Assigned Email
INSERT INTO power_automate_config (company_id, template_type, webhook_url, is_active)
VALUES (
  1,
  'kpi_assigned',
  'https://defaultea69055931dd42289ce7ad509c2ee2.9d.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/efedc8235af04338946ab8abb3c5de98/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=mh5iFtRNzQvZJ-2LM7BZT5GDnnP6yxb0rrcxGFRQxvY',
  true
)
ON CONFLICT (company_id, template_type) 
DO UPDATE SET 
  webhook_url = EXCLUDED.webhook_url,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- 2. KPI Acknowledged Email
INSERT INTO power_automate_config (company_id, template_type, webhook_url, is_active)
VALUES (
  1,
  'kpi_acknowledged',
  'https://defaultea69055931dd42289ce7ad509c2ee2.9d.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/fba1f57639494e2aa361b72183adbe22/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=A2pJXmQcpnQhdrrQ3k1gzCRUHR3gqjUs6BMff0IYtdo',
  true
)
ON CONFLICT (company_id, template_type) 
DO UPDATE SET 
  webhook_url = EXCLUDED.webhook_url,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- 3. Self-Rating Submitted Email
INSERT INTO power_automate_config (company_id, template_type, webhook_url, is_active)
VALUES (
  1,
  'self_rating_submitted',
  'https://defaultea69055931dd42289ce7ad509c2ee2.9d.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/5a9bd0a02222408692f8f77cd44d46ca/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=G9tdWlEiBu-K6SAon6adGsRVlUeINAo2wyI8MOvfuC8',
  true
)
ON CONFLICT (company_id, template_type) 
DO UPDATE SET 
  webhook_url = EXCLUDED.webhook_url,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- 4. Review Completed Email
INSERT INTO power_automate_config (company_id, template_type, webhook_url, is_active)
VALUES (
  1,
  'review_completed',
  'https://defaultea69055931dd42289ce7ad509c2ee2.9d.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/dc93d72c5f464c84938d8545d2585186/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=Vq4D8w882yY4IxcfSn2B5GNmMn4GNwayH8e--o72Zek',
  true
)
ON CONFLICT (company_id, template_type) 
DO UPDATE SET 
  webhook_url = EXCLUDED.webhook_url,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- 5. KPI Setting Reminder
INSERT INTO power_automate_config (company_id, template_type, webhook_url, is_active)
VALUES (
  1,
  'kpi_setting_reminder',
  'https://defaultea69055931dd42289ce7ad509c2ee2.9d.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/e866baa0a8624971ba124925233111b3/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=d34_0brJ4N1R8mzKCorWMRG4HkFk1f5yDP0gvOBeGxs',
  true
)
ON CONFLICT (company_id, template_type) 
DO UPDATE SET 
  webhook_url = EXCLUDED.webhook_url,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- 6. KPI Review Reminder
INSERT INTO power_automate_config (company_id, template_type, webhook_url, is_active)
VALUES (
  1,
  'kpi_review_reminder',
  'https://defaultea69055931dd42289ce7ad509c2ee2.9d.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/1b1179bfa2cd4b5e8dd5b0d44b8b7c24/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=LNPTzlG7cb7oSTMBDdxZ2bCVvJEEDKFn6PfHbOamCh4',
  true
)
ON CONFLICT (company_id, template_type) 
DO UPDATE SET 
  webhook_url = EXCLUDED.webhook_url,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- 7. Overdue KPI Reminder
-- NOTE: This URL appears to be missing the signature part. If it doesn't work, 
-- please get the complete URL from Power Automate and update it.
INSERT INTO power_automate_config (company_id, template_type, webhook_url, is_active)
VALUES (
  1,
  'overdue_kpi_reminder',
  'https://defaultea69055931dd42289ce7ad509c2ee2.9d.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/294dad7aff0b487c9207ef43814f93cd/triggers/manual/paths/invoke?api-version=1',
  true
)
ON CONFLICT (company_id, template_type) 
DO UPDATE SET 
  webhook_url = EXCLUDED.webhook_url,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- 8. Meeting Scheduled Notification
INSERT INTO power_automate_config (company_id, template_type, webhook_url, is_active)
VALUES (
  1,
  'meeting_scheduled',
  'https://defaultea69055931dd42289ce7ad509c2ee2.9d.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/0974ce4c60384d5885930c31de156164/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=iWyWu6ww4STopDZP9qt-BySpGMZT-dViD_bUy789pL0',
  true
)
ON CONFLICT (company_id, template_type) 
DO UPDATE SET 
  webhook_url = EXCLUDED.webhook_url,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- Verify all URLs were inserted
SELECT template_type, webhook_url, is_active, updated_at 
FROM power_automate_config 
WHERE company_id = 1 
ORDER BY template_type;

