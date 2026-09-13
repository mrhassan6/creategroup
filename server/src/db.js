import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const JSON_DB_FILE = path.join(DATA_DIR, 'db.json');
const SQLITE_FILE = path.join(DATA_DIR, 'database.sqlite');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let dbConn = null;
let isInitialized = false;

// Initialize DB once at startup
export async function initDb() {
  dbConn = new Database(SQLITE_FILE);
  dbConn.pragma('journal_mode = WAL'); // Enables high concurrency without blocking

  // Create tables
  dbConn.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      passwordHash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      isActive INTEGER DEFAULT 1,
      currentSessionId TEXT,
      expiresAt TEXT,
      notes TEXT,
      name TEXT,
      phoneNumber TEXT,
      lastLoginAt TEXT,
      createdAt TEXT NOT NULL
    );
  `);

  dbConn.exec(`
    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      groupName TEXT,
      groupId TEXT,
      inviteLink TEXT,
      targetNumber TEXT,
      status TEXT,
      error TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Migrate old JSON data if it exists and we haven't migrated
  if (fs.existsSync(JSON_DB_FILE)) {
    try {
      const raw = await fs.promises.readFile(JSON_DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      
      const insertUser = dbConn.prepare(`
        INSERT OR IGNORE INTO users (id, username, passwordHash, role, isActive, currentSessionId, expiresAt, notes, name, phoneNumber, lastLoginAt, createdAt)
        VALUES (@id, @username, @passwordHash, @role, @isActive, @currentSessionId, @expiresAt, @notes, @name, @phoneNumber, @lastLoginAt, @createdAt)
      `);
      
      const insertGroup = dbConn.prepare(`
        INSERT OR IGNORE INTO groups (id, userId, groupName, groupId, inviteLink, targetNumber, status, error, createdAt)
        VALUES (@id, @userId, @groupName, @groupId, @inviteLink, @targetNumber, @status, @error, @createdAt)
      `);

      dbConn.transaction(() => {
        if (parsed.users) {
          for (const u of parsed.users) {
            insertUser.run({
              id: u.id,
              username: u.username || `user_${Date.now()}`,
              passwordHash: u.passwordHash || '',
              role: u.role || 'user',
              isActive: u.isActive === false ? 0 : 1,
              currentSessionId: u.currentSessionId || null,
              expiresAt: u.expiresAt || null,
              notes: u.notes || '',
              name: u.name || '',
              phoneNumber: u.phoneNumber || '',
              lastLoginAt: u.lastLoginAt || null,
              createdAt: u.createdAt || new Date().toISOString()
            });
          }
        }
        if (parsed.groups) {
          for (const g of parsed.groups) {
             insertGroup.run({
                id: g.id || `${Date.now()}_${Math.random()}`,
                userId: g.userId,
                groupName: g.groupName || '',
                groupId: g.groupId || null,
                inviteLink: g.inviteLink || null,
                targetNumber: g.targetNumber || '',
                status: g.status || '',
                error: g.error || null,
                createdAt: g.createdAt || new Date().toISOString()
             });
          }
        }
      })();
      
      // Rename JSON to prevent re-migration
      await fs.promises.rename(JSON_DB_FILE, JSON_DB_FILE + '.migrated');
      console.log('[DB] Safely migrated db.json to SQLite database.sqlite');
    } catch(err) {
      console.error('[DB] Error migrating JSON DB to SQLite:', err);
    }
  }

  // Ensure at least one admin account exists
  const adminCount = dbConn.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get().count;
  if (adminCount === 0) {
    const salt = await bcrypt.genSalt(10);
    const defaultHash = await bcrypt.hash('hassan123', salt);
    const insertAdmin = dbConn.prepare(`
        INSERT INTO users (id, username, passwordHash, role, isActive, createdAt)
        VALUES (@id, @username, @passwordHash, 'admin', 1, @createdAt)
    `);
    insertAdmin.run({
      id: 'admin_' + Date.now(),
      username: 'hassan',
      passwordHash: defaultHash,
      createdAt: new Date().toISOString()
    });
  }

  isInitialized = true;
}

function ensureInit() {
  if (!isInitialized || !dbConn) {
    console.warn('[DB] DB access attempted before init. This should not happen if startServer awaits initDb.');
  }
}

export function isUserExpired(user) {
  if (!user || !user.expiresAt) return false;
  return new Date(user.expiresAt) < new Date();
}

