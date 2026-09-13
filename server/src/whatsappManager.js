import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
  delay
} from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SESSIONS_DIR = path.join(__dirname, '..', 'data', 'sessions');

if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

// In-memory active sessions per userId
const activeSessions = new Map();

function getSessionDir(userId) {
  const dir = path.join(SESSIONS_DIR, `user_${userId}`);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Smart phone number normalizer for international format
 * Fixes common user mistakes like missing country codes or accidental domestic '0'
 */
export function normalizePhoneNumber(raw) {
  if (!raw) return '';
  let cleaned = raw.toString().replace(/[^0-9]/g, '');

  // Strip international prefix '00'
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  }

  // Pakistan local format: e.g. 03256540880 (11 digits) -> 923256540880
  if (cleaned.startsWith('03') && cleaned.length === 11) {
    cleaned = '92' + cleaned.substring(1);
  }

  // Pakistan local format without leading 0: e.g. 3256540880 (10 digits starting with 3) -> 923256540880
  if (cleaned.startsWith('3') && cleaned.length === 10) {
    cleaned = '92' + cleaned;
  }

  // Common Pakistani mistake: 9203256540880 (13 digits) -> 923256540880
  if (cleaned.startsWith('920') && cleaned.length === 13) {
    cleaned = '92' + cleaned.substring(3);
  }

  // UK local format: e.g. 07xxxxxxxxx (11 digits) -> 447xxxxxxxxx
  if (cleaned.startsWith('07') && cleaned.length === 11) {
    cleaned = '44' + cleaned.substring(1);
  }

  // UK mistake: 4407xxxxxxxxx (13 digits) -> 447xxxxxxxxx
  if (cleaned.startsWith('440') && cleaned.length === 13) {
    cleaned = '44' + cleaned.substring(3);
  }

  // India local format: e.g. 09xxxxxxxxx -> 919xxxxxxxxx
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = cleaned.substring(1);
  }

  return cleaned;
}

