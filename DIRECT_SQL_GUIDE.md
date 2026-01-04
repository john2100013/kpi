# Direct SQL Guide: Adding HR Users to Multiple Companies

This guide shows you how to add HR users to multiple companies **directly in the database** without using scripts.

## Database Structure Verification

The database structure is **correctly set up** for multi-company support:

✅ **`user_companies` table exists** with:
- `user_id` (references `users.id`)
- `company_id` (references `companies.id`)
- `is_primary` (boolean, marks primary company)
- `UNIQUE(user_id, company_id)` constraint (prevents duplicates)

✅ **Login endpoint** queries `user_companies` to get all companies for a user

✅ **Middleware** verifies user has access to the selected company via `user_companies`

## Step-by-Step: Add HR Admin to Multiple Companies

### Step 1: Find the HR User ID

Run this SQL to find the HR user:

```sql
SELECT 
    id,
    name,
    email,
    role,
    company_id AS current_company_id
FROM users
WHERE email = 'j.mungai@ict-a.com'  -- Replace with your HR user's email
    AND role = 'hr';
```

**Example Result:**
```
id | name      | email                | role | current_company_id
---|-----------|----------------------|------|-------------------
9  | HR Admin  | j.mungai@ict-a.com   | hr   | 1
```

**Note the `id` value (in this case: 9)** - you'll need it in Step 3.

### Step 2: List Available Companies

Run this SQL to see all companies:

```sql
SELECT 
    id,
    name,
    domain,
    created_at
FROM companies
ORDER BY id;
```

**Example Result:**
```
id | name             | domain           | created_at
---|------------------|------------------|------------
1  | Default Company  | example.com      | 2024-01-01
2  | Company B         | companyb.com    | 2024-01-02
3  | Company C         | companyc.com    | 2024-01-03
```

**Note the company IDs** you want to add the HR user to.

### Step 3: Check Current Associations

Before adding, check which companies the HR user already belongs to:

```sql
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
```

**Example Result:**
```
user_id | user_name | email              | company_id | company_name    | is_primary | created_at
--------|-----------|-------------------|------------|-----------------|-----------|------------
9       | HR Admin  | j.mungai@ict-a.com| 1          | Default Company | true      | 2024-01-01
```

### Step 4: Add HR User to Additional Companies

Now add the HR user to additional companies. **Replace the values** with your actual IDs:

```sql
-- Add HR Admin (user_id = 9) to companies with IDs 2 and 3
-- The first company (ID 1) already exists, so we only add 2 and 3
-- Set is_primary = false for additional companies (keep ID 1 as primary)

INSERT INTO user_companies (user_id, company_id, is_primary)
VALUES 
    (9, 2, false),  -- Add to company ID 2 (not primary)
    (9, 3, false)   -- Add to company ID 3 (not primary)
ON CONFLICT (user_id, company_id) DO NOTHING;  -- Prevents errors if already exists
```

**Important:**
- Replace `9` with the actual `user_id` from Step 1
- Replace `2, 3` with the actual `company_id` values from Step 2
- The `ON CONFLICT` clause prevents errors if the association already exists
- Only set `is_primary = true` for ONE company per user (usually the first one)

### Step 5: Verify the Changes

Verify the HR user now belongs to multiple companies:

```sql
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
```

**Expected Result:**
```
user_id | user_name | email              | company_id | company_name    | is_primary | created_at
--------|-----------|-------------------|------------|-----------------|-----------|------------
9       | HR Admin  | j.mungai@ict-a.com| 1          | Default Company | true      | 2024-01-01
9       | HR Admin  | j.mungai@ict-a.com| 2          | Company B        | false     | 2024-01-15
9       | HR Admin  | j.mungai@ict-a.com| 3          | Company C        | false     | 2024-01-15
```

## Complete Example SQL Script

Here's a complete script you can copy and modify:

