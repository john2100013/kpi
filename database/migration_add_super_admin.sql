-- Migration: Add Super Admin Role Support
-- This migration adds support for super admin role and updates constraints

-- Update users table to allow 'super_admin' role
ALTER TABLE users 
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users 
  ADD CONSTRAINT users_role_check 
  CHECK (role IN ('employee', 'manager', 'hr', 'super_admin'));

-- Note: Super admin user will be created by running: npm run create-super-admin
-- Or use the createSuperAdmin.js script
-- This ensures the password hash is properly generated with bcrypt

-- Note: Super admin doesn't need to be in user_companies table
-- They have access to all companies