export const whatsappManager = {
  getSession(userId) {
    return activeSessions.get(userId);
  },

  getStatus(userId) {
    const session = activeSessions.get(userId);
    if (!session) {
      const sessionDir = path.join(SESSIONS_DIR, `user_${userId}`);
      const credsPath = path.join(sessionDir, 'creds.json');
      if (fs.existsSync(credsPath)) {
        try {
          const creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
          if (creds.registered) {
            const savedPhone = creds.me?.id ? creds.me.id.split(':')[0].split('@')[0] : null;
            // Automatically wake up and connect the session in the background
            whatsappManager.initUserSession(userId).catch(console.error);
            return {
              isConnected: false,
              status: 'connecting',
              phoneNumber: savedPhone,
              pairingCode: null
            };
          }
        } catch (e) {}
      }

      return {
        isConnected: false,
        status: 'unlinked',
        phoneNumber: null,
        pairingCode: null
      };
    }

    return {
      isConnected: session.isConnected || false,
      status: session.status || 'disconnected',
      phoneNumber: session.phoneNumber || null,
      pairingCode: session.pairingCode || null,
      currentJob: session.currentJob || null
    };
  },

  // Wake up all registered sessions on server startup
  async restoreAllSessions() {
    if (!fs.existsSync(SESSIONS_DIR)) return;
    const entries = fs.readdirSync(SESSIONS_DIR);
    for (const entry of entries) {
      if (entry.startsWith('user_')) {
        const userId = entry.replace('user_', '');
        const credsPath = path.join(SESSIONS_DIR, entry, 'creds.json');
        if (fs.existsSync(credsPath)) {
          try {
            const creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
            if (creds.registered) {
              console.log(`[WhatsApp] Auto-restoring registered companion session for user: ${userId}`);
              whatsappManager.initUserSession(userId).catch((err) => {
                console.warn(`[WhatsApp] Failed to restore session for ${userId}:`, err.message);
              });
            }
          } catch (e) {}
        }
      }
    }
  },

  async initUserSession(userId, isReconnect = false) {
    const sessionDir = getSessionDir(userId);
    const credsPath = path.join(sessionDir, 'creds.json');
    if (!fs.existsSync(credsPath) && !isReconnect) {
      return null;
    }

    const existing = activeSessions.get(userId);
    if (existing?.sock) {
      try {
        existing.sock.ev.removeAllListeners('connection.update');
        existing.sock.end();
      } catch (e) {}
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      browser: ['Ubuntu', 'Chrome', '20.0.04'],
      markOnlineOnConnect: true,
      syncFullHistory: false,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 25000
    });

    let sessionData = activeSessions.get(userId);
    if (!sessionData) {
      sessionData = {
        sock,
        isConnected: false,
        status: 'connecting',
        phoneNumber: null,
        pairingCode: null,
        currentJob: null
      };
      activeSessions.set(userId, sessionData);
    } else {
      sessionData.sock = sock;
      sessionData.status = 'connecting';
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === 'open') {
        // console.log(`[WhatsApp] User ${userId} connected successfully!`);
        sessionData.isConnected = true;
        sessionData.status = 'connected';
        sessionData.pairingCode = null;
        if (sock.user?.id) {
          sessionData.phoneNumber = sock.user.id.split(':')[0].split('@')[0];
        }
      } else if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        
        // Prevent old terminated sockets from interfering with new active sessions
        if (activeSessions.get(userId) !== sessionData) {
          // console.log(`[WhatsApp] Old connection closed for user ${userId}. Ignoring.`);
          return;
        }

        // console.log(`[WhatsApp] Connection closed for user ${userId}. Code: ${statusCode}, shouldReconnect: ${shouldReconnect}`);

        sessionData.isConnected = false;

        if (shouldReconnect) {
          sessionData.status = 'reconnecting';
          setTimeout(() => {
            whatsappManager.initUserSession(userId, true).catch((err) => {
              // Ignore reconnect errors silently
            });
          }, 2500);
        } else {
          // console.log(`[WhatsApp] User ${userId} logged out or session invalidated.`);
          sessionData.status = 'unlinked';
          sessionData.pairingCode = null;
          activeSessions.delete(userId);
          if (fs.existsSync(sessionDir)) {
            try {
              fs.rmSync(sessionDir, { recursive: true, force: true });
            } catch (err) {
              console.error(`[WhatsApp] Failed to remove session dir:`, err.message);
            }
          }
        }
      }
    });

    return sessionData;
  },

  async requestPairingCode(userId, rawPhoneNumber, force = false) {
    const cleanNumber = normalizePhoneNumber(rawPhoneNumber);
    if (!cleanNumber || cleanNumber.length < 9) {
      throw new Error(`Invalid phone number "${rawPhoneNumber}". Please include your country code (e.g. 923256540880 or 14155552671).`);
    }

    // console.log(`[WhatsApp] Requesting Pairing Code for user ${userId}, normalized number: +${cleanNumber}, force: ${force}`);

    const existing = activeSessions.get(userId);
    if (existing?.sock) {
      try {
        // Remove listeners so the close event doesn't trigger old handlers
        existing.sock.ev.removeAllListeners('connection.update');
        existing.sock.end();
      } catch (e) {}
      activeSessions.delete(userId);
    }

    const sessionDir = getSessionDir(userId);

    const credsPath = path.join(sessionDir, 'creds.json');
    if (fs.existsSync(credsPath)) {
      try {
        const existingCreds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
        if (force || !existingCreds.registered) {
          // console.log(`[WhatsApp] Purging stale session keys in ${sessionDir}`);
          try {
            fs.rmSync(sessionDir, { recursive: true, force: true });
          } catch (rmErr) {
            console.error(`[WhatsApp] Failed to remove session dir:`, rmErr.message);
          }
          if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
          }
        }
      } catch (e) {
        try {
          fs.rmSync(sessionDir, { recursive: true, force: true });
        } catch (rmErr) {
          console.error(`[WhatsApp] Failed to remove session dir:`, rmErr.message);
        }
        if (!fs.existsSync(sessionDir)) {
          fs.mkdirSync(sessionDir, { recursive: true });
        }
      }
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      browser: ['Ubuntu', 'Chrome', '20.0.04'],
      markOnlineOnConnect: true,
      syncFullHistory: false,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 25000
    });

    const sessionData = {
      sock,
      isConnected: false,
      status: 'requesting_code',
      phoneNumber: cleanNumber,
      pairingCode: null,
      currentJob: null
    };
    activeSessions.set(userId, sessionData);

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === 'open') {
        // console.log(`[WhatsApp] User ${userId} successfully linked & connected!`);
        sessionData.isConnected = true;
        sessionData.status = 'connected';
        sessionData.pairingCode = null;
        if (sock.user?.id) {
          sessionData.phoneNumber = sock.user.id.split(':')[0].split('@')[0];
        }
      } else if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        
        // Prevent old terminated sockets from interfering with new active sessions
        if (activeSessions.get(userId) !== sessionData) {
          // console.log(`[WhatsApp] Old pairing session closed for user ${userId}. Ignoring.`);
          return;
        }

        // console.log(`[WhatsApp] Pairing session closed for user ${userId}. Code: ${statusCode}, shouldReconnect: ${shouldReconnect}`);

        sessionData.isConnected = false;

        if (shouldReconnect) {
          sessionData.status = 'reconnecting';
          setTimeout(() => {
            whatsappManager.initUserSession(userId, true).catch(console.error);
          }, 2000);
        } else {
          sessionData.status = 'unlinked';
          sessionData.pairingCode = null;
          activeSessions.delete(userId);
          if (fs.existsSync(sessionDir)) {
            try {
              fs.rmSync(sessionDir, { recursive: true, force: true });
            } catch (err) {
              console.error(`[WhatsApp] Failed to remove session dir:`, err.message);
            }
          }
        }
      }
    });

    let attempts = 0;
    while (!sock.ws?.isOpen && attempts < 40) {
      await delay(300);
      attempts++;
    }

    if (!sock.ws?.isOpen) {
      throw new Error('WhatsApp connection timed out while establishing socket. Please check your internet connection and try again.');
    }
    await delay(1200);

    if (!sock.authState.creds.registered) {
      // console.log(`[WhatsApp] Calling sock.requestPairingCode(${cleanNumber})...`);
      const code = await sock.requestPairingCode(cleanNumber);
      // console.log(`[WhatsApp] Pairing code generated successfully: ${code}`);

      const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;
      sessionData.pairingCode = formattedCode;
      sessionData.status = 'pairing_ready';
      return { pairingCode: formattedCode, status: 'pairing_ready', normalizedNumber: cleanNumber };
    } else {
      sessionData.status = 'connected';
      sessionData.isConnected = true;
      return { status: 'already_registered' };
    }
  },

  async logout(userId) {
    const session = activeSessions.get(userId);
    if (session?.sock) {
      try {
        session.sock.ev.removeAllListeners('connection.update');
        await session.sock.logout();
      } catch (err) {}
      session.sock.end();
    }
    activeSessions.delete(userId);
    const sessionDir = getSessionDir(userId);
    if (fs.existsSync(sessionDir)) {
      try {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      } catch (err) {
        console.error(`[WhatsApp] Failed to remove session dir during logout:`, err.message);
      }
    }
    return { success: true };
  },

  async createGroupsBatch(userId, { baseName, quantity, targetNumber, delaySeconds = 12, expectedSessionId, onProgress }) {
    let session = activeSessions.get(userId);
    if (!session || !session.isConnected) {
      session = await whatsappManager.initUserSession(userId, false);
      if (!session) {
        throw new Error('WhatsApp device is not linked. Please link your phone number first.');
      }
      for (let w = 0; w < 10; w++) {
        if (session.isConnected) break;
        await delay(1000);
      }
      if (!session.isConnected) {
        throw new Error('WhatsApp connection is not ready. Please verify linked device status.');
      }
    }

    // CONCURRENCY GUARD: Prevent multiple batch jobs from running concurrently on the same session
    if (session.currentJob && session.currentJob.status === 'in_progress') {
      throw new Error('A group creation job is already running for your account. Please wait for it to finish.');
    }

    const cleanTargetNumber = normalizePhoneNumber(targetNumber);
    if (!cleanTargetNumber || cleanTargetNumber.length < 9) {
      throw new Error(`Target participant number "${targetNumber}" is invalid. Include country code.`);
    }

    const participantJid = `${cleanTargetNumber}@s.whatsapp.net`;
    const numGroups = Math.max(1, Math.min(50, parseInt(quantity, 10) || 1));
    const safeDelay = Math.max(5, Math.min(60, parseInt(delaySeconds, 10) || 12));
    const sanitizedBase = (baseName || 'Group').trim().substring(0, 75);

    session.currentJob = {
      total: numGroups,
      current: 0,
      status: 'in_progress'
    };

    const results = [];

    try {
      for (let i = 1; i <= numGroups; i++) {
        // SECURITY CHECK: Verify user account has not been deactivated or logged in on another device during batch
        const currentUser = db.findUserById(userId);
        if (!currentUser || !currentUser.isActive) {
          throw new Error('Group creation aborted: User account was suspended or deleted.');
        }
        if (expectedSessionId && currentUser.currentSessionId && currentUser.currentSessionId !== expectedSessionId) {
          throw new Error('Group creation aborted: Account was logged in on another device.');
        }

        // CONNECTION RESILIENCE CHECK: Wait up to 8s if socket is temporarily reconnecting
        if (!session.isConnected || !session.sock?.ws?.isOpen) {
          for (let waitSec = 0; waitSec < 8; waitSec++) {
            await delay(1000);
            session = activeSessions.get(userId) || session;
            if (session.isConnected && session.sock?.ws?.isOpen) {
              // console.log(`[Group Agent] WhatsApp connection auto-recovered during batch.`);
              break;
            }
          }
        }

        if (!session.isConnected || !session.sock?.ws?.isOpen) {
          throw new Error('WhatsApp connection disconnected. Please check your phone internet and reconnect.');
        }

        const groupTitle = numGroups === 1 ? sanitizedBase : `${sanitizedBase} #${i}`;

        if (onProgress) {
          onProgress({
            step: 'creating',
            current: i,
            total: numGroups,
            groupTitle,
            message: `Creating group "${groupTitle}" (Adding +${cleanTargetNumber})...`
          });
        }

        let createdGroup = null;
        let inviteLink = null;
        let errorMsg = null;

        try {
          createdGroup = await session.sock.groupCreate(groupTitle, [participantJid]);
          // console.log(`[Group] Created ${groupTitle} with ID: ${createdGroup?.id}`);

          // RETRY LOOP FOR GROUP INVITE CODE
          // Allows 3 attempts with brief backoff for group admin privileges to settle
          if (createdGroup?.id) {
            for (let attempt = 1; attempt <= 3; attempt++) {
              try {
                await delay(600 * attempt);
                const code = await session.sock.groupInviteCode(createdGroup.id);
                if (code) {
                  inviteLink = `https://chat.whatsapp.com/${code}`;
                  break;
                }
              } catch (codeErr) {
                if (attempt === 3) {
                  console.warn(`Could not extract invite link for ${groupTitle} after 3 attempts:`, codeErr.message);
                }
              }
            }
          }
        } catch (err) {
          console.error(`Error creating group ${groupTitle}:`, err);
          errorMsg = err.message || 'Creation failed';

          // Critical spam / limit detection
          if (errorMsg.toLowerCase().includes('rate-overlimit') || errorMsg.toLowerCase().includes('resource-limit')) {
            throw new Error(`WhatsApp Rate Limit encountered: ${errorMsg}. Pausing to protect account.`);
          }
        }

        const groupRecord = db.saveGroupRecord({
          userId,
          groupName: groupTitle,
          groupId: createdGroup?.id || null,
          inviteLink,
          targetNumber: cleanTargetNumber,
          status: createdGroup ? 'created' : 'failed',
          error: errorMsg
        });

        results.push(groupRecord);

        if (onProgress) {
          onProgress({
            step: createdGroup ? 'success' : 'failed',
            current: i,
            total: numGroups,
            groupTitle,
            inviteLink,
            error: errorMsg,
            record: groupRecord,
            message: createdGroup
              ? `Successfully created "${groupTitle}"!`
              : `Failed to create "${groupTitle}": ${errorMsg}`
          });
        }

        // Interval cooldown
        if (i < numGroups) {
          if (onProgress) {
            onProgress({
              step: 'cooldown',
              current: i,
              total: numGroups,
              cooldownSeconds: safeDelay,
              message: `Waiting ${safeDelay}s cooldown to prevent detection/bans...`
            });
          }
          await delay(safeDelay * 1000);
        }
      }
    } finally {
      session.currentJob = null;
    }

    return results;
  }
};
