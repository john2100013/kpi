import { createPool } from '../config/database.js';

const pool = createPool();

async function addUserToCompany() {
  try {
    console.log('🔗 Adding user to company...');
    
    // Get command line arguments
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
      console.log('\nUsage: node scripts/addUserToCompany.js <userEmail> <companyId1> [companyId2] [companyId3] ...');
      console.log('Example: node scripts/addUserToCompany.js j.mungai@ict-a.com 1 2');
      console.log('\nOr use interactive mode by running without arguments');
      process.exit(1);
    }

    const userEmail = args[0];
    const companyIds = args.slice(1).map(id => parseInt(id));

    // Get user
    const userResult = await pool.query(
      'SELECT id, name, email, role FROM users WHERE email = $1',
      [userEmail]
    );

    if (userResult.rows.length === 0) {
      console.error(`❌ User with email "${userEmail}" not found`);
      process.exit(1);
    }

    const user = userResult.rows[0];
    console.log(`\n👤 Found user: ${user.name} (${user.email}) - Role: ${user.role}`);

    // Verify companies exist
    const companiesResult = await pool.query(
      `SELECT id, name FROM companies WHERE id = ANY($1::int[])`,
      [companyIds]
    );

    if (companiesResult.rows.length !== companyIds.length) {
      console.error('❌ One or more company IDs not found');
      const foundIds = companiesResult.rows.map(c => c.id);
      const missingIds = companyIds.filter(id => !foundIds.includes(id));
      console.error(`Missing company IDs: ${missingIds.join(', ')}`);
      process.exit(1);
    }

    console.log(`\n🏢 Companies to add user to:`);
    companiesResult.rows.forEach(company => {
      console.log(`   - ${company.name} (ID: ${company.id})`);
    });

    // Check existing associations
    const existingResult = await pool.query(
      'SELECT company_id FROM user_companies WHERE user_id = $1',
      [user.id]
    );
    const existingCompanyIds = existingResult.rows.map(r => r.company_id);
    
    console.log(`\n📋 Current company associations: ${existingCompanyIds.length > 0 ? existingCompanyIds.join(', ') : 'None'}`);

    // Add user to companies
    let addedCount = 0;
    let skippedCount = 0;

    for (const companyId of companyIds) {
      if (existingCompanyIds.includes(companyId)) {
        console.log(`⚠️  User already belongs to company ID ${companyId}, skipping...`);
        skippedCount++;
        continue;
      }

      // Check if this should be primary (if user has no primary company yet)
      const hasPrimary = existingCompanyIds.length > 0 || addedCount > 0;
      const isPrimary = !hasPrimary && companyIds.indexOf(companyId) === 0;

      await pool.query(
        'INSERT INTO user_companies (user_id, company_id, is_primary) VALUES ($1, $2, $3) ON CONFLICT (user_id, company_id) DO NOTHING',
        [user.id, companyId, isPrimary]
      );
      addedCount++;
      console.log(`✅ Added user to company ID ${companyId}${isPrimary ? ' (set as primary)' : ''}`);
    }

    console.log(`\n✨ Summary:`);
    console.log(`   - Added to ${addedCount} new company/companies`);
    console.log(`   - Skipped ${skippedCount} (already associated)`);
    console.log(`   - Total companies user belongs to: ${existingCompanyIds.length + addedCount}`);

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

// Interactive mode
async function interactiveMode() {
  try {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (query) => new Promise(resolve => readline.question(query, resolve));

    console.log('🔗 Add User to Company - Interactive Mode\n');

    // Get user email
    const userEmail = await question('Enter user email: ');
    if (!userEmail) {
      console.error('❌ Email is required');
      readline.close();
      process.exit(1);
    }

    // Get user
    const userResult = await pool.query(
      'SELECT id, name, email, role FROM users WHERE email = $1',
      [userEmail]
    );

    if (userResult.rows.length === 0) {
      console.error(`❌ User with email "${userEmail}" not found`);
      readline.close();
      await pool.end();
      process.exit(1);
    }

    const user = userResult.rows[0];
    console.log(`\n👤 Found user: ${user.name} (${user.email}) - Role: ${user.role}\n`);

    // List all companies
    const companiesResult = await pool.query(
      'SELECT id, name FROM companies ORDER BY name'
    );

    if (companiesResult.rows.length === 0) {
      console.error('❌ No companies found in database');
      readline.close();
      await pool.end();
      process.exit(1);
    }

    console.log('Available companies:');
    companiesResult.rows.forEach(company => {
      console.log(`   ${company.id}. ${company.name}`);
    });

    // Get company IDs
    const companyIdsInput = await question('\nEnter company IDs (comma-separated, e.g., 1,2,3): ');
    const companyIds = companyIdsInput.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));

    if (companyIds.length === 0) {
      console.error('❌ No valid company IDs provided');
      readline.close();
      await pool.end();
      process.exit(1);
    }

    // Verify companies exist
    const validCompanies = companiesResult.rows.filter(c => companyIds.includes(c.id));
    if (validCompanies.length !== companyIds.length) {
      console.error('❌ One or more company IDs not found');
      readline.close();
      await pool.end();
      process.exit(1);
    }

    console.log(`\n🏢 Companies to add user to:`);
    validCompanies.forEach(company => {
      console.log(`   - ${company.name} (ID: ${company.id})`);
    });

    // Check existing associations
    const existingResult = await pool.query(
      'SELECT uc.company_id, c.name FROM user_companies uc JOIN companies c ON uc.company_id = c.id WHERE uc.user_id = $1',
      [user.id]
    );
    
    if (existingResult.rows.length > 0) {
      console.log(`\n📋 Current company associations:`);
      existingResult.rows.forEach(row => {
        console.log(`   - ${row.name} (ID: ${row.company_id})`);
      });
    } else {
      console.log(`\n📋 Current company associations: None`);
    }

    const confirm = await question('\nProceed? (y/n): ');
    if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
      console.log('Cancelled.');
      readline.close();
      await pool.end();
      process.exit(0);
    }

    // Add user to companies
    let addedCount = 0;
    let skippedCount = 0;
    const existingCompanyIds = existingResult.rows.map(r => r.company_id);

    for (const companyId of companyIds) {
      if (existingCompanyIds.includes(companyId)) {
        console.log(`⚠️  User already belongs to company ID ${companyId}, skipping...`);
        skippedCount++;
        continue;
      }

      // Check if this should be primary (if user has no primary company yet)
      const hasPrimary = existingCompanyIds.length > 0 || addedCount > 0;
      const isPrimary = !hasPrimary && companyIds.indexOf(companyId) === 0;

      await pool.query(
        'INSERT INTO user_companies (user_id, company_id, is_primary) VALUES ($1, $2, $3) ON CONFLICT (user_id, company_id) DO NOTHING',
        [user.id, companyId, isPrimary]
      );
      addedCount++;
      console.log(`✅ Added user to company ID ${companyId}${isPrimary ? ' (set as primary)' : ''}`);
    }

    console.log(`\n✨ Summary:`);
    console.log(`   - Added to ${addedCount} new company/companies`);
    console.log(`   - Skipped ${skippedCount} (already associated)`);
    console.log(`   - Total companies user belongs to: ${existingCompanyIds.length + addedCount}`);

    readline.close();
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

// Check if running in interactive mode
if (process.argv.length === 2) {
  interactiveMode();
} else {
  addUserToCompany();
}

