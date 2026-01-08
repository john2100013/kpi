import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createPool } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pool = createPool();

async function runMigration() {
  try {
    console.log('🔄 Starting migration: Add accomplishments and disappointments fields...');
    
    const sqlPath = join(__dirname, '../database/migration_add_accomplishments_disappointments.sql');
    const sql = readFileSync(sqlPath, 'utf8');
    
    await pool.query(sql);
    
    console.log('✅ Migration completed successfully!');
    console.log('   - Added major_accomplishments column');
    console.log('   - Added major_accomplishments_manager_comment column');
    console.log('   - Added disappointments column');
    console.log('   - Added disappointments_manager_comment column');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
