-- Migration: Multi-Company Support and Enhanced User Management
-- This migration adds support for users belonging to multiple companies,
-- proper department management, and manager-department assignments

-- Create Departments table
CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, name)
);

-- Create User-Companies junction table (many-to-many relationship)
-- This allows users (especially HR) to belong to multiple companies
CREATE TABLE IF NOT EXISTS user_companies (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT false, -- Primary company for the user
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, company_id)
);

-- Create Manager-Departments junction table (many-to-many relationship)
-- This allows managers to manage multiple departments
CREATE TABLE IF NOT EXISTS manager_departments (
    id SERIAL PRIMARY KEY,
    manager_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(manager_id, department_id)
);

-- Update users table to make email and password optional (for employees)
-- Employees use payroll_number + national_id, managers/HR use email + password
ALTER TABLE users 
    ALTER COLUMN email DROP NOT NULL,
    ALTER COLUMN password_hash DROP NOT NULL;

-- Add unique constraint for email only when it's not null
-- We'll handle this with a partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique 
    ON users(email) 
    WHERE email IS NOT NULL;

-- Make payroll_number unique per company instead of globally unique
-- First, drop the existing unique constraint if it exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'users_payroll_number_key'
    ) THEN
        ALTER TABLE users DROP CONSTRAINT users_payroll_number_key;
    END IF;
END $$;

-- Add unique constraint for payroll_number per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_payroll_company_unique 
    ON users(payroll_number, company_id) 
    WHERE payroll_number IS NOT NULL;

-- Make national_id unique per company instead of globally unique
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'users_national_id_key'
    ) THEN
        ALTER TABLE users DROP CONSTRAINT users_national_id_key;
    END IF;
END $$;

-- Add unique constraint for national_id per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_national_id_company_unique 
    ON users(national_id, company_id) 
    WHERE national_id IS NOT NULL;

-- Update users table to reference department_id instead of department string
ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL;

-- Migrate existing department strings to departments table and link users
DO $$
DECLARE
    dept_record RECORD;
    dept_id_var INTEGER;
    company_id_var INTEGER;
BEGIN
    -- For each unique company
    FOR company_id_var IN SELECT DISTINCT id FROM companies LOOP
        -- For each unique department name in that company
        FOR dept_record IN 
            SELECT DISTINCT department 
            FROM users 
            WHERE company_id = company_id_var 
            AND department IS NOT NULL 
            AND department != ''
        LOOP
            -- Create department if it doesn't exist
            INSERT INTO departments (company_id, name)
            VALUES (company_id_var, dept_record.department)
            ON CONFLICT (company_id, name) DO NOTHING
            RETURNING id INTO dept_id_var;
            
            -- If department already exists, get its ID
            IF dept_id_var IS NULL THEN
                SELECT id INTO dept_id_var 
                FROM departments 
                WHERE company_id = company_id_var 
                AND name = dept_record.department 
                LIMIT 1;
            END IF;
            
            -- Update users to reference the department
            UPDATE users 
            SET department_id = dept_id_var 
            WHERE company_id = company_id_var 
            AND department = dept_record.department
            AND department_id IS NULL;
        END LOOP;
    END LOOP;
END $$;

-- Populate user_companies table from existing company_id in users
INSERT INTO user_companies (user_id, company_id, is_primary)
SELECT id, company_id, true
FROM users
WHERE company_id IS NOT NULL
ON CONFLICT (user_id, company_id) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_departments_company ON departments(company_id);
CREATE INDEX IF NOT EXISTS idx_user_companies_user ON user_companies(user_id);
CREATE INDEX IF NOT EXISTS idx_user_companies_company ON user_companies(company_id);
CREATE INDEX IF NOT EXISTS idx_manager_departments_manager ON manager_departments(manager_id);
CREATE INDEX IF NOT EXISTS idx_manager_departments_department ON manager_departments(department_id);
CREATE INDEX IF NOT EXISTS idx_manager_departments_company ON manager_departments(company_id);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department_id);

-- Add comment for documentation
COMMENT ON TABLE user_companies IS 'Junction table allowing users to belong to multiple companies';
COMMENT ON TABLE manager_departments IS 'Junction table allowing managers to manage multiple departments';
COMMENT ON TABLE departments IS 'Company departments with proper normalization';

