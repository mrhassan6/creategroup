import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const DB_TMP_FILE = path.join(DATA_DIR, 'db.json.tmp');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let inMemoryDb = {
  users: [],
  groups: []
};

function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      // Seed default admin account on first run
      const salt = bcrypt.genSaltSync(10);
      const defaultHash = bcrypt.hashSync('hassan123', salt);
      const initial = {
        users: [
          {
            id: 'admin_' + Date.now(),
            username: 'hassan',
            passwordHash: defaultHash,
            role: 'admin',
            isActive: true,
            currentSessionId: null,
            lastLoginAt: null,
            createdAt: new Date().toISOString()
          }
        ],
        groups: []
      };
      writeDb(initial);
      inMemoryDb = initial;
      return initial;
    }

    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);

    // Schema integrity & auto-promotion
    let changed = false;
    if (!Array.isArray(parsed.users)) parsed.users = [];
    if (!Array.isArray(parsed.groups)) parsed.groups = [];

    parsed.users = parsed.users.map((u) => {
      let updated = false;
      if (!u.role) {
        u.role = (u.username?.toLowerCase() === 'hassan' || u.username?.toLowerCase() === 'admin') ? 'admin' : 'user';
        updated = true;
      }
      if (u.isActive === undefined) {
        u.isActive = true;
        updated = true;
      }
      if (u.currentSessionId === undefined) {
        u.currentSessionId = null;
        updated = true;
      }
      if (u.expiresAt === undefined) {
        u.expiresAt = null; // null = lifetime
        updated = true;
      }
      if (u.notes === undefined) {
        u.notes = '';
        updated = true;
      }
      if (u.name === undefined) {
        u.name = '';
        updated = true;
      }
      if (u.phoneNumber === undefined) {
        u.phoneNumber = '';
        updated = true;
      }
      if (updated) changed = true;
      return u;
    });

    // Ensure at least one admin account exists
    const hasAdmin = parsed.users.some((u) => u.role === 'admin');
    if (!hasAdmin) {
      const salt = bcrypt.genSaltSync(10);
      parsed.users.push({
        id: 'admin_' + Date.now(),
        username: 'hassan',
        passwordHash: bcrypt.hashSync('hassan123', salt),
        role: 'admin',
        isActive: true,
        currentSessionId: null,
        lastLoginAt: null,
        createdAt: new Date().toISOString()
      });
      changed = true;
    }

    inMemoryDb = parsed;
    if (changed) writeDb(parsed);
    return parsed;
  } catch (err) {
    console.error('[DB] Warning: Error reading DB file, using in-memory cache to prevent data loss:', err.message);
    return inMemoryDb;
  }
}

// Atomic file write to prevent corruption during unexpected shutdowns
function writeDb(data) {
  try {
    inMemoryDb = data;
    const jsonString = JSON.stringify(data, null, 2);
    fs.writeFileSync(DB_TMP_FILE, jsonString, 'utf-8');
    try {
      fs.renameSync(DB_TMP_FILE, DB_FILE);
    } catch (renameErr) {
      if (renameErr.code === 'EXDEV') {
        fs.copyFileSync(DB_TMP_FILE, DB_FILE);
        fs.unlinkSync(DB_TMP_FILE);
      } else {
        throw renameErr;
      }
    }
  } catch (err) {
    console.error('[DB] Error writing database atomically:', err);
  }
}

export function isUserExpired(user) {
  if (!user || !user.expiresAt) return false;
  return new Date(user.expiresAt) < new Date();
}

export function getDaysRemaining(expiresAt) {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
  return days;
}

