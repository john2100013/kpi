-- Verification Script: Multi-Company Support Structure
-- Run this to verify your database structure is correct for multi-company support

-- 1. Check if user_companies table exists and has correct structure
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'user_companies'
ORDER BY ordinal_position;

-- 2. Check for unique constraint on (user_id, company_id)
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    tc.constraint_type
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'user_companies'
    AND tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY')
ORDER BY tc.constraint_type, kcu.ordinal_position;

-- 3. Check indexes on user_companies table
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'user_companies';

-- 4. Verify foreign key constraints
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'user_companies';

-- 5. Check current user-company associations
SELECT 
    u.id AS user_id,
    u.name AS user_name,
    u.email,
    u.role,
    c.id AS company_id,
    c.name AS company_name,
    uc.is_primary,
    uc.created_at
FROM users u
INNER JOIN user_companies uc ON u.id = uc.user_id
INNER JOIN companies c ON uc.company_id = c.id
ORDER BY u.id, uc.is_primary DESC, c.name;

-- 6. Count companies per user (to identify multi-company users)
SELECT 
    u.id,
    u.name,
    u.email,
    u.role,
    COUNT(uc.company_id) AS company_count,
    STRING_AGG(c.name, ', ' ORDER BY uc.is_primary DESC, c.name) AS companies
FROM users u
LEFT JOIN user_companies uc ON u.id = uc.user_id
LEFT JOIN companies c ON uc.company_id = c.id
WHERE u.role IN ('hr', 'manager')
GROUP BY u.id, u.name, u.email, u.role
ORDER BY company_count DESC, u.name;

