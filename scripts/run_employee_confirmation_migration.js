const pool = require('../database/db');
const fs = require('fs');

async function runMigration() {
  try {
    // Drop old constraint
    await pool.query('ALTER TABLE kpi_reviews DROP CONSTRAINT IF EXISTS kpi_reviews_review_status_check');
    console.log('✅ Dropped old constraint');
    
    // Update existing 'manager_submitted' rows to 'awaiting_employee_confirmation'
    const updateResult = await pool.query(`
      UPDATE kpi_reviews 
      SET review_status = 'awaiting_employee_confirmation' 
      WHERE review_status = 'manager_submitted'
    `);
    console.log(`✅ Updated ${updateResult.rowCount} existing rows from 'manager_submitted' to 'awaiting_employee_confirmation'`);
    
    // Add new constraint with updated statuses
    await pool.query(`
      ALTER TABLE kpi_reviews 
      ADD CONSTRAINT kpi_reviews_review_status_check 
      CHECK (review_status IN (
        'pending', 
        'employee_submitted', 
        'awaiting_employee_confirmation',
        'completed',
        'rejected'
      ))
    `);
    console.log('✅ Added new constraint with updated statuses');
    
    // Add new columns
    await pool.query(`
      ALTER TABLE kpi_reviews 
      ADD COLUMN IF NOT EXISTS employee_confirmation_status VARCHAR(20),
      ADD COLUMN IF NOT EXISTS employee_rejection_note TEXT,
      ADD COLUMN IF NOT EXISTS employee_confirmation_signature TEXT,
      ADD COLUMN IF NOT EXISTS employee_confirmation_signed_at TIMESTAMP
    `);
    console.log('✅ Added new columns');
    
    // Add index
    await pool.query('CREATE INDEX IF NOT EXISTS idx_kpi_reviews_status ON kpi_reviews(review_status)');
    console.log('✅ Added index');
    
    console.log('\n🎉 Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

runMigration();
