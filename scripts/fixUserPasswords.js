const { query, pool } = require('../database/db');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Proper bcrypt hash for 'password123'
const passwordHash = '$2a$10$8Pio3SlGOHzEDRyBUyYE2OkFn7P/iJG9R69UUVxv7wHvZyrfOYjmC';

async function fixUserPasswords() {
  try {
    console.log('🔄 Connecting to database...');
    
    // Test connection
    await query('SELECT 1');
    console.log('✅ Connected to database');
    
    console.log('🔄 Updating user passwords...');
    
    // Update all users with the correct password hash
    const result = await query(
      'UPDATE users SET password_hash = $1 WHERE password_hash != $1 OR password_hash IS NULL',
      [passwordHash]
    );

    console.log(`✅ Updated ${result.rowCount} user(s) with correct password hash`);
    console.log('\n📝 All users now have password: password123');
    console.log('   You can login with:');
    console.log('   - Email: any user email (e.g., john.manager@company.com)');
    console.log('   - Password: password123');
    console.log('   OR');
    console.log('   - Payroll Number + National ID (as before)');
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating passwords:', error.message);
    console.error('\nPlease check:');
    console.error('1. Database is running');
    console.error('2. .env file has correct database credentials');
    console.error('3. Database tables are created (run: npm run setup-db)');
    if (pool) await pool.end();
    process.exit(1);
  }
}

fixUserPasswords();

