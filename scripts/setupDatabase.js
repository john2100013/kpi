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
    
    // Ask if user wants to seed data
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

