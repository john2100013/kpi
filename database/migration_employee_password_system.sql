-- Migration: Employee Password Authentication System
-- Add password_change_required field and ensure email is not nullable

-- Add password_change_required field to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS password_change_required BOOLEAN DEFAULT FALSE;

-- Set password_change_required to TRUE for all existing employees without a password
UPDATE users 
SET password_change_required = TRUE 
WHERE role = 'employee' AND (password_hash IS NULL OR password_hash = '');

-- Make sure email can be NULL initially but we'll generate it for employees
ALTER TABLE users 
ALTER COLUMN email DROP NOT NULL;

-- Drop the unique constraint (not the index) if it exists
ALTER TABLE users 
DROP CONSTRAINT IF EXISTS users_email_key;

-- Create partial unique index to allow NULL emails but ensure uniqueness for non-NULL values
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users (email) WHERE email IS NOT NULL;

-- Create index for payroll_number login (already exists but ensuring it's there)
CREATE INDEX IF NOT EXISTS idx_users_payroll_number ON users(payroll_number);

-- Create index for email login
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;

-- Add comment
COMMENT ON COLUMN users.password_change_required IS 'Flag to indicate if user must change password on next login (default password)';

-- For existing employees without email, generate one from payroll number
UPDATE users 
SET email = LOWER(CONCAT(payroll_number, '@employee.local'))
WHERE role = 'employee' AND (email IS NULL OR email = '');

-- Add check constraint to ensure employees have either email
ALTER TABLE users
ADD CONSTRAINT users_employee_email_check 
CHECK (role != 'employee' OR email IS NOT NULL);