export const db = {
  findUserByUsername(username) {
    if (!username) return null;
    const data = readDb();
    return data.users.find((u) => u.username && u.username.toLowerCase() === username.toLowerCase().trim());
  },

  findUserById(id) {
    if (!id) return null;
    const data = readDb();
    return data.users.find((u) => u.id === id);
  },

  getAllUsers() {
    const data = readDb();
    return data.users.map((u) => ({
      id: u.id,
      name: u.name || '',
      phoneNumber: u.phoneNumber || '',
      username: u.username,
      role: u.role || 'user',
      isActive: u.isActive !== false,
      expiresAt: u.expiresAt || null,
      isExpired: isUserExpired(u),
      daysRemaining: getDaysRemaining(u.expiresAt),
      notes: u.notes || '',
      hasActiveSession: !!u.currentSessionId,
      lastLoginAt: u.lastLoginAt || null,
      createdAt: u.createdAt
    }));
  },

  createUser({ id, name, phoneNumber, username, passwordHash, role = 'user', expiresAt = null, notes = '' }) {
    const data = readDb();
    const cleanUsername = username.trim();
    const newUser = {
      id: id || Date.now().toString() + '_' + Math.random().toString(36).substring(2, 6),
      name: name ? String(name).trim() : '',
      phoneNumber: phoneNumber ? String(phoneNumber).trim() : '',
      username: cleanUsername,
      passwordHash,
      role: role || (cleanUsername.toLowerCase() === 'hassan' || cleanUsername.toLowerCase() === 'admin' ? 'admin' : 'user'),
      isActive: true,
      expiresAt: cleanUsername.toLowerCase() === 'hassan' ? null : (expiresAt || null),
      notes: notes || '',
      currentSessionId: null,
      lastLoginAt: null,
      createdAt: new Date().toISOString()
    };
    data.users.push(newUser);
    writeDb(data);
    return {
      id: newUser.id,
      name: newUser.name,
      phoneNumber: newUser.phoneNumber,
      username: newUser.username,
      role: newUser.role,
      isActive: newUser.isActive,
      expiresAt: newUser.expiresAt,
      notes: newUser.notes,
      createdAt: newUser.createdAt
    };
  },

  updateUserDetails(userId, updates = {}) {
    const data = readDb();
    const user = data.users.find((u) => u.id === userId);
    if (!user) return null;

    if (updates.username && updates.username.trim()) {
      user.username = updates.username.trim();
    }
    if (updates.name !== undefined) {
      user.name = updates.name !== null ? String(updates.name).trim() : '';
    }
    if (updates.phoneNumber !== undefined) {
      user.phoneNumber = updates.phoneNumber !== null ? String(updates.phoneNumber).trim() : '';
    }
    if (updates.role && (updates.role === 'admin' || updates.role === 'user')) {
      user.role = updates.role;
    }
    if (updates.isActive !== undefined) {
      user.isActive = !!updates.isActive;
      if (!user.isActive) {
        user.currentSessionId = null; // Invalidate session on suspend/block
      }
    }
    if (updates.expiresAt !== undefined) {
      user.expiresAt = updates.expiresAt;
    }
    if (updates.notes !== undefined) {
      user.notes = updates.notes;
    }

    writeDb(data);
    return {
      id: user.id,
      name: user.name,
      phoneNumber: user.phoneNumber,
      username: user.username,
      role: user.role,
      isActive: user.isActive,
      expiresAt: user.expiresAt,
      isExpired: isUserExpired(user),
      daysRemaining: getDaysRemaining(user.expiresAt),
      notes: user.notes
    };
  },

  updateUserPassword(userId, newPasswordHash) {
    const data = readDb();
    const user = data.users.find((u) => u.id === userId);
    if (user) {
      user.passwordHash = newPasswordHash;
      user.currentSessionId = null; // Invalidate active session to force re-login with new password
      writeDb(data);
      return true;
    }
    return false;
  },

  updateUserSession(userId, sessionId) {
    const data = readDb();
    const user = data.users.find((u) => u.id === userId);
    if (user) {
      user.currentSessionId = sessionId;
      user.lastLoginAt = new Date().toISOString();
      writeDb(data);
      return true;
    }
    return false;
  },

  clearUserSession(userId) {
    const data = readDb();
    const user = data.users.find((u) => u.id === userId);
    if (user) {
      user.currentSessionId = null;
      writeDb(data);
      return true;
    }
    return false;
  },

  toggleUserActive(userId) {
    const data = readDb();
    const user = data.users.find((u) => u.id === userId);
    if (user) {
      user.isActive = !user.isActive;
      if (!user.isActive) {
        user.currentSessionId = null;
      }
      writeDb(data);
      return { id: user.id, username: user.username, isActive: user.isActive };
    }
    return null;
  },

  deleteUser(userId) {
    const data = readDb();
    const index = data.users.findIndex((u) => u.id === userId);
    if (index !== -1) {
      const removed = data.users.splice(index, 1)[0];
      data.groups = data.groups.filter((g) => g.userId !== userId);
      writeDb(data);
      return removed;
    }
    return null;
  },

  saveGroupRecord({ userId, groupName, groupId, inviteLink, targetNumber, status, error }) {
    const data = readDb();
    const record = {
      id: Date.now().toString() + '-' + Math.random().toString(36).substring(2, 7),
      userId,
      groupName,
      groupId: groupId || null,
      inviteLink: inviteLink || null,
      targetNumber,
      status: status || 'success',
      error: error || null,
      createdAt: new Date().toISOString()
    };
    data.groups.push(record);
    writeDb(data);
    return record;
  },

  getUserGroups(userId) {
    const data = readDb();
    return data.groups
      .filter((g) => g.userId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  getAllGroupsWithUsers() {
    const data = readDb();
    const userMap = new Map(data.users.map((u) => [u.id, u.username]));
    return data.groups
      .map((g) => ({
        ...g,
        creatorUsername: userMap.get(g.userId) || 'Unknown'
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  getTotalGroupsCount() {
    const data = readDb();
    return data.groups.length;
  },

  pruneExpiredUsers() {
    const data = readDb();
    const now = new Date();
    // Find all expired users that are not admin
    const expiredUsers = data.users.filter(u => u.expiresAt && new Date(u.expiresAt) < now && u.role !== 'admin');
    
    if (expiredUsers.length > 0) {
      const expiredIds = expiredUsers.map(u => u.id);
      
      // Permanently remove users and their group history
      data.users = data.users.filter(u => !expiredIds.includes(u.id));
      data.groups = data.groups.filter(g => !expiredIds.includes(g.userId));
      
      writeDb(data);
      return expiredIds;
    }
    return [];
  }
};
