# Database Setup Guide

## Option 1: Automatic Setup (Recommended)

Run the setup script that will create all tables automatically:

```bash
cd kpi-process-backend
npm run setup-db
```

This will:
1. Connect to your PostgreSQL database
2. Create all required tables
3. Optionally seed sample data

**Make sure:**
- Your `.env` file is configured correctly
- Your database exists (if using `kpi db` with space, make sure it's created)
- PostgreSQL is running

## Option 2: Manual Setup using psql

If you prefer to run SQL manually:

### Step 1: Connect to PostgreSQL
```bash
psql -U postgres
```

### Step 2: Create Database (if not exists)
```sql
CREATE DATABASE "kpi_management";
-- OR if your database is "kpi db" (with space):
CREATE DATABASE "kpi db";
```

### Step 3: Connect to your database
```sql
\c "kpi_management"
-- OR if your database is "kpi db":
\c "kpi db"
```

### Step 4: Run the schema
```sql
\i database/schema.sql
```

Or from command line:
```bash
psql -U postgres -d "kpi_management" -f database/schema.sql
```

### Step 5: (Optional) Seed sample data
```bash
psql -U postgres -d "kpi_management" -f database/seed.sql
```

## Option 3: Using pgAdmin

1. Open pgAdmin
2. Connect to your PostgreSQL server
3. Right-click on your database → Query Tool
4. Open `database/schema.sql` file
5. Execute the SQL (F5 or Execute button)
6. (Optional) Do the same for `database/seed.sql`

## Troubleshooting

### Error: "database does not exist"
Create the database first:
```sql
CREATE DATABASE "kpi_management";
```

### Error: "password authentication failed"
Check your `.env` file - make sure `DB_PASSWORD` matches your PostgreSQL password.

### Error: "relation already exists"
Tables already exist. You can either:
- Drop and recreate: `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`
- Or just continue (tables use `CREATE TABLE IF NOT EXISTS`)

## Database Name Note

If your database name is `kpi db` (with a space):
- In `.env`: Use `DB_NAME="kpi db"` (with quotes)
- In SQL commands: Use `"kpi db"` (with quotes)
- The setup script will handle this automatically

## Verify Tables Created

After setup, verify tables exist:
```sql
\dt
```

You should see:
- users
- kpis
- kpi_reviews
- notifications
- kpi_setting_reminders
- kpi_review_reminders