```sql
-- ============================================================================
-- COMPLETE EXAMPLE: Add HR Admin to Multiple Companies
-- ============================================================================

-- Step 1: Get HR user ID (replace email)
DO $$
DECLARE
    hr_user_id INTEGER;
BEGIN
    SELECT id INTO hr_user_id
    FROM users
    WHERE email = 'j.mungai@ict-a.com'  -- REPLACE WITH YOUR HR EMAIL
        AND role = 'hr';
    
    IF hr_user_id IS NULL THEN
        RAISE EXCEPTION 'HR user not found with email: j.mungai@ict-a.com';
    END IF;
    
    RAISE NOTICE 'Found HR user ID: %', hr_user_id;
    
    -- Step 2: Add to multiple companies
    -- Replace company IDs (1, 2, 3) with your actual company IDs
    INSERT INTO user_companies (user_id, company_id, is_primary)
    SELECT 
        hr_user_id,
        company_id,
        CASE 
            WHEN company_id = 1 THEN true   -- First company is primary
            ELSE false                     -- Others are not primary
        END AS is_primary
    FROM (VALUES (1), (2), (3)) AS t(company_id)  -- REPLACE WITH YOUR COMPANY IDs
    WHERE NOT EXISTS (
        SELECT 1 
        FROM user_companies 
        WHERE user_id = hr_user_id 
            AND company_id = t.company_id
    );
    
    RAISE NOTICE 'Added HR user to companies successfully';
END $$;

-- Step 3: Verify
SELECT 
    u.name AS user_name,
    u.email,
    c.name AS company_name,
    uc.is_primary
FROM users u
INNER JOIN user_companies uc ON u.id = uc.user_id
INNER JOIN companies c ON uc.company_id = c.id
WHERE u.email = 'j.mungai@ict-a.com'  -- REPLACE WITH YOUR HR EMAIL
ORDER BY uc.is_primary DESC, c.name;
```

## Changing Primary Company

If you need to change which company is the primary company:

```sql
-- Step 1: Remove primary flag from all companies for this user
UPDATE user_companies 
SET is_primary = false 
WHERE user_id = 9;  -- Replace with actual user_id

-- Step 2: Set the desired company as primary
UPDATE user_companies 
SET is_primary = true 
WHERE user_id = 9  -- Replace with actual user_id
    AND company_id = 2;  -- Replace with desired primary company_id
```

## Removing a User from a Company

To remove a user from a specific company:

```sql
DELETE FROM user_companies 
WHERE user_id = 9  -- Replace with actual user_id
    AND company_id = 3;  -- Replace with company_id to remove
```

**Note:** If you remove the primary company, you should set another company as primary.

## How It Works After Adding

Once you've added the HR user to multiple companies:

1. **On Next Login:**
   - HR Admin logs in with email/password
   - System queries `user_companies` table
   - Finds multiple companies (count > 1)
   - Returns `hasMultipleCompanies: true`
   - Frontend redirects to `/select-company` page
   - User sees a dropdown with all companies

2. **Company Selection:**
   - User selects a company from the dropdown
   - System generates new JWT with selected `companyId`
   - User is redirected to their dashboard
   - All data is filtered by the selected company

3. **Switching Companies:**
   - User can switch companies using the header dropdown
   - New JWT is generated with the new `companyId`
   - Page reloads with data for the new company

## Verification Checklist

After adding companies, verify:

- [ ] `user_companies` table has multiple rows for the user
- [ ] Only ONE company has `is_primary = true`
- [ ] All company IDs exist in `companies` table
- [ ] User can log in and see company selection dropdown
- [ ] User can switch between companies

## Troubleshooting

### Error: "duplicate key value violates unique constraint"
- **Cause:** Trying to add the same user-company association twice
- **Solution:** Use `ON CONFLICT (user_id, company_id) DO NOTHING` in your INSERT

### Error: "insert or update on table violates foreign key constraint"
- **Cause:** Company ID doesn't exist in `companies` table
- **Solution:** Verify company IDs exist: `SELECT id FROM companies WHERE id IN (2, 3);`

### User doesn't see company selection after adding
- **Cause:** User might not have multiple companies, or frontend cache issue
- **Solution:** 
  1. Verify: `SELECT COUNT(*) FROM user_companies WHERE user_id = 9;` (should be > 1)
  2. Clear browser cache and log out/in again

### User can't access a company
- **Cause:** User not in `user_companies` for that company
- **Solution:** Verify: `SELECT * FROM user_companies WHERE user_id = 9 AND company_id = 2;`

## Quick Reference

**Add user to company:**
```sql
INSERT INTO user_companies (user_id, company_id, is_primary)
VALUES (9, 2, false)
ON CONFLICT (user_id, company_id) DO NOTHING;
```

**Check user's companies:**
```sql
SELECT c.name, uc.is_primary
FROM user_companies uc
JOIN companies c ON uc.company_id = c.id
WHERE uc.user_id = 9;
```

**Set primary company:**
```sql
UPDATE user_companies 
SET is_primary = true 
WHERE user_id = 9 AND company_id = 2;
```

