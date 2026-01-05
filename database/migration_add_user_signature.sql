-- Migration: Add User Signature Field
-- This migration adds a signature field to the users table to allow users to save their signature

-- Add signature column to users table
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS signature TEXT;

-- Add comment to document the field
COMMENT ON COLUMN users.signature IS 'Base64 encoded signature image for the user';

