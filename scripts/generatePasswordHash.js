const bcrypt = require('bcryptjs');

// Generate password hash for 'password123'
const password = 'password123';
const hash = bcrypt.hashSync(password, 10);

console.log('Password:', password);
console.log('Hash:', hash);
console.log('\nUse this hash in the seed.sql file for all users.');

