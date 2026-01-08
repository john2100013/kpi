import bcrypt from 'bcryptjs';
import { createPool } from '../config/database.js';

const pool = createPool();

async function createSuperAdmin() {
  try {
    console.log('🔐 Creating Super Admin user...');
    
    // First, update the role constraint if needed
    await pool.query(`
      ALTER TABLE users 
        DROP CONSTRAINT IF EXISTS users_role_check;
      
      ALTER TABLE users 
        ADD CONSTRAINT users_role_check 
        CHECK (role IN ('employee', 'manager', 'hr', 'super_admin'));
    `);
    
    // Generate password hash for 'SuperAdmin@2024'
    const password = 'SuperAdmin@2024';
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Check if super admin already exists
    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      ['superadmin@kpi-system.com']
    );
    
    if (existing.rows.length > 0) {
      // Update existing super admin
      await pool.query(
        `UPDATE users 
         SET name = 'Super Admin', 
             password_hash = $1, 
             role = 'super_admin',
             payroll_number = 'SUPER-ADMIN-001',
             company_id = NULL
         WHERE email = 'superadmin@kpi-system.com'`,
        [passwordHash]
      );
      console.log('✅ Super Admin updated successfully!');
    } else {
      // Create new super admin
      await pool.query(
        `INSERT INTO users (name, email, password_hash, role, payroll_number, company_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['Super Admin', 'superadmin@kpi-system.com', passwordHash, 'super_admin', 'SUPER-ADMIN-001', null]
      );
      console.log('✅ Super Admin created successfully!');
    }
    
    console.log('\n🔑 Super Admin Credentials:');
    console.log('   Email: superadmin@kpi-system.com');
    console.log('   Password: SuperAdmin@2024');
    console.log('\n⚠️  Please change the password after first login!');
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating super admin:', error.message);
    await pool.end();
    process.exit(1);
  }
}

createSuperAdmin();

