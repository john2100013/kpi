-- Migration: Optimize database for large datasets (1M+ records)
-- This migration adds indexes and optimizations for handling millions of KPIs and employees

-- ========== Add Indexes for Users Table ==========

-- Index for employee lookups by company and department
CREATE INDEX IF NOT EXISTS idx_users_company_dept_role 
ON users(company_id, department, role) 
WHERE role = 'employee';

-- Index for manager lookups
CREATE INDEX IF NOT EXISTS idx_users_manager_company 
ON users(manager_id, company_id) 
WHERE role = 'employee';

-- Index for employee role and company (used in counts)
CREATE INDEX IF NOT EXISTS idx_users_role_company 
ON users(role, company_id);

-- ========== Add Indexes for KPIs Table ==========

-- Composite index for employee KPI lookups with created_at for latest KPI queries
CREATE INDEX IF NOT EXISTS idx_kpis_employee_created 
ON kpis(employee_id, created_at DESC, company_id);

-- Index for company-wide KPI queries
CREATE INDEX IF NOT EXISTS idx_kpis_company_status 
ON kpis(company_id, status);

-- Index for manager KPI queries
CREATE INDEX IF NOT EXISTS idx_kpis_manager_company 
ON kpis(manager_id, company_id);

-- Partial index for pending KPIs (faster status filtering)
CREATE INDEX IF NOT EXISTS idx_kpis_pending 
ON kpis(company_id, employee_id) 
WHERE status = 'pending';

-- Partial index for acknowledged KPIs
CREATE INDEX IF NOT EXISTS idx_kpis_acknowledged 
ON kpis(company_id, employee_id) 
WHERE status = 'acknowledged';

-- ========== Add Indexes for KPI Reviews Table ==========

-- Index for KPI to review lookup
CREATE INDEX IF NOT EXISTS idx_kpi_reviews_kpi_id 
ON kpi_reviews(kpi_id);

-- Index for employee review queries
CREATE INDEX IF NOT EXISTS idx_kpi_reviews_employee_company 
ON kpi_reviews(employee_id, company_id);

-- Index for manager review queries
CREATE INDEX IF NOT EXISTS idx_kpi_reviews_manager_company 
ON kpi_reviews(manager_id, company_id);

-- Index for review status filtering
CREATE INDEX IF NOT EXISTS idx_kpi_reviews_status 
ON kpi_reviews(review_status, company_id);

-- ========== Add Indexes for Notifications Table ==========

-- Index for recipient notifications with read status
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read 
ON notifications(recipient_id, read, created_at DESC);

-- Index for notification types
CREATE INDEX IF NOT EXISTS idx_notifications_type_company 
ON notifications(type, company_id) 
WHERE company_id IS NOT NULL;

-- ========== Add Indexes for KPI Items Table ==========

-- Index for KPI items lookup
CREATE INDEX IF NOT EXISTS idx_kpi_items_kpi_order 
ON kpi_items(kpi_id, item_order);

-- ========== Statistics and Analysis Views ==========

-- Create a materialized view for department statistics (optional - for very large datasets)
-- This can be refreshed periodically to improve dashboard load times
-- Comment out if not needed or if real-time data is required

-- DROP MATERIALIZED VIEW IF EXISTS department_statistics_cache;
-- CREATE MATERIALIZED VIEW department_statistics_cache AS
-- WITH latest_kpis AS (
--   SELECT DISTINCT ON (k.employee_id) 
--     k.employee_id,
--     k.id as kpi_id,
--     k.status as kpi_status,
--     k.created_at,
--     k.company_id,
--     kr.id as review_id,
--     kr.review_status
--   FROM kpis k
--   LEFT JOIN kpi_reviews kr ON k.id = kr.kpi_id
--   ORDER BY k.employee_id, k.created_at DESC
-- ),
-- employee_status AS (
--   SELECT 
--     u.id as employee_id,
--     u.company_id,
--     u.department,
--     CASE
--       WHEN lk.kpi_id IS NULL THEN 'no_kpi'
--       WHEN lk.kpi_status = 'pending' THEN 'pending'
--       WHEN lk.kpi_status = 'acknowledged' AND lk.review_id IS NULL THEN 'acknowledged_review_pending'
--       WHEN lk.review_status = 'employee_submitted' THEN 'self_rating_submitted'
--       WHEN lk.review_status IN ('manager_submitted', 'completed') THEN 'review_completed'
--       WHEN lk.review_status = 'pending' THEN 'review_pending'
--       ELSE 'unknown'
--     END as category,
--     lk.created_at as last_kpi_date
--   FROM users u
--   LEFT JOIN latest_kpis lk ON u.id = lk.employee_id AND u.company_id = lk.company_id
--   WHERE u.role = 'employee'
--     AND u.department IS NOT NULL 
--     AND u.department != ''
-- )
-- SELECT 
--   company_id,
--   department,
--   COUNT(*) as total_employees,
--   COUNT(*) FILTER (WHERE category = 'pending') as pending,
--   COUNT(*) FILTER (WHERE category = 'acknowledged_review_pending') as acknowledged_review_pending,
--   COUNT(*) FILTER (WHERE category = 'self_rating_submitted') as self_rating_submitted,
--   COUNT(*) FILTER (WHERE category = 'review_completed') as review_completed,
--   COUNT(*) FILTER (WHERE category = 'review_pending') as review_pending,
--   COUNT(*) FILTER (WHERE category = 'no_kpi') as no_kpi,
--   MAX(last_kpi_date) as last_updated
-- FROM employee_status
-- GROUP BY company_id, department;

-- Create index on materialized view
-- CREATE INDEX IF NOT EXISTS idx_dept_stats_cache_company 
-- ON department_statistics_cache(company_id, department);

-- ========== Analyze Tables for Query Optimization ==========

ANALYZE users;
ANALYZE kpis;
ANALYZE kpi_reviews;
ANALYZE kpi_items;
ANALYZE notifications;

-- ========== Performance Notes ==========
-- 1. For datasets with 1M+ records, consider:
--    - Enabling connection pooling (already configured in db.js)
--    - Using read replicas for reporting queries
--    - Implementing caching layer (Redis) for frequently accessed data
--    - Partitioning large tables by company_id or date ranges
--    
-- 2. The DISTINCT ON queries used in latest_kpis CTEs are efficient with these indexes
--    
-- 3. Regular VACUUM and ANALYZE operations should be scheduled:
--    - VACUUM ANALYZE runs weekly
--    - ANALYZE runs daily on frequently updated tables
--    
-- 4. Monitor slow queries and adjust indexes as needed
--    - Enable pg_stat_statements extension
--    - Review query execution plans regularly

-- ========== Verify Indexes ==========
-- Run these queries to verify indexes are created:
-- SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname;
-- SELECT * FROM pg_stat_user_indexes WHERE schemaname = 'public' ORDER BY idx_scan DESC;
