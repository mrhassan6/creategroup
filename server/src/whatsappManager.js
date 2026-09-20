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

  async createGroupsBatch(userId, { baseName, quantity, targetNumber, delaySeconds = 12, senderNumber, senderNumbers = [], creationType = 'group', expectedSessionId, onProgress, checkClientClosed }) {
    const userSessions = getUserSessionsMap(userId);
    
    // Support backward compatibility if only `senderNumber` string is passed
    let rawSenders = Array.isArray(senderNumbers) && senderNumbers.length > 0 
      ? senderNumbers 
      : (senderNumber ? [senderNumber] : []);
      
    if (rawSenders.length === 0) {
      throw new Error('No sender devices provided.');
    }

    const cleanSenders = rawSenders.map(normalizePhoneNumber).filter(n => n.length >= 9);
    if (cleanSenders.length === 0) {
       throw new Error('No valid sender devices provided.');
    }

    const activeSessionsPool = [];
    
    // Initialize or fetch all requested sessions
    for (const cleanSender of cleanSenders) {
      let session = userSessions.get(cleanSender);
      if (!session || (!session.isConnected && session.status === 'sleeping')) {
        session = await whatsappManager.initUserSession(userId, cleanSender, false);
      }
      
      if (!session) {
        console.warn(`[WhatsApp] Failed to find linked device ${cleanSender}. Skipping for this batch.`);
        continue;
      }
      
      if (!session.isConnected) {
        // Wait up to 90 seconds for connection (if a number has many messages in background, Baileys can take a long time to process them)
        for (let w = 0; w < 90; w++) {
          if (session.isConnected) break;
          await delay(1000);
        }
      }
      
      if (session.isConnected) {
        if (session.currentJob && session.currentJob.status === 'in_progress') {
           console.warn(`[WhatsApp] Device ${cleanSender} is already busy. Skipping for this batch.`);
        } else {
           activeSessionsPool.push({ phone: cleanSender, session });
        }
      }
    }

    if (activeSessionsPool.length === 0) {
      throw new Error('None of the selected WhatsApp devices are connected and ready.');
    }

    const cleanTargetNumber = normalizePhoneNumber(targetNumber);
    if (!cleanTargetNumber || cleanTargetNumber.length < 9) {
      throw new Error(`Target participant number "${targetNumber}" is invalid.`);
    }

    const participantJid = `${cleanTargetNumber}@s.whatsapp.net`;
    const numGroups = Math.max(1, Math.min(500, parseInt(quantity, 10) || 1)); // allow up to 500 total now since it's spread out
    const safeDelay = Math.max(1, parseInt(delaySeconds, 10) || 1);
    const sanitizedBase = (baseName || 'Group').trim().substring(0, 75);

    // Set job status on all participating devices
    const jobData = { total: numGroups, current: 0, status: 'in_progress' };
    for (const { session } of activeSessionsPool) {
      session.currentJob = jobData;
      session.lastActivity = Date.now();
    }

    const results = [];
    let senderIndex = 0;
    
    let cancelled = false;

    try {
      for (let i = 1; i <= numGroups; i++) {
        if (activeSessionsPool.length === 0) {
           if (onProgress) onProgress({ step: 'failed', current: i, total: numGroups, message: 'All participating devices encountered errors or were rate limited. Stopping batch.' });
           break;
        }

        // Check cancellation on the shared job object
        if (jobData.status === 'cancelled') {
           console.log(`[WhatsApp] Creation stopped by the user.`);
           cancelled = true;
           break;
        }

        const currentUser = db.findUserById(userId);
        if (!currentUser || !currentUser.isActive) throw new Error('User account was suspended.');
        if (expectedSessionId && currentUser.currentSessionId !== expectedSessionId) {
          throw new Error('Account logged in on another device.');
        }

        // Round-robin selection
        if (senderIndex >= activeSessionsPool.length) {
          senderIndex = 0;
        }
        
        const poolItem = activeSessionsPool[senderIndex];
        const { phone: currentPhone, session: currentSession } = poolItem;
        
        currentSession.lastActivity = Date.now(); // Keep awake during job

        if (!currentSession.isConnected || !currentSession.sock?.ws?.isOpen) {
           // Allow a brief wait for reconnection (can take longer if rate-limited or lots of messages)
           let reconnected = false;
           for (let waitSec = 0; waitSec < 30; waitSec++) {
             await delay(1000);
             const refetchedSession = userSessions.get(currentPhone) || currentSession;
             if (refetchedSession.isConnected && refetchedSession.sock?.ws?.isOpen) {
                poolItem.session = refetchedSession; // update reference
                reconnected = true;
                break;
             }
           }
           if (!reconnected) {
             console.warn(`[WhatsApp] Device ${currentPhone} disconnected during batch. Removing from pool.`);
             activeSessionsPool.splice(senderIndex, 1);
             if (activeSessionsPool.length > 0) {
               i--; // retry this group index with the next available device
             }
             continue; 
           }
        }

        const title = numGroups === 1 ? sanitizedBase : `${sanitizedBase} #${i}`;
        const isCommunity = creationType === 'community';

        if (onProgress) {
          onProgress({
            step: 'creating',
            current: i,
            total: numGroups,
            groupTitle: title,
            message: `[+${currentPhone}] Creating ${isCommunity ? 'community' : 'group'} "${title}"...`
          });
        }

        let createdEntity = null;
        let inviteLink = null;
        let errorMsg = null;
        let fatalError = false;

        try {
          // Send a human-like presence update to tell WhatsApp the user is "active"
          try {
            await poolItem.session.sock.sendPresenceUpdate('available');
            await delay(Math.floor(Math.random() * 1000) + 500); 
          } catch(e) {}

          if (isCommunity) {
             for (let retry = 1; retry <= 3; retry++) {
               try {
                 createdEntity = await poolItem.session.sock.communityCreate(title, '');
                 break;
               } catch (createErr) {
                 const errMsg = createErr.message?.toLowerCase() || '';
                 if (retry === 3 || errMsg.includes('rate-overlimit') || errMsg.includes('429') || errMsg.includes('not-authorized')) throw createErr;
                 console.warn(`[WhatsApp] [+${currentPhone}] Community create retry ${retry}:`, createErr.message);
                 await delay(3500 * retry);
               }
             }
             
             if (createdEntity?.id) {
               await delay(2000);
               try {
                 const code = await poolItem.session.sock.communityInviteCode(createdEntity.id);
                 if (code) inviteLink = `https://chat.whatsapp.com/${code}`;
               } catch(codeErr) {}
             }
          } else {
             for (let retry = 1; retry <= 3; retry++) {
               try {
                 createdEntity = await poolItem.session.sock.groupCreate(title, [participantJid]);
                 break;
               } catch (createErr) {
                 const errMsg = createErr.message?.toLowerCase() || '';
                 if (retry === 3 || errMsg.includes('rate-overlimit') || errMsg.includes('429') || errMsg.includes('not-authorized')) throw createErr;
                 console.warn(`[WhatsApp] [+${currentPhone}] Group create retry ${retry}:`, createErr.message);
                 await delay(3500 * retry);
               }
             }

             if (createdEntity?.id) {
               for (let attempt = 1; attempt <= 3; attempt++) {
                 try {
                   await delay(600 * attempt);
                   const code = await poolItem.session.sock.groupInviteCode(createdEntity.id);
                   if (code) { inviteLink = `https://chat.whatsapp.com/${code}`; break; }
                 } catch (codeErr) {}
               }
             }
          }
        } catch (err) {
          console.error(`Error creating ${title} via ${currentPhone}:`, err);
          errorMsg = err.message || 'Creation failed';
          if (errorMsg.toLowerCase().includes('rate-overlimit') || errorMsg.toLowerCase().includes('resource-limit') || errorMsg.includes('429')) {
            errorMsg = `WhatsApp Rate Limit. Pausing this device to protect account.`;
            fatalError = true;
          }
        }

        const record = db.saveGroupRecord({
          userId,
          groupName: title + (isCommunity ? ' (Community)' : ''),
          groupId: createdEntity?.id || null,
          inviteLink,
          targetNumber: cleanTargetNumber,
          status: createdEntity ? 'created' : 'failed',
          error: errorMsg,
          senderNumber: currentPhone
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
            message: createdEntity ? `[+${currentPhone}] Successfully created "${title}"!` : `[+${currentPhone}] Failed: ${errorMsg}`
          });
        }

        if (fatalError) {
           console.warn(`[WhatsApp] Device ${currentPhone} hit a fatal error (e.g. rate limit). Removing from active pool.`);
           activeSessionsPool.splice(senderIndex, 1);
           // Decrement i to retry this group index, unless we are totally out of senders
           if (activeSessionsPool.length > 0) {
              i--; 
           }
           continue; // skip the cooldown for the dropped device
        }

        // Advance to the next sender for the next round-robin loop
        senderIndex++;

        // Handle cooldown if there are still groups left to create
        if (i < numGroups && activeSessionsPool.length > 0) {
          const randomJitterMs = Math.floor(Math.random() * 4000); 
          const totalWaitMs = (safeDelay * 1000) + randomJitterMs;
          const displaySeconds = Math.ceil(totalWaitMs / 1000);

          if (onProgress) {
            onProgress({
              step: 'cooldown',
              current: i,
              total: numGroups,
              cooldownSeconds: displaySeconds,
              message: `Waiting ${displaySeconds}s cooldown...`
            });
          }
          
          const loops = Math.ceil(totalWaitMs / 100);
          for (let wait = 0; wait < loops; wait++) {
            if (jobData.status === 'cancelled') {
              cancelled = true;
              break;
            }
            await delay(100);
          }
          if (cancelled) break;
        }
      }
    } finally {
      // Clear the job object reference from all sessions
      for (const { session } of activeSessionsPool) {
         if (session.currentJob === jobData) {
            session.currentJob = null;
         }
      }
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
