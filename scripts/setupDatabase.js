const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Handle database name with or without quotes
let dbName = process.env.DB_NAME || 'kpi_management';
// Remove quotes if present (pg handles it)
dbName = dbName.replace(/^["']|["']$/g, '');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: dbName,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function setupDatabase() {
  try {
    console.log('🔄 Connecting to PostgreSQL database...');
    
    // Read schema file
    const schemaPath = path.join(__dirname, '../database/schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

    console.log('📊 Creating tables...');
    
    // Execute schema
    await pool.query(schemaSQL);
    
    console.log('✅ Database tables created successfully!');
    
    // Execute migration for KPI items if it exists
    try {
      const migrationPath = path.join(__dirname, '../database/migration_add_kpi_items.sql');
      if (fs.existsSync(migrationPath)) {
        console.log('📦 Running KPI items migration...');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        await pool.query(migrationSQL);
        console.log('✅ KPI items migration executed successfully!');
      }
    } catch (error) {
      console.log('⚠️  Migration error (may be okay if tables already exist):', error.message);
    }

    // Execute migration for multi-tenancy and settings if it exists
    try {
      const migrationPath = path.join(__dirname, '../database/migration_multi_tenancy_and_settings.sql');
      if (fs.existsSync(migrationPath)) {
        console.log('📦 Running multi-tenancy and settings migration...');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        await pool.query(migrationSQL);
        console.log('✅ Multi-tenancy and settings migration executed successfully!');
      }
    } catch (error) {
      console.log('⚠️  Migration error (may be okay if tables already exist):', error.message);
    }

    // Execute migration for Power Automate and email templates if it exists
    try {
      const migrationPath = path.join(__dirname, '../database/migration_power_automate_and_templates.sql');
      if (fs.existsSync(migrationPath)) {
        console.log('📦 Running Power Automate and email templates migration...');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        await pool.query(migrationSQL);
        console.log('✅ Power Automate and email templates migration executed successfully!');
      }
    } catch (error) {
      console.log('⚠️  Migration error (may be okay if tables already exist):', error.message);
    }

    // Execute migration for Power Automate template-specific URLs if it exists
    try {
      const migrationPath = path.join(__dirname, '../database/migration_power_automate_template_urls.sql');
      if (fs.existsSync(migrationPath)) {
        console.log('📦 Running Power Automate template URLs migration...');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        await pool.query(migrationSQL);
        console.log('✅ Power Automate template URLs migration executed successfully!');
      }
    } catch (error) {
      console.log('⚠️  Migration error (may be okay if tables already exist):', error.message);
    }

    // Execute migration for CC emails in daily reminders if it exists
    try {
      const migrationPath = path.join(__dirname, '../database/migration_add_cc_emails_to_daily_reminders.sql');
      if (fs.existsSync(migrationPath)) {
        console.log('📦 Running CC emails migration...');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        await pool.query(migrationSQL);
        console.log('✅ CC emails migration executed successfully!');
      }
    } catch (error) {
      console.log('⚠️  Migration error (may be okay if tables already exist):', error.message);
    }

    // Execute migration for flexible reminder types if it exists
    try {
      const migrationPath = path.join(__dirname, '../database/migration_flexible_reminder_types.sql');
      if (fs.existsSync(migrationPath)) {
        console.log('📦 Running flexible reminder types migration...');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        await pool.query(migrationSQL);
        console.log('✅ Flexible reminder types migration executed successfully!');
      }
    } catch (error) {
      console.log('⚠️  Migration error (may be okay if tables already exist):', error.message);
    }

    // Execute migration for KPI items enhancements if it exists
    try {
      const migrationPath = path.join(__dirname, '../database/migration_kpi_items_enhancements.sql');
      if (fs.existsSync(migrationPath)) {
        console.log('📦 Running KPI items enhancements migration...');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        await pool.query(migrationSQL);
        console.log('✅ KPI items enhancements migration executed successfully!');
      }
    } catch (error) {
      console.log('⚠️  Migration error (may be okay if tables already exist):', error.message);
    }

    // Execute migration for rating constraints update if it exists
    try {
      const migrationPath = path.join(__dirname, '../database/migration_update_rating_constraints.sql');
      if (fs.existsSync(migrationPath)) {
        console.log('📦 Running rating constraints update migration...');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        await pool.query(migrationSQL);
        console.log('✅ Rating constraints update migration executed successfully!');
      }
    } catch (error) {
      console.log('⚠️  Migration error (may be okay if tables already exist):', error.message);
    }

    // Execute migration for multi-company support if it exists
    try {
      const migrationPath = path.join(__dirname, '../database/migration_multi_company_support.sql');
      if (fs.existsSync(migrationPath)) {
        console.log('📦 Running multi-company support migration...');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        await pool.query(migrationSQL);
        console.log('✅ Multi-company support migration executed successfully!');
      }
    } catch (error) {
      console.log('⚠️  Migration error (may be okay if tables already exist):', error.message);
    }

    // Execute migration for super admin if it exists
    try {
      const migrationPath = path.join(__dirname, '../database/migration_add_super_admin.sql');
      if (fs.existsSync(migrationPath)) {
        console.log('📦 Running super admin migration...');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        await pool.query(migrationSQL);
        console.log('✅ Super admin migration executed successfully!');
        console.log('💡 Run "npm run create-super-admin" to create the super admin user');
      }
    } catch (error) {
      console.log('⚠️  Migration error (may be okay if tables already exist):', error.message);
    }

    // Execute migration for employee indexes if it exists
    try {
      const migrationPath = path.join(__dirname, '../database/migration_add_employee_indexes.sql');
      if (fs.existsSync(migrationPath)) {
        console.log('📦 Running employee indexes migration...');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        await pool.query(migrationSQL);
        console.log('✅ Employee indexes migration executed successfully!');
      }
    } catch (error) {
      console.log('⚠️  Migration error (may be okay if indexes already exist):', error.message);
    }

    // Seed rating options (always run - these are configuration, not sample data)
    try {
      console.log('🔗 Seeding rating options...');
      const ratingOptionsSeedPath = path.join(__dirname, '../database/seed_rating_options.sql');
      if (fs.existsSync(ratingOptionsSeedPath)) {
        const ratingOptionsSeedSQL = fs.readFileSync(ratingOptionsSeedPath, 'utf8');
        await pool.query(ratingOptionsSeedSQL);
        console.log('✅ Rating options seeded successfully!');
      }
    } catch (error) {
      console.error('⚠️  Error seeding rating options (this is okay if options already exist):', error.message);
    }

    // Seed Power Automate URLs (always run - these are configuration, not sample data)
    try {
      console.log('🔗 Seeding Power Automate webhook URLs...');
      const powerAutomateSeedPath = path.join(__dirname, '../database/seed_power_automate_urls.sql');
      if (fs.existsSync(powerAutomateSeedPath)) {
        const powerAutomateSeedSQL = fs.readFileSync(powerAutomateSeedPath, 'utf8');
        await pool.query(powerAutomateSeedSQL);
        console.log('✅ Power Automate webhook URLs seeded successfully!');
      }
    } catch (error) {
      console.error('⚠️  Error seeding Power Automate URLs (this is okay if URLs already exist):', error.message);
    }
    
    // Ask if user wants to seed sample data
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    readline.question('\n❓ Do you want to seed the database with sample data? (y/n): ', async (answer) => {
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        try {
          console.log('🌱 Seeding database with sample data...');
          const seedPath = path.join(__dirname, '../database/seed.sql');
          const seedSQL = fs.readFileSync(seedPath, 'utf8');
          await pool.query(seedSQL);
          console.log('✅ Sample data seeded successfully!');
        } catch (error) {
          console.error('⚠️  Error seeding data (this is okay if data already exists):', error.message);
        }
      }
      
      await pool.end();
      readline.close();
      console.log('\n✨ Database setup complete!');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Error setting up database:', error.message);
    console.error('\nPlease check:');
    console.error('1. PostgreSQL is running');
    console.error('2. Database exists (create it if needed: CREATE DATABASE "kpi_management";)');
    console.error('3. .env file has correct database credentials');
    await pool.end();
    process.exit(1);
  }
}

setupDatabase();

