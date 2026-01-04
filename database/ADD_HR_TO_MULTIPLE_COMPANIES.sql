-- SQL Script: Add HR User to Multiple Companies
-- This script shows how to add HR users to multiple companies directly in the database

-- ============================================================================
-- STEP 1: Find the HR User ID and Available Companies
-- ============================================================================

-- Find HR user by email
SELECT 
    id,
    name,
    email,
    role,
    company_id AS current_company_id
FROM users
WHERE email = 'j.mungai@ict-a.com'  -- Replace with your HR user's email
    AND role = 'hr';

-- List all available companies
SELECT 
    id,
    name,
    domain,
    created_at
FROM companies
ORDER BY id;

-- ============================================================================
-- STEP 2: Check Current Company Associations
-- ============================================================================

-- Check which companies the HR user currently belongs to
SELECT 
    u.id AS user_id,
    u.name AS user_name,
    u.email,
    c.id AS company_id,
    c.name AS company_name,
    uc.is_primary,
    uc.created_at
FROM users u
INNER JOIN user_companies uc ON u.id = uc.user_id
INNER JOIN companies c ON uc.company_id = c.id
WHERE u.email = 'j.mungai@ict-a.com'  -- Replace with your HR user's email
ORDER BY uc.is_primary DESC, c.name;

-- ============================================================================
-- STEP 3: Add HR User to Additional Companies
-- ============================================================================

-- IMPORTANT: Replace the values below with actual IDs from Step 1
-- Format: (user_id, company_id, is_primary)

-- Example: Add HR Admin (user_id = 9) to companies with IDs 2 and 3
-- The first company should have is_primary = true (if not already set)
-- Additional companies should have is_primary = false

INSERT INTO user_companies (user_id, company_id, is_primary)
VALUES 
    (9, 2, false),  -- Add to company ID 2 (not primary)
    (9, 3, false)   -- Add to company ID 3 (not primary)
ON CONFLICT (user_id, company_id) DO NOTHING;  -- Prevents duplicate entries

-- ============================================================================
-- STEP 4: Set Primary Company (if needed)
-- ============================================================================

-- If you want to change which company is primary, first remove primary from all:
UPDATE user_companies 
SET is_primary = false 
WHERE user_id = 9;  -- Replace with actual user_id

-- Then set the desired company as primary:
UPDATE user_companies 
SET is_primary = true 
WHERE user_id = 9  -- Replace with actual user_id
    AND company_id = 1;  -- Replace with desired primary company_id

-- ============================================================================
-- STEP 5: Verify the Changes
-- ============================================================================

-- Verify the HR user now belongs to multiple companies
SELECT 
    u.id AS user_id,
    u.name AS user_name,
    u.email,
    c.id AS company_id,
    c.name AS company_name,
    uc.is_primary,
    uc.created_at
FROM users u
INNER JOIN user_companies uc ON u.id = uc.user_id
INNER JOIN companies c ON uc.company_id = c.id
WHERE u.email = 'j.mungai@ict-a.com'  -- Replace with your HR user's email
ORDER BY uc.is_primary DESC, c.name;

-- ============================================================================
-- COMPLETE EXAMPLE: Add HR Admin to Multiple Companies
-- ============================================================================

-- Step 1: Get user ID (assuming email is 'j.mungai@ict-a.com')
-- Let's say the result shows user_id = 9

-- Step 2: Get company IDs (assuming you have companies with IDs 1, 2, 3)
-- Company 1 already exists, so we'll add to 2 and 3

-- Step 3: Add to additional companies
INSERT INTO user_companies (user_id, company_id, is_primary)
SELECT 
    9,  -- user_id from Step 1
    company_id,
    CASE 
        WHEN company_id = 1 THEN true   -- Keep first company as primary
        ELSE false                     -- Other companies are not primary
    END AS is_primary
FROM (VALUES (1), (2), (3)) AS t(company_id)  -- List of company IDs
WHERE NOT EXISTS (
    SELECT 1 
    FROM user_companies 
    WHERE user_id = 9 
        AND company_id = t.company_id
);

-- Step 4: Verify
SELECT 
    u.name AS user_name,
    u.email,
    c.name AS company_name,
    uc.is_primary
FROM users u
INNER JOIN user_companies uc ON u.id = uc.user_id
INNER JOIN companies c ON uc.company_id = c.id
WHERE u.id = 9
ORDER BY uc.is_primary DESC, c.name;

-- ============================================================================
-- REMOVING A USER FROM A COMPANY (if needed)
-- ============================================================================

-- To remove a user from a specific company:
-- DELETE FROM user_companies 
-- WHERE user_id = 9  -- Replace with actual user_id
--     AND company_id = 3;  -- Replace with company_id to remove

-- ============================================================================
-- NOTES:
-- ============================================================================
-- 1. The user_companies table has a UNIQUE constraint on (user_id, company_id)
--    This prevents duplicate entries automatically
-- 
-- 2. The ON CONFLICT clause ensures no errors if the association already exists
--
-- 3. Only one company should have is_primary = true per user
--
-- 4. When a user logs in with multiple companies, they will see a dropdown
--    to select which company's data they want to view
--
-- 5. The login endpoint queries user_companies to get all companies for a user
--
-- 6. The JWT token includes the selected companyId for data filtering

