import { db } from './src/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

async function test() {
  console.log('--- Testing DB and Auth Functions ---');
  
  // 1. Create test user
  const username = 'testuser_' + Date.now();
  const password = 'securepassword123';
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);
  
  const user = db.createUser({ username, passwordHash });
  console.log('✓ Created User:', user.username, 'ID:', user.id);
  
  // 2. Fetch user
  const found = db.findUserByUsername(username);
  if (!found) throw new Error('User not found in DB');
  console.log('✓ Found User in DB:', found.username);
  
  // 3. Verify password
  const isValid = await bcrypt.compare(password, found.passwordHash);
  if (!isValid) throw new Error('Password mismatch');
  console.log('✓ Password verified with bcrypt');
  
  // 4. Test group record saving
  const group = db.saveGroupRecord({
    userId: user.id,
    groupName: 'VIP Club #1',
    groupId: '12345678@g.us',
    inviteLink: 'https://chat.whatsapp.com/TESTCODE123',
    targetNumber: '14155552671',
    status: 'created'
  });
  console.log('✓ Saved Group Record:', group.groupName, group.inviteLink);
  
  const userGroups = db.getUserGroups(user.id);
  if (userGroups.length !== 1) throw new Error('Failed to retrieve user groups');
  console.log('✓ Retrieved User Groups Count:', userGroups.length);

  console.log('====================================');
  console.log('ALL LOCAL DB & AUTH TESTS PASSED! 🎉');
  console.log('====================================');
}

test().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
