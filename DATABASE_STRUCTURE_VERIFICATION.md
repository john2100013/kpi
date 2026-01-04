# Database Structure Verification for Multi-Company Support

This document verifies that the database structure correctly supports HR users belonging to multiple companies.

## Required Database Structure

### 1. `user_companies` Table (Junction Table)

This table is **critical** for multi-company support. It must have the following structure:

```sql
CREATE TABLE user_companies (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, company_id)  -- Prevents duplicate associations
);
```

**Key Points:**
- `user_id` references `users(id)` with CASCADE delete
- `company_id` references `companies(id)` with CASCADE delete
- `UNIQUE(user_id, company_id)` ensures one user can only be associated with each company once
- `is_primary` marks the primary company (only one should be true per user)

### 2. Required Indexes

For performance, these indexes should exist:

```sql
CREATE INDEX idx_user_companies_user ON user_companies(user_id);
CREATE INDEX idx_user_companies_company ON user_companies(company_id);
```

### 3. How It Works

1. **Login Process:**
   - User logs in with email/password
   - System queries `user_companies` to get all companies for that user
   - If multiple companies found → user sees company selection dropdown
   - If single company → user goes directly to dashboard
   - JWT token includes the selected `companyId`

2. **Data Filtering:**
   - All queries filter by `companyId` from JWT token
   - Backend middleware verifies user has access to the company via `user_companies` table

3. **Company Selection:**
   - User can switch companies using `/select-company` endpoint
   - New JWT is generated with the selected `companyId`

## Verification Steps

### Step 1: Verify Table Structure

Run this SQL to check if the table structure is correct:

```sql
-- Check table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'user_companies'
ORDER BY ordinal_position;
```

**Expected Result:**
- `id` (integer, not null)
- `user_id` (integer, not null)
- `company_id` (integer, not null)
- `is_primary` (boolean, default false)
- `created_at` (timestamp)

### Step 2: Verify Unique Constraint

```sql
-- Check for unique constraint
SELECT
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'user_companies'
    AND tc.constraint_type = 'UNIQUE';
```

**Expected Result:** Should show a UNIQUE constraint on `(user_id, company_id)`

### Step 3: Verify Foreign Keys

```sql
-- Check foreign key constraints
SELECT
    tc.constraint_name,
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
```

**Expected Result:**
- `user_id` → `users(id)`
- `company_id` → `companies(id)`

### Step 4: Verify Indexes

```sql
-- Check indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'user_companies';
```

**Expected Result:** Should have indexes on `user_id` and `company_id`

## Adding HR User to Multiple Companies

### Direct SQL Method

1. **Find the HR user ID:**
```sql
SELECT id, name, email, role 
FROM users 
WHERE email = 'j.mungai@ict-a.com'  -- Replace with actual email
    AND role = 'hr';
```

2. **List available companies:**
```sql
SELECT id, name 
FROM companies 
ORDER BY id;
```

3. **Add HR user to multiple companies:**
```sql
-- Replace 9 with actual user_id from Step 1
-- Replace 1, 2, 3 with actual company IDs from Step 2
INSERT INTO user_companies (user_id, company_id, is_primary)
VALUES 
    (9, 1, true),   -- First company is primary
    (9, 2, false),  -- Second company
    (9, 3, false)   -- Third company
ON CONFLICT (user_id, company_id) DO NOTHING;
```

4. **Verify the association:**
```sql
SELECT 
    u.name AS user_name,
    u.email,
    c.name AS company_name,
    uc.is_primary
FROM users u
INNER JOIN user_companies uc ON u.id = uc.user_id
INNER JOIN companies c ON uc.company_id = c.id
WHERE u.email = 'j.mungai@ict-a.com'
ORDER BY uc.is_primary DESC, c.name;
```

## How Login Works with Multiple Companies

The login endpoint (`/api/auth/login`) does the following:

1. Authenticates the user (email/password or payroll+national_id)
2. Queries `user_companies` table:
   ```sql
   SELECT c.id, c.name, c.domain, uc.is_primary
   FROM companies c
   INNER JOIN user_companies uc ON c.id = uc.company_id
   WHERE uc.user_id = $1
   ORDER BY uc.is_primary DESC, c.name
   ```
3. Returns:
   - `companies`: Array of all companies user belongs to
   - `hasMultipleCompanies`: Boolean (true if count > 1)
   - `token`: JWT with selected `companyId` (primary company or first one)

4. Frontend checks `hasMultipleCompanies`:
   - If `true` → redirects to `/select-company`
   - If `false` → redirects to role-based dashboard

## Important Notes

1. **Primary Company:** Only one company should have `is_primary = true` per user. The first company added is typically set as primary.

2. **Data Isolation:** When a user selects a company, all data queries filter by `companyId` from the JWT token.

3. **Access Control:** The middleware verifies the user has access to the company before allowing any operations.

4. **Cascade Deletes:** If a user or company is deleted, all associations in `user_companies` are automatically deleted (CASCADE).

5. **No Duplicates:** The UNIQUE constraint prevents adding the same user-company association twice.

## Troubleshooting

### User doesn't see company selection
- Check: `SELECT COUNT(*) FROM user_companies WHERE user_id = X;`
- Should return > 1 for multi-company users

### User can't access a company
- Verify: `SELECT * FROM user_companies WHERE user_id = X AND company_id = Y;`
- Should return a row if user has access

### Primary company not set
- Check: `SELECT * FROM user_companies WHERE user_id = X AND is_primary = true;`
- Should return exactly one row
- Fix: `UPDATE user_companies SET is_primary = true WHERE user_id = X AND company_id = Y;`

## Quick Verification Script

Run `VERIFY_MULTI_COMPANY_STRUCTURE.sql` to check all aspects of the structure at once.

