import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import {
  handleLogin,
  handleRegister,
  authMiddleware,
  adminMiddleware,
  handleAdminGetUsers,
  handleAdminCreateUser,
  handleAdminUpdateUser,
  handleAdminResetPassword,
  handleAdminToggleUser,
  handleAdminKickUser,
  handleAdminDeleteUser
} from './auth.js';
import { whatsappManager } from './whatsappManager.js';
import { db, initDb } from './db.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Global resilience handlers against uncaught crashes
process.on('unhandledRejection', (reason, promise) => {
  console.warn('[Process] Unhandled Promise Rejection (safely caught):', reason?.message || reason);
});
process.on('uncaughtException', (err) => {
  console.error('[Process] Uncaught Exception (safely caught):', err);
});


// AUTOMATED CLEANUP: Permanently delete expired accounts
setInterval(() => {
  try {
    const expiredIds = db.pruneExpiredUsers();
    for (const id of expiredIds) {
      console.log(`[Auto-Prune] Permanently deleted expired user account: ${id}`);
      // Safely wipe their WhatsApp session data from disk if it exists
      whatsappManager.logout(id).catch(() => {});
    }
  } catch (err) {}
}, 60 * 1000); // Check every minute

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'gc-agent-jwt-super-secret-key-2026';

app.use(cors({ origin: '*' }));
app.use(express.json());

// Public Auth Endpoints
app.post('/api/auth/register', handleRegister);
app.post('/api/auth/login', handleLogin);

// Current User Profile
app.get('/api/user/me', authMiddleware, (req, res) => {
  const user = db.findUserById(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({
    id: user.id,
    username: user.username,
    role: user.role || 'user',
    createdAt: user.createdAt
  });
});

// ADMIN ROUTES
app.get('/api/admin/users', authMiddleware, adminMiddleware, handleAdminGetUsers);
app.post('/api/admin/users', authMiddleware, adminMiddleware, handleAdminCreateUser);
app.put('/api/admin/users/:id', authMiddleware, adminMiddleware, handleAdminUpdateUser);
app.put('/api/admin/users/:id/password', authMiddleware, adminMiddleware, handleAdminResetPassword);
app.put('/api/admin/users/:id/toggle', authMiddleware, adminMiddleware, handleAdminToggleUser);
app.post('/api/admin/users/:id/kick', authMiddleware, adminMiddleware, handleAdminKickUser);
app.delete('/api/admin/users/:id', authMiddleware, adminMiddleware, handleAdminDeleteUser);

// WhatsApp Device Status
app.get('/api/whatsapp/status', authMiddleware, async (req, res) => {
  try {
    const status = whatsappManager.getStatus(req.user.id);
    res.json(status);
  } catch (err) {
    console.error('WhatsApp status error:', err);
    res.status(500).json({ error: 'Failed to retrieve WhatsApp status. Internal server error.' });
  }
});

// Request 8-Digit Pairing Code (Instead of QR code)
app.post('/api/whatsapp/pair-code', authMiddleware, async (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) {
    return res.status(400).json({ error: 'Phone number is required (with country code, e.g. 923256540880)' });
  }
  if (typeof phoneNumber !== 'string' || phoneNumber.length > 30) {
    return res.status(400).json({ error: 'Invalid phone number length or format.' });
  }

  try {
    const result = await whatsappManager.requestPairingCode(req.user.id, phoneNumber);
    res.json(result);
  } catch (err) {
    console.error('Pairing code generation error:', err);
    res.status(500).json({ error: 'Failed to request pairing code. Please verify the phone number and try again.' });
  }
});

// Unlink / Logout WhatsApp Companion Device
app.post('/api/whatsapp/logout', authMiddleware, async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    await whatsappManager.logout(req.user.id, phoneNumber);
    res.json({ success: true, message: 'Device unlinked successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Failed to unlink device securely. Internal server error.' });
  }
});

// Stop Group Creation Batch
app.post('/api/whatsapp/stop-create', authMiddleware, (req, res) => {
  try {
    const { senderNumber } = req.body;
    const stopped = whatsappManager.cancelJob(req.user.id, senderNumber);
    if (stopped) {
      res.json({ success: true, message: 'Stop signal sent.' });
    } else {
      res.json({ success: false, message: 'No active job to stop.' });
    }
  } catch (err) {
    console.error('Stop creation error:', err);
    res.status(500).json({ error: 'Failed to stop creation process.' });
  }
});

// Get User's Created Groups History
app.get('/api/whatsapp/groups', authMiddleware, (req, res) => {
  try {
    const groups = db.getUserGroups(req.user.id);
    res.json(groups);
  } catch (err) {
    console.error('Groups history error:', err);
    res.status(500).json({ error: 'Failed to load group history. Internal server error.' });
  }
});

