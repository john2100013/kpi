# Multi-Company User Management Guide

This guide explains how to assign users (especially HR users) to multiple companies in the KPI Management System.

## Overview

The system uses a `user_companies` junction table to allow users to belong to multiple companies. This is particularly useful for:
- **HR users** who manage multiple companies
- **Managers** who work across different companies
- **Super Admins** who oversee all companies

## How It Works

1. **User-Companies Junction Table**: The `user_companies` table stores the many-to-many relationship between users and companies.
2. **Primary Company**: Each user can have one primary company (marked with `is_primary = true`).
3. **Company Selection**: When a user logs in and belongs to multiple companies, they see a dropdown to select which company's data they want to view.

## Adding a User to Multiple Companies

### Method 1: Using the Command Line Script (Recommended)

#### Interactive Mode
```bash
npm run add-user-to-company
```
This will prompt you to:
1. Enter the user's email
2. Select companies from a list
3. Confirm the action

#### Direct Mode
```bash
npm run add-user-to-company <userEmail> <companyId1> <companyId2> ...
```

**Example:**
```bash
# Add HR Admin to companies with IDs 1, 2, and 3
npm run add-user-to-company j.mungai@ict-a.com 1 2 3
```

### Method 2: Using SQL Directly

You can also add users to companies directly via SQL:

```sql
-- Add user to a company (replace user_id and company_id)
INSERT INTO user_companies (user_id, company_id, is_primary)
VALUES (
    (SELECT id FROM users WHERE email = 'j.mungai@ict-a.com'),
    2,  -- Company ID
    false  -- Set to true if this should be the primary company
)
ON CONFLICT (user_id, company_id) DO NOTHING;
```

**Example: Add HR Admin to multiple companies**
```sql
-- First, find the user ID
SELECT id, name, email FROM users WHERE email = 'j.mungai@ict-a.com';

-- Then add to multiple companies (assuming user_id is 9)
INSERT INTO user_companies (user_id, company_id, is_primary)
VALUES 
    (9, 1, true),   -- Primary company
    (9, 2, false),  -- Second company
    (9, 3, false)   -- Third company
ON CONFLICT (user_id, company_id) DO NOTHING;
```

## Listing User's Companies

To see which companies a user belongs to:

```bash
npm run list-user-companies <userEmail>
```

**Example:**
```bash
npm run list-user-companies j.mungai@ict-a.com
```

This will show:
- User details
- All companies the user belongs to
- Which company is marked as primary (⭐)

## Setting a Primary Company

The first company added to a user is automatically set as primary. To change the primary company:

```sql
-- Remove primary flag from all companies for this user
UPDATE user_companies 
SET is_primary = false 
WHERE user_id = (SELECT id FROM users WHERE email = 'j.mungai@ict-a.com');

-- Set a specific company as primary
UPDATE user_companies 
SET is_primary = true 
WHERE user_id = (SELECT id FROM users WHERE email = 'j.mungai@ict-a.com')
  AND company_id = 2;  -- Company ID to set as primary
```

## Removing a User from a Company

To remove a user from a company:

```sql
DELETE FROM user_companies 
WHERE user_id = (SELECT id FROM users WHERE email = 'j.mungai@ict-a.com')
  AND company_id = 2;  -- Company ID to remove
```

**Note:** If you remove the primary company, the system will automatically select another company as primary (if available).

## User Experience

### Login Flow for Multi-Company Users

1. **User logs in** with email/password or payroll+national_id
2. **System checks** how many companies the user belongs to
3. **If multiple companies:**
   - User is redirected to `/select-company` page
   - User sees a list of companies they belong to
   - User selects which company to view
   - System generates a new JWT with the selected `companyId`
4. **If single company:**
   - User is redirected directly to their dashboard
   - No company selection needed

### Switching Companies

Users with multiple companies can switch companies using:
- **Header dropdown** (if implemented)
- **Company Selection page** (`/select-company`)

## Best Practices

1. **Primary Company**: Always set a primary company for users with multiple companies. This is used as a default when the user first logs in.

2. **HR Users**: HR users are the most common candidates for multi-company access. They often manage HR functions across multiple companies.

3. **Data Isolation**: When a user selects a company, they only see data for that company. The `companyId` in the JWT ensures proper data filtering.

4. **Permissions**: Ensure users have appropriate permissions for all companies they belong to. The system respects role-based access control per company.

## Troubleshooting

### User can't see company selection
- Check if user belongs to multiple companies: `npm run list-user-companies <email>`
- Verify `user_companies` table has multiple entries for the user

### User sees wrong company data
- Check the JWT token's `companyId` claim
- Verify the user has access to the company in `user_companies` table
- Ensure backend routes filter by `companyId` correctly

### Primary company not set
- Run SQL to set primary: `UPDATE user_companies SET is_primary = true WHERE user_id = X AND company_id = Y`
- Or use the script which automatically sets the first company as primary

## Example: Adding HR Admin to Multiple Companies

```bash
# Step 1: Check current companies
npm run list-user-companies j.mungai@ict-a.com

# Step 2: Add to additional companies
npm run add-user-to-company j.mungai@ict-a.com 1 2 3

# Step 3: Verify
npm run list-user-companies j.mungai@ict-a.com
```

The HR Admin will now:
- See a company selection dropdown when logging in
- Be able to switch between companies
- See data only for the selected company

