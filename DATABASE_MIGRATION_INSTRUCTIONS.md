# Database Migration Instructions

## Running Migrations

To apply all database migrations including the new employee indexes, run:

```bash
cd kpi-process-backend
npm run setup-db
```

This will:
1. Create all base tables (if they don't exist)
2. Run all migration files in order:
   - Multi-tenancy and settings
   - KPI items enhancements
   - Rating constraints update
   - Multi-company support
   - Super admin support
   - **Employee indexes** (for performance optimization)

## What the Employee Indexes Migration Does

The `migration_add_employee_indexes.sql` file adds the following indexes to optimize employee queries:

1. **idx_users_company_role** - Speeds up filtering by company and role
2. **idx_users_manager** - Optimizes manager team queries
3. **idx_users_department** - Fast department filtering
4. **idx_users_name_trgm** - Full-text search on employee names (requires pg_trgm extension)
5. **idx_users_company_role_name** - Composite index for common list queries

These indexes significantly improve query performance, especially when:
- Paginating through large employee lists
- Searching employees by name
- Filtering by department or manager
- Loading manager teams

## Important Notes

- The migration is **idempotent** - it's safe to run multiple times
- If indexes already exist, they won't be recreated
- The `pg_trgm` extension is automatically created if it doesn't exist
- No data loss will occur - this only adds indexes

## Verifying Indexes

After running the migration, you can verify the indexes were created:

```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'users' 
AND indexname LIKE 'idx_users%';
```

You should see all the indexes listed above.

