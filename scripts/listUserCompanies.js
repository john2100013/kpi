import { createPool } from '../config/database.js';

const pool = createPool();

async function listUserCompanies() {
  try {
    const args = process.argv.slice(2);
    const userEmail = args[0];

    if (!userEmail) {
      console.log('Usage: node scripts/listUserCompanies.js <userEmail>');
      console.log('Example: node scripts/listUserCompanies.js j.mungai@ict-a.com');
      process.exit(1);
    }

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
    console.log(`\n👤 User: ${user.name} (${user.email}) - Role: ${user.role}\n`);

    // Get companies
    const companiesResult = await pool.query(
      `SELECT c.id, c.name, c.domain, uc.is_primary
       FROM companies c
       INNER JOIN user_companies uc ON c.id = uc.company_id
       WHERE uc.user_id = $1
       ORDER BY uc.is_primary DESC, c.name`,
      [user.id]
    );

    if (companiesResult.rows.length === 0) {
      console.log('📋 This user does not belong to any companies.');
      console.log('   Use "npm run add-user-to-company" to add the user to companies.');
    } else {
      console.log(`📋 Companies (${companiesResult.rows.length}):`);
      companiesResult.rows.forEach((company, index) => {
        const primary = company.is_primary ? '⭐ PRIMARY' : '';
        console.log(`   ${index + 1}. ${company.name} (ID: ${company.id}) ${primary}`);
        if (company.domain) {
          console.log(`      Domain: ${company.domain}`);
        }
      });
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

listUserCompanies();

