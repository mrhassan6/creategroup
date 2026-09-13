import bcrypt from 'bcryptjs';
import { db } from './src/db.js';
import { handleLogin, authMiddleware, adminMiddleware, generateToken } from './src/auth.js';

async function test() {
  console.log('--- Testing Single-Device Enforcement & Admin Controls ---');

  // 1. Set up Admin and Standard User
  const adminSalt = await bcrypt.genSalt(10);
  const adminHash = await bcrypt.hash('adminpass123', adminSalt);
  
  let adminUser = db.findUserByUsername('hassan');
  if (!adminUser) {
    adminUser = db.createUser({ username: 'hassan', passwordHash: adminHash, role: 'admin' });
  }

  const userSalt = await bcrypt.genSalt(10);
  const userHash = await bcrypt.hash('userpass123', userSalt);
  let regularUser = db.findUserByUsername('worker1');
  if (!regularUser) {
    regularUser = db.createUser({ username: 'worker1', passwordHash: userHash, role: 'user' });
  }

  console.log('✓ Admin user ready:', adminUser.username, 'Role:', adminUser.role);
  console.log('✓ Regular user ready:', regularUser.username, 'Role:', regularUser.role);

  // 2. Single-Device Test
  // Device 1 logs in:
  const session1 = 'session_device_1_' + Date.now();
  db.updateUserSession(regularUser.id, session1);
  const token1 = generateToken(regularUser, session1);
  console.log('✓ Device 1 logged in, Session ID:', session1);

  // Device 2 logs in with same user:
  const session2 = 'session_device_2_' + Date.now();
  db.updateUserSession(regularUser.id, session2);
  const token2 = generateToken(regularUser, session2);
  console.log('✓ Device 2 logged in, Session ID:', session2);

  // Test middleware on Device 1 (should fail):
  let req1 = { headers: { authorization: 'Bearer ' + token1 } };
  let res1 = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
  let next1Called = false;
  authMiddleware(req1, res1, () => { next1Called = true; });

  if (res1.body?.error === 'SESSION_TERMINATED') {
    console.log('✓ SUCCESS: Device 1 was correctly terminated with SESSION_TERMINATED!');
  } else {
    throw new Error('Device 1 was not terminated! Error: ' + JSON.stringify(res1.body));
  }

  // Test middleware on Device 2 (should succeed):
  let req2 = { headers: { authorization: 'Bearer ' + token2 } };
  let res2 = {
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
  let next2Called = false;
  authMiddleware(req2, res2, () => { next2Called = true; });

  if (next2Called && req2.user.username === 'worker1') {
    console.log('✓ SUCCESS: Device 2 active and authenticated!');
  } else {
    throw new Error('Device 2 failed auth: ' + JSON.stringify(res2.body));
  }

  // 3. Admin Permissions Check
  let adminReq = { user: { id: adminUser.id, role: 'admin' } };
  let adminRes = { status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
  let adminNextCalled = false;
  adminMiddleware(adminReq, adminRes, () => { adminNextCalled = true; });
  if (!adminNextCalled) throw new Error('Admin was blocked!');
  console.log('✓ Admin middleware allows Admin role');

  let userReq = { user: { id: regularUser.id, role: 'user' } };
  let userRes = { status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
  let userNextCalled = false;
  adminMiddleware(userReq, userRes, () => { userNextCalled = true; });
  if (userRes.body?.error === 'ADMIN_REQUIRED') {
    console.log('✓ Non-admin is correctly blocked with ADMIN_REQUIRED');
  } else {
    throw new Error('Non-admin was not blocked!');
  }

  console.log('====================================================');
  console.log('ALL SINGLE-DEVICE & ADMIN TESTS PASSED! 🎉');
  console.log('====================================================');
}

test().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
