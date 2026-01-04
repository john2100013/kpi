-- Migration: Add Indexes for Employee Queries Performance
-- This migration adds indexes to optimize employee-related queries

-- Create pg_trgm extension first (required for full-text search)
-- This must be done before creating indexes that use gin_trgm_ops
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'
    ) THEN
        CREATE EXTENSION pg_trgm;
    END IF;
END $$;

-- Index for company_id and role (most common filter)
CREATE INDEX IF NOT EXISTS idx_users_company_role ON users(company_id, role) WHERE role = 'employee';

-- Index for manager_id (for manager team queries)
CREATE INDEX IF NOT EXISTS idx_users_manager ON users(manager_id) WHERE manager_id IS NOT NULL;

-- Index for department_id
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department_id) WHERE department_id IS NOT NULL;

-- Index for payroll_number per company (already exists but ensure it's there)
CREATE INDEX IF NOT EXISTS idx_users_payroll_company ON users(payroll_number, company_id);

-- Index for name search (for ILIKE queries using trigram)
-- Only create if pg_trgm extension is available
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'
    ) THEN
        -- Drop index if it exists with wrong operator class
        DROP INDEX IF EXISTS idx_users_name_trgm;
        -- Create index with correct operator class
        CREATE INDEX idx_users_name_trgm ON users USING gin(name gin_trgm_ops);
    ELSE
        -- Fallback: Create a regular btree index for name (less efficient but works)
        CREATE INDEX IF NOT EXISTS idx_users_name_btree ON users(name);
    END IF;
END $$;

-- Composite index for common employee list queries
CREATE INDEX IF NOT EXISTS idx_users_company_role_name ON users(company_id, role, name) WHERE role = 'employee';

