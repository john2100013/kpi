/**
 * Script to set up Power Automate webhook URLs in the database
 * Run this after running the migration: migration_power_automate_template_urls.sql
 * 
 * Usage: node scripts/setupPowerAutomateUrls.js
 */

const { query } = require('../database/db');
require('dotenv').config();

const COMPANY_ID = 1; // Change this to your actual company_id if different

const webhookUrls = {
  kpi_assigned: 'https://defaultea69055931dd42289ce7ad509c2ee2.9d.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/efedc8235af04338946ab8abb3c5de98/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=mh5iFtRNzQvZJ-2LM7BZT5GDnnP6yxb0rrcxGFRQxvY',
  kpi_acknowledged: 'https://defaultea69055931dd42289ce7ad509c2ee2.9d.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/fba1f57639494e2aa361b72183adbe22/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=A2pJXmQcpnQhdrrQ3k1gzCRUHR3gqjUs6BMff0IYtdo',
  self_rating_submitted: 'https://defaultea69055931dd42289ce7ad509c2ee2.9d.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/5a9bd0a02222408692f8f77cd44d46ca/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=G9tdWlEiBu-K6SAon6adGsRVlUeINAo2wyI8MOvfuC8',
  review_completed: 'https://defaultea69055931dd42289ce7ad509c2ee2.9d.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/dc93d72c5f464c84938d8545d2585186/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=Vq4D8w882yY4IxcfSn2B5GNmMn4GNwayH8e--o72Zek',
  kpi_setting_reminder: 'https://defaultea69055931dd42289ce7ad509c2ee2.9d.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/e866baa0a8624971ba124925233111b3/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=d34_0brJ4N1R8mzKCorWMRG4HkFk1f5yDP0gvOBeGxs',
  kpi_review_reminder: 'https://defaultea69055931dd42289ce7ad509c2ee2.9d.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/1b1179bfa2cd4b5e8dd5b0d44b8b7c24/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=LNPTzlG7cb7oSTMBDdxZ2bCVvJEEDKFn6PfHbOamCh4',
  overdue_kpi_reminder: 'https://defaultea69055931dd42289ce7ad509c2ee2.9d.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/294dad7aff0b487c9207ef43814f93cd/triggers/manual/paths/invoke?api-version=1', // NOTE: URL may be incomplete - verify in Power Automate
  meeting_scheduled: 'https://defaultea69055931dd42289ce7ad509c2ee2.9d.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/0974ce4c60384d5885930c31de156164/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=iWyWu6ww4STopDZP9qt-BySpGMZT-dViD_bUy789pL0',
};

async function setupPowerAutomateUrls() {
  try {
    console.log('🚀 Setting up Power Automate webhook URLs...\n');

    // Check if table exists and has template_type column
    try {
      const checkResult = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'power_automate_config' 
        AND column_name = 'template_type'
      `);
      
      if (checkResult.rows.length === 0) {
        console.log('⚠️  template_type column not found. Please run migration_power_automate_template_urls.sql first!');
        console.log('   Run: psql -U your_user -d your_database -f database/migration_power_automate_template_urls.sql\n');
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Error checking database schema:', error.message);
      console.log('   Please ensure the power_automate_config table exists.\n');
      process.exit(1);
    }

    // Insert or update each webhook URL
    for (const [templateType, webhookUrl] of Object.entries(webhookUrls)) {
      try {
        const result = await query(
          `INSERT INTO power_automate_config (company_id, template_type, webhook_url, is_active)
           VALUES ($1, $2, $3, true)
           ON CONFLICT (company_id, template_type) 
           DO UPDATE SET 
             webhook_url = EXCLUDED.webhook_url,
             is_active = true,
             updated_at = CURRENT_TIMESTAMP
           RETURNING id, template_type, is_active`,
          [COMPANY_ID, templateType, webhookUrl]
        );

        if (result.rows.length > 0) {
          console.log(`✅ ${templateType}: Configured successfully`);
        }
      } catch (error) {
        console.error(`❌ Error setting up ${templateType}:`, error.message);
      }
    }

    // Verify all URLs
    console.log('\n📋 Verifying configuration...\n');
    const verifyResult = await query(
      `SELECT template_type, webhook_url, is_active, updated_at 
       FROM power_automate_config 
       WHERE company_id = $1 
       ORDER BY template_type`,
      [COMPANY_ID]
    );

    if (verifyResult.rows.length === 0) {
      console.log('⚠️  No webhook URLs found. Please check your company_id.');
    } else {
      console.log(`Found ${verifyResult.rows.length} webhook URL(s):\n`);
      verifyResult.rows.forEach((row) => {
        const status = row.is_active ? '✅ Active' : '❌ Inactive';
        const templateType = row.template_type || '(Default)';
        console.log(`  ${status} - ${templateType}`);
        console.log(`    URL: ${row.webhook_url.substring(0, 80)}...`);
        console.log(`    Updated: ${row.updated_at}\n`);
      });
    }

    console.log('✨ Power Automate URLs setup complete!\n');
  } catch (error) {
    console.error('❌ Error setting up Power Automate URLs:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run the script
setupPowerAutomateUrls();

