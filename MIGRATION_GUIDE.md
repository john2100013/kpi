# Quick Start Guide - Using New Migration System

## Overview
The backend now has a proper migration system with up/down support for easy database schema changes and rollbacks.

## Migration Commands

### View Migration Status
```bash
npm run migrate status
```
Shows which migrations have been executed and which are pending.

### Run Migrations
```bash
# Run all pending migrations
npm run migrate up

# Run only the next migration
npm run migrate up 1

# Run next 3 migrations
npm run migrate up 3
```

### Rollback Migrations
```bash
# Rollback last migration
npm run migrate down

# Rollback last 2 migrations
npm run migrate down 2
```

### Create New Migration
```bash
npm run migrate create add_user_phone_field
```
This creates a new migration file with timestamp: `database/migrations/20260108123456_add_user_phone_field.js`

## Migration File Structure

Each migration must export two functions: `up` and `down`

```javascript
/**
 * Migration: Add phone field to users table
 * Created: 2026-01-08
 */

export async function up(query) {
  console.log('  Adding phone field...');
  
  await query(`
    ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
    
    CREATE INDEX IF NOT EXISTS idx_users_phone 
    ON users(phone);
  `);
  
  console.log('  Phone field added successfully');
}

export async function down(query) {
  console.log('  Removing phone field...');
  
  await query(`
    DROP INDEX IF EXISTS idx_users_phone;
    
    ALTER TABLE users 
    DROP COLUMN IF EXISTS phone;
  `);
  
  console.log('  Phone field removed successfully');
}
```

## Best Practices

### 1. Always Write Both Up and Down
```javascript
// ✅ Good
export async function up(query) {
  await query(`ALTER TABLE users ADD COLUMN email VARCHAR(255)`);
}

export async function down(query) {
  await query(`ALTER TABLE users DROP COLUMN email`);
}

// ❌ Bad - No down function
export async function up(query) {
  await query(`ALTER TABLE users ADD COLUMN email VARCHAR(255)`);
}
```

### 2. Use IF EXISTS/IF NOT EXISTS
```javascript
// ✅ Good - Safe to run multiple times
await query(`
  CREATE TABLE IF NOT EXISTS logs (
    id SERIAL PRIMARY KEY,
    message TEXT
  );
`);

// ❌ Bad - Will error if table exists
await query(`
  CREATE TABLE logs (
    id SERIAL PRIMARY KEY,
    message TEXT
  );
`);
```

### 3. Test Rollback
Always test that your migration can be rolled back:
```bash
npm run migrate up
npm run migrate down
npm run migrate up
```

### 4. Keep Migrations Small
One logical change per migration:
- ✅ Good: `20260108_add_user_email.js`
- ✅ Good: `20260108_create_logs_table.js`
- ❌ Bad: `20260108_add_email_and_create_logs_and_modify_kpis.js`

### 5. Never Modify Executed Migrations
Once a migration has been run in production, never modify it. Create a new migration instead.

```bash
# ❌ Bad
Edit: 20260101_add_user_field.js

# ✅ Good
Create: 20260108_modify_user_field.js
```

## Example Migrations

### Add New Column
```javascript
export async function up(query) {
  await query(`
    ALTER TABLE users 
    ADD COLUMN department_id INTEGER,
    ADD FOREIGN KEY (department_id) REFERENCES departments(id);
  `);
}

export async function down(query) {
  await query(`
    ALTER TABLE users 
    DROP COLUMN department_id;
  `);
}
```

### Create New Table
```javascript
export async function up(query) {
  await query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      action VARCHAR(100) NOT NULL,
      details JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
    CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
  `);
}

export async function down(query) {
  await query(`
    DROP TABLE IF EXISTS audit_logs;
  `);
}
```

### Add Indexes
```javascript
export async function up(query) {
  await query(`
    CREATE INDEX IF NOT EXISTS idx_kpis_status ON kpis(status);
    CREATE INDEX IF NOT EXISTS idx_kpis_company ON kpis(company_id, status);
  `);
}

export async function down(query) {
  await query(`
    DROP INDEX IF EXISTS idx_kpis_status;
    DROP INDEX IF EXISTS idx_kpis_company;
  `);
}
```

### Data Migration
```javascript
export async function up(query) {
  // Transform data
  await query(`
    UPDATE users 
    SET role = 'employee' 
    WHERE role IS NULL;
  `);
}

export async function down(query) {
  // Restore original state (if possible)
  await query(`
    UPDATE users 
    SET role = NULL 
    WHERE role = 'employee';
  `);
}
```

## Workflow

### Development
```bash
# 1. Create migration
npm run migrate create add_new_feature

# 2. Edit the generated file
# database/migrations/TIMESTAMP_add_new_feature.js

# 3. Run migration
npm run migrate up

# 4. Test rollback
npm run migrate down
npm run migrate up
```

### Production
```bash
# 1. Backup database first!
pg_dump dbname > backup.sql

# 2. Check pending migrations
npm run migrate status

# 3. Run migrations
npm run migrate up

# 4. If something goes wrong, rollback
npm run migrate down
```

## Troubleshooting

### Migration Failed
```bash
# Error appears during migration
❌ Failed: 20260108_add_field.js
Database query error: ...

# Solution: Fix the migration file and try again
npm run migrate up
```

### Migration Table Missing
```bash
# First run creates the migrations table automatically
npm run migrate status

# Creates: migrations table in database
```

### Rollback Failed
```bash
# If rollback fails, you may need to manually fix the database
# Then remove the migration record:

# In psql:
DELETE FROM migrations WHERE name = 'problematic_migration.js';
```

## Tips

1. **Always backup before production migrations**
2. **Test migrations on staging first**
3. **Keep migrations in version control**
4. **Document complex migrations with comments**
5. **Use transactions** (already handled by the system)
6. **Check migration status regularly**

## Migration System Features

✅ **Transaction Support** - Each migration runs in a transaction  
✅ **Rollback Support** - Easy to undo changes  
✅ **Tracking** - Knows which migrations have been executed  
✅ **CLI Interface** - Simple commands  
✅ **Error Handling** - Automatic rollback on failure  
✅ **Status Reporting** - See what's executed and pending  

---

Happy migrating! 🚀
