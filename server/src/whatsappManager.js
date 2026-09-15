import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
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

// Map<userId, Map<phoneNumber, sessionData>>
const activeSessions = new Map();

function getUserSessionsMap(userId) {
  if (!activeSessions.has(userId)) {
    activeSessions.set(userId, new Map());
  }
  return activeSessions.get(userId);
}

function getSessionDir(userId, phoneNumber) {
  const dir = path.join(SESSIONS_DIR, `user_${userId}_${phoneNumber}`);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function normalizePhoneNumber(raw) {
  if (!raw) return '';
  let cleaned = raw.toString().replace(/[^0-9]/g, '');
  if (cleaned.startsWith('00')) cleaned = cleaned.substring(2);
  if (cleaned.startsWith('03') && cleaned.length === 11) cleaned = '92' + cleaned.substring(1);
  if (cleaned.startsWith('3') && cleaned.length === 10) cleaned = '92' + cleaned;
  if (cleaned.startsWith('920') && cleaned.length === 13) cleaned = '92' + cleaned.substring(3);
  if (cleaned.startsWith('07') && cleaned.length === 11) cleaned = '44' + cleaned.substring(1);
  if (cleaned.startsWith('440') && cleaned.length === 13) cleaned = '44' + cleaned.substring(3);
  if (cleaned.startsWith('0') && cleaned.length === 11) cleaned = cleaned.substring(1);
  return cleaned;
}

// Global Idle Sweeper (Saves RAM on massive servers)
setInterval(() => {
  const now = Date.now();
  for (const [userId, userSessions] of activeSessions.entries()) {
    for (const [phone, session] of userSessions.entries()) {
      if (session.sock && session.isConnected && !session.currentJob) {
        if (now - session.lastActivity > 30 * 60 * 1000) { // 30 mins
          console.log(`[WhatsApp] Idling session for ${userId}:${phone} to conserve RAM.`);
          try {
            session.sock.ev.removeAllListeners('connection.update');
            session.sock.end();
          } catch(e) {}
          session.sock = null;
          session.isConnected = false;
          session.status = 'sleeping';
        }
      }
    }
  }
}, 5 * 60 * 1000);

export const whatsappManager = {
  getStatus(userId) {
    const userSessions = getUserSessionsMap(userId);
    const statuses = [];

    // Check disk for inactive/sleeping sessions that haven't been loaded into memory yet
    if (fs.existsSync(SESSIONS_DIR)) {
      const entries = fs.readdirSync(SESSIONS_DIR);
      for (const entry of entries) {
        const match = entry.match(/^user_(.+)_(.+)$/);
        if (match && match[1] === userId) {
          const phoneNumber = match[2];
          
          // Ignore corrupted folders from previous bugs (e.g. user_..._undefined)
          if (!phoneNumber || phoneNumber === 'undefined' || phoneNumber.length < 5) {
            continue;
          }

          if (!userSessions.has(phoneNumber)) {
            const credsPath = path.join(SESSIONS_DIR, entry, 'creds.json');
            if (fs.existsSync(credsPath)) {
              try {
                const creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
                if (creds.registered) {
                  // We don't initialize the socket to save RAM. Just mark it as sleeping.
                  userSessions.set(phoneNumber, {
                    sock: null,
                    isConnected: false,
                    status: 'sleeping',
                    phoneNumber,
                    pairingCode: null,
                    currentJob: null,
                    lastActivity: Date.now()
                  });
                }
              } catch (e) {}
            }
          }
        }
      }
    }

    // Add in-memory sessions
    for (const [phone, session] of userSessions.entries()) {
      if (!statuses.find(s => s.phoneNumber === phone)) {
        // Pretend sleeping sessions are connected so the frontend UI looks normal
        const isActuallyConnected = session.status === 'sleeping' ? true : (session.isConnected || false);
        const displayStatus = session.status === 'sleeping' ? 'connected' : (session.status || 'disconnected');
        
        statuses.push({
          isConnected: isActuallyConnected,
          status: displayStatus,
          phoneNumber: session.phoneNumber || phone,
          pairingCode: session.pairingCode || null,
          currentJob: session.currentJob || null
        });
      }
    }

    return statuses;
  },

  async initUserSession(userId, phoneNumber, isReconnect = false) {
    const sessionDir = getSessionDir(userId, phoneNumber);
    const credsPath = path.join(sessionDir, 'creds.json');
    if (!fs.existsSync(credsPath) && !isReconnect) {
      return null;
    }

    const userSessions = getUserSessionsMap(userId);
    let sessionData = userSessions.get(phoneNumber);
    
    if (sessionData?.sock) {
      try {
        sessionData.sock.ev.removeAllListeners('connection.update');
        sessionData.sock.end();
      } catch (e) {}
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();
    const logger = pino({ level: 'silent' });

    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        // Cacheable store prevents massive CPU spikes on auth
        keys: makeCacheableSignalKeyStore(state.keys, logger)
      },
      printQRInTerminal: false,
      logger,
      browser: ['Ubuntu', 'Chrome', '20.0.04'],
      markOnlineOnConnect: true,
      syncFullHistory: false,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 25000
    });

    if (!sessionData) {
      sessionData = {
        sock,
        isConnected: false,
        status: 'connecting',
        phoneNumber,
        pairingCode: null,
        currentJob: null,
        lastActivity: Date.now()
      };
      userSessions.set(phoneNumber, sessionData);
    } else {
      sessionData.sock = sock;
      sessionData.status = 'connecting';
      sessionData.lastActivity = Date.now();
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === 'open') {
        sessionData.isConnected = true;
        sessionData.status = 'connected';
        sessionData.pairingCode = null;
        if (sock.user?.id) {
          sessionData.phoneNumber = sock.user.id.split(':')[0].split('@')[0];
        }
      } else if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        
        if (userSessions.get(phoneNumber) !== sessionData) return;

        sessionData.isConnected = false;

        if (shouldReconnect) {
          // If we intentionally put it to sleep, don't auto-reconnect
          if (sessionData.status !== 'sleeping') {
            sessionData.status = 'reconnecting';
            setTimeout(() => {
              whatsappManager.initUserSession(userId, phoneNumber, true).catch(() => {});
            }, 2500);
          }
        } else {
          sessionData.status = 'unlinked';
          sessionData.pairingCode = null;
          userSessions.delete(phoneNumber);
          if (fs.existsSync(sessionDir)) {
            try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (err) {}
          }
        }
      }
    });

    return sessionData;
  },

  async requestPairingCode(userId, rawPhoneNumber, force = false) {
    const cleanNumber = normalizePhoneNumber(rawPhoneNumber);
    if (!cleanNumber || cleanNumber.length < 9) {
      throw new Error(`Invalid phone number "${rawPhoneNumber}". Please include your country code.`);
    }

    const userSessions = getUserSessionsMap(userId);
    
    if (userSessions.size >= 10 && !userSessions.has(cleanNumber)) {
      throw new Error('Maximum limit of 10 linked devices reached. Please unlink a device first.');
    }

    const existing = userSessions.get(cleanNumber);
    if (existing?.sock) {
      try {
        existing.sock.ev.removeAllListeners('connection.update');
        existing.sock.end();
      } catch (e) {}
      userSessions.delete(cleanNumber);
    }

    const sessionDir = getSessionDir(userId, cleanNumber);

    const credsPath = path.join(sessionDir, 'creds.json');
    if (fs.existsSync(credsPath)) {
      try {
        const existingCreds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
        if (force || !existingCreds.registered) {
          try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (e) {}
          if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
        }
      } catch (e) {
        try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (e) {}
        if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
      }
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();
    const logger = pino({ level: 'silent' });

    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger)
      },
      printQRInTerminal: false,
      logger,
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
      currentJob: null,
      lastActivity: Date.now()
    };
    userSessions.set(cleanNumber, sessionData);

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === 'open') {
        sessionData.isConnected = true;
        sessionData.status = 'connected';
        sessionData.pairingCode = null;
        if (sock.user?.id) {
          sessionData.phoneNumber = sock.user.id.split(':')[0].split('@')[0];
        }
      } else if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        
        if (userSessions.get(cleanNumber) !== sessionData) return;

        sessionData.isConnected = false;

        if (shouldReconnect) {
          if (sessionData.status !== 'sleeping') {
             sessionData.status = 'reconnecting';
             setTimeout(() => {
               whatsappManager.initUserSession(userId, cleanNumber, true).catch(() => {});
             }, 2000);
          }
        } else {
          sessionData.status = 'unlinked';
          sessionData.pairingCode = null;
          userSessions.delete(cleanNumber);
          if (fs.existsSync(sessionDir)) {
            try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (e) {}
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
      throw new Error('WhatsApp connection timed out. Please check your internet connection.');
    }
    await delay(1200);

    if (!sock.authState.creds.registered) {
      const code = await sock.requestPairingCode(cleanNumber);
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

  async logout(userId, phoneNumber) {
    const userSessions = getUserSessionsMap(userId);
    if (!phoneNumber) {
       for (const [phone, session] of userSessions.entries()) {
           if (session?.sock) {
             try {
               session.sock.ev.removeAllListeners('connection.update');
               await session.sock.logout();
             } catch (err) {}
             try { session.sock.end(); } catch (err) {}
           }
           const sessionDir = getSessionDir(userId, phone);
           if (fs.existsSync(sessionDir)) {
             try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (err) {}
           }
       }
       userSessions.clear();
    } else {
       const session = userSessions.get(phoneNumber);
       if (session?.sock) {
         try {
           session.sock.ev.removeAllListeners('connection.update');
           await session.sock.logout();
         } catch (err) {}
         try { session.sock.end(); } catch (err) {}
       }
       userSessions.delete(phoneNumber);
       const sessionDir = getSessionDir(userId, phoneNumber);
       if (fs.existsSync(sessionDir)) {
         try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (err) {}
       }
    }
    return { success: true };
  },

  async createGroupsBatch(userId, { baseName, quantity, targetNumber, delaySeconds = 12, senderNumber, creationType = 'group', expectedSessionId, onProgress, checkClientClosed }) {
    const userSessions = getUserSessionsMap(userId);
    const cleanSender = normalizePhoneNumber(senderNumber);
    let session = userSessions.get(cleanSender);
    
    // Auto-wake sleeping sessions or wait for connecting sessions
    if (!session || (!session.isConnected && session.status === 'sleeping')) {
      session = await whatsappManager.initUserSession(userId, cleanSender, false);
    }
    if (!session) {
      console.error(`[WhatsApp] Failed to find linked device. userId: ${userId}, passed sender: ${senderNumber}, cleanSender: ${cleanSender}`);
      throw new Error(`WhatsApp device ${cleanSender} is not linked to your account. Try refreshing the page or re-linking your device.`);
    }
    
    if (!session.isConnected) {
      for (let w = 0; w < 15; w++) {
        if (session.isConnected) break;
        await delay(1000);
      }
    }
    if (!session.isConnected) throw new Error('WhatsApp connection is not ready or taking too long.');

    session.lastActivity = Date.now(); // Reset idle timer

    if (session.currentJob && session.currentJob.status === 'in_progress') {
      throw new Error('A creation job is already running on this device.');
    }

    const cleanTargetNumber = normalizePhoneNumber(targetNumber);
    if (!cleanTargetNumber || cleanTargetNumber.length < 9) {
      throw new Error(`Target participant number "${targetNumber}" is invalid.`);
    }

    const participantJid = `${cleanTargetNumber}@s.whatsapp.net`;
    const numGroups = Math.max(1, Math.min(50, parseInt(quantity, 10) || 1));
    const safeDelay = Math.max(1, parseInt(delaySeconds, 10) || 1);
    const sanitizedBase = (baseName || 'Group').trim().substring(0, 75);

    session.currentJob = { total: numGroups, current: 0, status: 'in_progress' };
    const results = [];

    try {
      for (let i = 1; i <= numGroups; i++) {
        session.lastActivity = Date.now(); // Keep awake during job
        
        if (session.currentJob?.status === 'cancelled') {
           console.log(`[WhatsApp] Creation stopped by the user.`);
           break;
        }

        const currentUser = db.findUserById(userId);
        if (!currentUser || !currentUser.isActive) throw new Error('User account was suspended.');
        if (expectedSessionId && currentUser.currentSessionId !== expectedSessionId) {
          throw new Error('Account logged in on another device.');
        }

        if (!session.isConnected || !session.sock?.ws?.isOpen) {
          for (let waitSec = 0; waitSec < 8; waitSec++) {
            await delay(1000);
            // FIX: Use cleanSender instead of the raw senderNumber when fetching the session map
            session = userSessions.get(cleanSender) || session;
            if (session.isConnected && session.sock?.ws?.isOpen) break;
          }
        }
        if (!session.isConnected || !session.sock?.ws?.isOpen) {
          if (onProgress) onProgress({ step: 'failed', current: i, total: numGroups, message: 'WhatsApp disconnected mid-batch. Cancelling remaining groups.' });
          break;
        }

        const title = numGroups === 1 ? sanitizedBase : `${sanitizedBase} #${i}`;
        const isCommunity = creationType === 'community';

        if (onProgress) {
          onProgress({
            step: 'creating',
            current: i,
            total: numGroups,
            groupTitle: title,
            message: `Creating ${isCommunity ? 'community' : 'group'} "${title}" (Adding +${cleanTargetNumber})...`
          });
        }

        let createdEntity = null;
        let inviteLink = null;
        let errorMsg = null;

        let shouldBreakLoop = false;
        try {
          // Send a human-like presence update to tell WhatsApp the user is "active"
          try {
            await session.sock.sendPresenceUpdate('available');
            await delay(Math.floor(Math.random() * 1000) + 500); // Random 0.5s - 1.5s human hesitation
          } catch(e) {}

          if (isCommunity) {
             for (let retry = 1; retry <= 3; retry++) {
               try {
                 createdEntity = await session.sock.communityCreate(title, '');
                 break;
               } catch (createErr) {
                 const errMsg = createErr.message?.toLowerCase() || '';
                 if (retry === 3 || errMsg.includes('rate-overlimit') || errMsg.includes('429') || errMsg.includes('not-authorized')) throw createErr;
                 console.warn(`[WhatsApp] Community create retry ${retry}:`, createErr.message);
                 await delay(3500 * retry);
               }
             }
             
             if (createdEntity?.id) {
               await delay(2000);
               try {
                 const code = await session.sock.communityInviteCode(createdEntity.id);
                 if (code) inviteLink = `https://chat.whatsapp.com/${code}`;
               } catch(codeErr) {}
             }
          } else {
             for (let retry = 1; retry <= 3; retry++) {
               try {
                 createdEntity = await session.sock.groupCreate(title, [participantJid]);
                 break;
               } catch (createErr) {
                 const errMsg = createErr.message?.toLowerCase() || '';
                 if (retry === 3 || errMsg.includes('rate-overlimit') || errMsg.includes('429') || errMsg.includes('not-authorized')) throw createErr;
                 console.warn(`[WhatsApp] Group create retry ${retry}:`, createErr.message);
                 await delay(3500 * retry);
               }
             }

             if (createdEntity?.id) {
               for (let attempt = 1; attempt <= 3; attempt++) {
                 try {
                   await delay(600 * attempt);
                   const code = await session.sock.groupInviteCode(createdEntity.id);
                   if (code) { inviteLink = `https://chat.whatsapp.com/${code}`; break; }
                 } catch (codeErr) {}
               }
             }
          }
        } catch (err) {
          console.error(`Error creating ${title}:`, err);
          errorMsg = err.message || 'Creation failed';
          if (errorMsg.toLowerCase().includes('rate-overlimit') || errorMsg.toLowerCase().includes('resource-limit') || errorMsg.includes('429')) {
            errorMsg = `WhatsApp Rate Limit: ${errorMsg}. Pausing to protect account.`;
          }
          shouldBreakLoop = true;
        }

        const record = db.saveGroupRecord({
          userId,
          groupName: title + (isCommunity ? ' (Community)' : ''),
          groupId: createdEntity?.id || null,
          inviteLink,
          targetNumber: cleanTargetNumber,
          status: createdEntity ? 'created' : 'failed',
          error: errorMsg,
          senderNumber: cleanSender
        });
        results.push(record);

        if (onProgress) {
          onProgress({
            step: createdEntity ? 'success' : 'failed',
            current: i,
            total: numGroups,
            groupTitle: title,
            inviteLink,
            error: errorMsg,
            record,
            message: createdEntity ? `Successfully created "${title}"!` : `Failed: ${errorMsg}`
          });
        }

        if (shouldBreakLoop) {
           break; // Stop processing further groups if we hit a rate limit or unrecoverable error
        }

        if (i < numGroups) {
          // Add a randomized "Jitter" to the cooldown. Bots use exact delays, humans are random.
          const randomJitterMs = Math.floor(Math.random() * 4000); // Up to 4 seconds of randomness
          const totalWaitMs = (safeDelay * 1000) + randomJitterMs;
          const displaySeconds = Math.ceil(totalWaitMs / 1000);

          if (onProgress) {
            onProgress({
              step: 'cooldown',
              current: i,
              total: numGroups,
              cooldownSeconds: displaySeconds,
              message: `Waiting ${displaySeconds}s cooldown to prevent detection/bans...`
            });
          }
          
          const loops = Math.ceil(totalWaitMs / 100);
          for (let wait = 0; wait < loops; wait++) {
            if (session.currentJob?.status === 'cancelled') {
              shouldBreakLoop = true;
              break;
            }
            await delay(100);
          }
          if (shouldBreakLoop) break;
        }
      }
    } finally {
      session.currentJob = null;
    }
    return results;
  },

  cancelJob(userId, senderNumber) {
    const userSessions = getUserSessionsMap(userId);
    let stopped = false;
    for (const [phone, session] of userSessions.entries()) {
      if ((!senderNumber || phone === senderNumber) && session.currentJob && session.currentJob.status === 'in_progress') {
        session.currentJob.status = 'cancelled';
        stopped = true;
      }
    }
    return stopped;
  }
};
