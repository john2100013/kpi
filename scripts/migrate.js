import { query, pool } from '../database/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Migration System with Up/Down support
 * 
 * Migration file format:
 * migrations/
 *   001_create_users.js
 *   002_add_multi_company.js
 * 
 * Each migration exports: { up: async (query) => {}, down: async (query) => {} }
 */

class MigrationManager {
  constructor() {
    this.migrationsDir = path.join(__dirname, '../database/migrations');
    this.ensureMigrationsTable();
  }

  async ensureMigrationsTable() {
    await query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  /**
   * Get list of executed migrations
   */
  async getExecutedMigrations() {
    const result = await query(
      'SELECT name FROM migrations ORDER BY name ASC'
    );
    return result.rows.map(row => row.name);
  }

  /**
   * Get list of pending migrations
   */
  async getPendingMigrations() {
    if (!fs.existsSync(this.migrationsDir)) {
      console.log('No migrations directory found');
      return [];
    }

    const allMigrations = fs.readdirSync(this.migrationsDir)
      .filter(file => file.endsWith('.js'))
      .sort();

    const executed = await this.getExecutedMigrations();
    return allMigrations.filter(m => !executed.includes(m));
  }

  /**
   * Run pending migrations
   */
  async up(steps = null) {
    const pending = await this.getPendingMigrations();
    
    if (pending.length === 0) {
      console.log('✅ No pending migrations');
      return;
    }

    const toRun = steps ? pending.slice(0, steps) : pending;
    
    console.log(`\n📦 Running ${toRun.length} migration(s)...\n`);

    for (const migrationFile of toRun) {
      try {
        console.log(`⏳ Running: ${migrationFile}`);
        
        const migrationPath = path.join(this.migrationsDir, migrationFile);
        const migration = await import(`file://${migrationPath}`);
        
        if (!migration.up) {
          throw new Error(`Migration ${migrationFile} does not export 'up' function`);
        }

        // Execute migration in transaction
        await query('BEGIN');
        await migration.up(query);
        await query(
          'INSERT INTO migrations (name) VALUES ($1)',
          [migrationFile]
        );
        await query('COMMIT');

        console.log(`✅ Completed: ${migrationFile}\n`);
      } catch (error) {
        await query('ROLLBACK');
        console.error(`❌ Failed: ${migrationFile}`);
        console.error(error);
        throw error;
      }
    }

    console.log(`\n✅ All migrations completed successfully\n`);
  }

  /**
   * Rollback migrations
   */
  async down(steps = 1) {
    const executed = await this.getExecutedMigrations();
    
    if (executed.length === 0) {
      console.log('✅ No migrations to rollback');
      return;
    }

    const toRollback = executed.slice(-steps).reverse();
    
    console.log(`\n📦 Rolling back ${toRollback.length} migration(s)...\n`);

    for (const migrationFile of toRollback) {
      try {
        console.log(`⏳ Rolling back: ${migrationFile}`);
        
        const migrationPath = path.join(this.migrationsDir, migrationFile);
        const migration = await import(`file://${migrationPath}`);
        
        if (!migration.down) {
          throw new Error(`Migration ${migrationFile} does not export 'down' function`);
        }

        // Execute rollback in transaction
        await query('BEGIN');
        await migration.down(query);
        await query(
          'DELETE FROM migrations WHERE name = $1',
          [migrationFile]
        );
        await query('COMMIT');

        console.log(`✅ Rolled back: ${migrationFile}\n`);
      } catch (error) {
        await query('ROLLBACK');
        console.error(`❌ Failed to rollback: ${migrationFile}`);
        console.error(error);
        throw error;
      }
    }

    console.log(`\n✅ Rollback completed successfully\n`);
  }

  /**
   * Show migration status
   */
  async status() {
    const executed = await this.getExecutedMigrations();
    const pending = await this.getPendingMigrations();

    console.log('\n📊 Migration Status\n');
    console.log('Executed migrations:');
    if (executed.length === 0) {
      console.log('  (none)');
    } else {
      executed.forEach(m => console.log(`  ✅ ${m}`));
    }

    console.log('\nPending migrations:');
    if (pending.length === 0) {
      console.log('  (none)');
    } else {
      pending.forEach(m => console.log(`  ⏳ ${m}`));
    }
    console.log('');
  }

  /**
   * Create a new migration file
   */
  async create(name) {
    if (!fs.existsSync(this.migrationsDir)) {
      fs.mkdirSync(this.migrationsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').split('.')[0];
    const filename = `${timestamp}_${name.replace(/\s+/g, '_')}.js`;
    const filepath = path.join(this.migrationsDir, filename);

    const template = `/**
 * Migration: ${name}
 * Created: ${new Date().toISOString()}
 */

export async function up(query) {
  // Write your migration here
  await query(\`
    -- Your SQL here
  \`);
}

export async function down(query) {
  // Write your rollback here
  await query(\`
    -- Your rollback SQL here
  \`);
}
`;

    fs.writeFileSync(filepath, template);
    console.log(`✅ Created migration: ${filename}`);
  }
}

// CLI Interface
async function main() {
  const manager = new MigrationManager();
  const command = process.argv[2];
  const arg = process.argv[3];

  try {
    switch (command) {
      case 'up':
        await manager.up(arg ? parseInt(arg) : null);
        break;
      case 'down':
        await manager.down(arg ? parseInt(arg) : 1);
        break;
      case 'status':
        await manager.status();
        break;
      case 'create':
        if (!arg) {
          console.error('Please provide a migration name');
          console.log('Usage: npm run migrate create <migration-name>');
          process.exit(1);
        }
        await manager.create(arg);
        break;
      default:
        console.log(`
Migration Manager

Commands:
  up [steps]       Run pending migrations (or specific number of steps)
  down [steps]     Rollback migrations (default: 1)
  status           Show migration status
  create <name>    Create a new migration file

Examples:
  npm run migrate up           # Run all pending migrations
  npm run migrate up 1         # Run next 1 migration
  npm run migrate down         # Rollback last migration
  npm run migrate down 2       # Rollback last 2 migrations
  npm run migrate status       # Show status
  npm run migrate create add_user_fields  # Create new migration
        `);
    }
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default MigrationManager;