export function getDaysRemaining(expiresAt) {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function mapUserRow(u) {
  if (!u) return null;
  return {
    ...u,
    isActive: u.isActive === 1,
    isExpired: isUserExpired(u),
    daysRemaining: getDaysRemaining(u.expiresAt),
    hasActiveSession: !!u.currentSessionId
  };
}

export const db = {
  findUserByUsername(username) {
    if (!username) return null;
    ensureInit();
    const row = dbConn.prepare("SELECT * FROM users WHERE LOWER(username) = ?").get(username.toLowerCase().trim());
    return mapUserRow(row);
  },

  findUserById(id) {
    if (!id) return null;
    ensureInit();
    const row = dbConn.prepare("SELECT * FROM users WHERE id = ?").get(id);
    return mapUserRow(row);
  },

  getAllUsers() {
    ensureInit();
    const rows = dbConn.prepare("SELECT * FROM users").all();
    return rows.map(mapUserRow);
  },

  createUser({ id, name, phoneNumber, username, passwordHash, role = 'user', expiresAt = null, notes = '' }) {
    ensureInit();
    const cleanUsername = username.trim();
    const newId = id || Date.now().toString() + '_' + Math.random().toString(36).substring(2, 6);
    const actualRole = role || (cleanUsername.toLowerCase() === 'hassan' || cleanUsername.toLowerCase() === 'admin' ? 'admin' : 'user');
    const actualExpires = cleanUsername.toLowerCase() === 'hassan' ? null : (expiresAt || null);
    const createdAt = new Date().toISOString();

    const insert = dbConn.prepare(`
      INSERT INTO users (id, name, phoneNumber, username, passwordHash, role, isActive, expiresAt, notes, createdAt)
      VALUES (@id, @name, @phoneNumber, @username, @passwordHash, @role, 1, @expiresAt, @notes, @createdAt)
    `);
    
    insert.run({
      id: newId,
      name: name ? String(name).trim() : '',
      phoneNumber: phoneNumber ? String(phoneNumber).trim() : '',
      username: cleanUsername,
      passwordHash,
      role: actualRole,
      expiresAt: actualExpires,
      notes: notes || '',
      createdAt
    });
    
    return this.findUserById(newId);
  },

  updateUserDetails(userId, updates = {}) {
    ensureInit();
    const user = this.findUserById(userId);
    if (!user) return null;

    const fields = [];
    const values = {};
    
    if (updates.username && updates.username.trim()) {
      fields.push("username = @username");
      values.username = updates.username.trim();
    }
    if (updates.name !== undefined) {
      fields.push("name = @name");
      values.name = updates.name !== null ? String(updates.name).trim() : '';
    }
    if (updates.phoneNumber !== undefined) {
      fields.push("phoneNumber = @phoneNumber");
      values.phoneNumber = updates.phoneNumber !== null ? String(updates.phoneNumber).trim() : '';
    }
    if (updates.role && (updates.role === 'admin' || updates.role === 'user')) {
      fields.push("role = @role");
      values.role = updates.role;
    }
    if (updates.isActive !== undefined) {
      fields.push("isActive = @isActive");
      values.isActive = !!updates.isActive ? 1 : 0;
      if (!updates.isActive) {
        fields.push("currentSessionId = NULL");
      }
    }
    if (updates.expiresAt !== undefined) {
      fields.push("expiresAt = @expiresAt");
      values.expiresAt = updates.expiresAt;
    }
    if (updates.notes !== undefined) {
      fields.push("notes = @notes");
      values.notes = updates.notes;
    }

    if (fields.length > 0) {
      values.id = userId;
      dbConn.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = @id`).run(values);
    }
    return this.findUserById(userId);
  },

  updateUserPassword(userId, newPasswordHash) {
    ensureInit();
    const result = dbConn.prepare("UPDATE users SET passwordHash = ?, currentSessionId = NULL WHERE id = ?").run(newPasswordHash, userId);
    return result.changes > 0;
  },

  updateUserSession(userId, sessionId) {
    ensureInit();
    const result = dbConn.prepare("UPDATE users SET currentSessionId = ?, lastLoginAt = ? WHERE id = ?").run(sessionId, new Date().toISOString(), userId);
    return result.changes > 0;
  },

  clearUserSession(userId) {
    ensureInit();
    const result = dbConn.prepare("UPDATE users SET currentSessionId = NULL WHERE id = ?").run(userId);
    return result.changes > 0;
  },

  toggleUserActive(userId) {
    ensureInit();
    const user = this.findUserById(userId);
    if (!user) return null;
    
    const newActive = user.isActive ? 0 : 1;
    const stmt = newActive === 0 
      ? dbConn.prepare("UPDATE users SET isActive = 0, currentSessionId = NULL WHERE id = ?")
      : dbConn.prepare("UPDATE users SET isActive = 1 WHERE id = ?");
    
    stmt.run(userId);
    return this.findUserById(userId);
  },

  deleteUser(userId) {
    ensureInit();
    const user = this.findUserById(userId);
    if (!user) return null;
    
    dbConn.prepare("DELETE FROM users WHERE id = ?").run(userId);
    return user;
  },

  saveGroupRecord({ userId, groupName, groupId, inviteLink, targetNumber, status, error }) {
    ensureInit();
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
    
    dbConn.prepare(`
      INSERT INTO groups (id, userId, groupName, groupId, inviteLink, targetNumber, status, error, createdAt)
      VALUES (@id, @userId, @groupName, @groupId, @inviteLink, @targetNumber, @status, @error, @createdAt)
    `).run(record);
    
    return record;
  },

  getUserGroups(userId) {
    ensureInit();
    return dbConn.prepare("SELECT * FROM groups WHERE userId = ? ORDER BY createdAt DESC").all(userId);
  },

  getAllGroupsWithUsers() {
    ensureInit();
    return dbConn.prepare(`
      SELECT g.*, COALESCE(u.username, 'Unknown') as creatorUsername 
      FROM groups g 
      LEFT JOIN users u ON g.userId = u.id 
      ORDER BY g.createdAt DESC
    `).all();
  },

  getTotalGroupsCount() {
    ensureInit();
    return dbConn.prepare("SELECT COUNT(*) as count FROM groups").get().count;
  },

  pruneExpiredUsers() {
    ensureInit();
    const now = new Date().toISOString();
    const expiredUsers = dbConn.prepare("SELECT id FROM users WHERE expiresAt IS NOT NULL AND expiresAt < ? AND role != 'admin'").all(now);
    
    const ids = expiredUsers.map(u => u.id);
    if (ids.length > 0) {
      dbConn.transaction(() => {
         const delUsers = dbConn.prepare("DELETE FROM users WHERE id = ?");
         for (const id of ids) delUsers.run(id);
      })();
    }
    return ids;
  }
};