// Real-Time Group Creation Stream via Server-Sent Events (SSE)
app.get('/api/whatsapp/stream-create', async (req, res) => {
  // Prevent Node.js socket timeout for long-running group creations
  req.setTimeout(0);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  const sendEvent = (event, data) => {
    if (!res.writableEnded && !res.destroyed) {
      try {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      } catch (e) {
        console.warn('[SSE] Write error (safely handled):', e.message);
      }
    }
  };

  // Heartbeat to prevent reverse proxy (Nginx, Render, Cloudflare, etc.) idle timeouts
  const heartbeatInterval = setInterval(() => {
    if (!res.writableEnded && !res.destroyed) {
      // Send an SSE comment. Clients ignore this, but it keeps the TCP connection active.
      res.write(': keepalive\n\n');
    } else {
      clearInterval(heartbeatInterval);
    }
  }, 25000); // 25 seconds

  let clientClosed = false;
  req.on('close', () => {
    clientClosed = true;
    clearInterval(heartbeatInterval);
    console.log('[SSE] Client disconnected, but group creation will continue safely in the background.');
  });

  const token = req.query.token;
  if (!token) {
    sendEvent('error', { error: 'AUTH_REQUIRED', message: 'Auth token query parameter required' });
    return res.end();
  }

  let user;
  let sessionId;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    sessionId = decoded.sessionId;
    const dbUser = db.findUserById(decoded.id);
    if (!dbUser || !dbUser.isActive) {
      sendEvent('error', { error: 'ACCOUNT_SUSPENDED', message: 'Account suspended or not found' });
      return res.end();
    }
    if (dbUser.currentSessionId !== decoded.sessionId) {
      sendEvent('error', { error: 'SESSION_TERMINATED', message: 'Your account was logged in on another device. You have been signed out.' });
      return res.end();
    }
    user = dbUser;
  } catch (err) {
    sendEvent('error', { error: 'INVALID_TOKEN', message: 'Invalid or expired auth token' });
    return res.end();
  }

  const { baseName, quantity, targetNumber, delaySeconds, senderNumber, senderNumbers, creationType } = req.query;
  
  let parsedSenderNumbers = [];
  try {
    if (senderNumbers) {
      parsedSenderNumbers = JSON.parse(senderNumbers);
    } else if (senderNumber) {
      parsedSenderNumbers = [senderNumber];
    }
  } catch (e) {
    sendEvent('error', { error: 'VALIDATION_ERROR', message: 'Invalid senderNumbers format.' });
    return res.end();
  }

  if (!baseName || !targetNumber || parsedSenderNumbers.length === 0) {
    sendEvent('error', { error: 'VALIDATION_ERROR', message: 'baseName, targetNumber, and at least one senderNumber are required' });
    return res.end();
  }
  if (typeof targetNumber !== 'string' || targetNumber.length > 30) {
    sendEvent('error', { error: 'VALIDATION_ERROR', message: 'Target phone number is invalid or too long.' });
    return res.end();
  }

  sendEvent('start', {
    message: `Starting creation of ${quantity || 1} group(s)...`,
    baseName: (baseName || '').trim().substring(0, 75),
    quantity: parseInt(quantity, 10) || 1,
    targetNumber
  });

  try {
    const results = await whatsappManager.createGroupsBatch(user.id, {
      baseName,
      quantity,
      targetNumber,
      delaySeconds: parseInt(delaySeconds, 10) || 12,
      senderNumbers: parsedSenderNumbers,
      creationType,
      expectedSessionId: sessionId,
      onProgress: (progressData) => {
        if (!clientClosed) {
          sendEvent('progress', progressData);
        }
      },
      checkClientClosed: () => clientClosed
    });

    sendEvent('complete', {
      message: 'Group creation process completed successfully!',
      results
    });
  } catch (err) {
    console.error('Error during group creation stream:', err.message);
    sendEvent('error', {
      error: err.message.includes('another device') ? 'SESSION_TERMINATED' : 'CREATION_ERROR',
      // Ensure we don't leak backend paths by checking if the error looks like a system error
      message: err.message.includes('/') || err.message.includes('\\') ? 'An internal system error occurred.' : (err.message || 'Error occurred while creating groups')
    });
  } finally {
    clearInterval(heartbeatInterval);
    if (!res.writableEnded && !res.destroyed) {
      res.end();
    }
  }
});

// Serve static client files for production (Render)
app.use(express.static(path.join(__dirname, '../../client/dist')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
});

// Global API error handler (e.g. for malformed JSON payload)
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON payload format' });
  }
  console.error('[Global Error]', err);
  res.status(500).json({ error: 'Internal server error occurred.' });
});

async function startServer() {
  try {
    await initDb();
    console.log('[DB] Database initialized successfully.');

    app.listen(PORT, () => {
      console.log(`=========================================`);
      console.log(`🚀 GC Agent Backend running on port ${PORT}`);
      console.log(`🛡️ Admin Panel & Single-Device Guard Active`);
      console.log(`=========================================`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
