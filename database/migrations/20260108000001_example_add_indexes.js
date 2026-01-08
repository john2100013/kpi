/**
 * Migration: Example - Add indexes for performance
 * Created: 2026-01-08
 * 
 * This is an example migration showing the up/down pattern
 */

export async function up(query) {
  console.log('  Adding performance indexes...');
  
  await query(`
    CREATE INDEX IF NOT EXISTS idx_kpis_company_status 
    ON kpis(company_id, status);
    
    CREATE INDEX IF NOT EXISTS idx_users_company_role 
    ON users(company_id, role);
    
    CREATE INDEX IF NOT EXISTS idx_notifications_recipient_company 
    ON notifications(recipient_id, company_id, created_at DESC);
  `);
  
  console.log('  Indexes created successfully');
}

export async function down(query) {
  console.log('  Removing performance indexes...');
  
  await query(`
    DROP INDEX IF EXISTS idx_kpis_company_status;
    DROP INDEX IF EXISTS idx_users_company_role;
    DROP INDEX IF EXISTS idx_notifications_recipient_company;
  `);
  
  console.log('  Indexes removed successfully');
}
