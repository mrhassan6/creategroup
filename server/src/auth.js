import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from './db.js';
import { whatsappManager } from './whatsappManager.js';

const JWT_SECRET = process.env.JWT_SECRET || 'gc-agent-jwt-super-secret-key-2026';

export function generateToken(user, sessionId) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role || 'user',
      sessionId
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query?.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authorization token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.findUserById(decoded.id);

    if (!user) {
      return res.status(401).json({ error: 'USER_NOT_FOUND', message: 'Account no longer exists' });
    }

    if (!user.isActive) {
      return res.status(403).json({
        error: 'ACCOUNT_SUSPENDED',
        message: 'Your account has been deactivated. Please contact Mr. Hassan (+923107612528).'
      });
    }

    // EXPIRATION ENFORCEMENT
    if (user.expiresAt && new Date(user.expiresAt) < new Date()) {
      return res.status(403).json({
        error: 'ACCOUNT_EXPIRED',
        message: 'Your account access duration has expired. Please contact Mr. Hassan (+923107612528) to renew.'
      });
    }

    // SINGLE DEVICE ENFORCEMENT
    if (user.currentSessionId !== decoded.sessionId) {
      return res.status(401).json({
        error: 'SESSION_TERMINATED',
        message: 'Your account was logged in on another device. You have been signed out.'
      });
    }

    req.user = {
      id: user.id,
      username: user.username,
      role: user.role || 'user',
      sessionId: decoded.sessionId
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'INVALID_TOKEN', message: 'Session expired or invalid' });
  }
}

export function adminMiddleware(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({
      error: 'ADMIN_REQUIRED',
      message: 'Access denied. Administrator privileges required.'
    });
  }
  next();
}

/**
 * Public self-registration is disabled. Directs user to Mr. Hassan.
 */
export async function handleRegister(req, res) {
  return res.status(403).json({
    error: 'REGISTRATION_DISABLED',
    message: 'Public registration is disabled. Please contact Mr. Hassan (+923107612528) to get your account.',
    contact: {
      name: 'Mr. Hassan',
      phone: '+923107612528',
      whatsappUrl: 'https://wa.me/923107612528?text=Hello%20Mr.%20Hassan,%20I%20want%20login%20access%20for%20GC%20Agent'
    }
  });
}

export async function handleLogin(req, res) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const cleanUsername = username.trim();
    const user = db.findUserByUsername(cleanUsername);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    if (!user.isActive) {
      return res.status(403).json({
        error: 'ACCOUNT_SUSPENDED',
        message: 'Your account has been deactivated. Please contact Mr. Hassan (+923107612528).'
      });
    }

    // EXPIRATION ENFORCEMENT
    if (user.expiresAt && new Date(user.expiresAt) < new Date()) {
      return res.status(403).json({
        error: 'ACCOUNT_EXPIRED',
        message: 'Your account access duration has expired. Please contact Mr. Hassan (+923107612528) to renew.'
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Generate unique session ID for single-device restriction
    const newSessionId = crypto.randomBytes(16).toString('hex');
    db.updateUserSession(user.id, newSessionId);

    const token = generateToken(user, newSessionId);

    return res.json({
      message: 'Logged in successfully',
      user: {
        id: user.id,
        username: user.username,
        role: user.role || 'user'
      },
      token
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed' });
  }
}

// ADMIN CONTROLLERS
export async function handleAdminGetUsers(req, res) {
  try {
    const users = db.getAllUsers();
    const totalGroups = db.getTotalGroupsCount();
    const activeUsers = users.filter((u) => u.isActive && !u.isExpired).length;
    const expiredUsers = users.filter((u) => u.isExpired).length;
    const blockedUsers = users.filter((u) => !u.isActive).length;
    const loggedDevices = users.filter((u) => u.hasActiveSession).length;

    return res.json({
      users,
      stats: {
        totalUsers: users.length,
        activeUsers,
        expiredUsers,
        blockedUsers,
        loggedDevices,
        totalGroups
      }
    });
  } catch (err) {
    console.error('Admin get users error:', err);
    return res.status(500).json({ error: 'Failed to retrieve users. Internal server error.' });
  }
}

export async function handleAdminCreateUser(req, res) {
  try {
    const { name, phoneNumber, username, password, role, durationDays, expiresAt: customExpiresAt, notes } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    const cleanUser = username.trim();
    if (cleanUser.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    if (password.length < 5) {
      return res.status(400).json({ error: 'Password must be at least 5 characters' });
    }

    const existing = db.findUserByUsername(cleanUser);
    if (existing) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    // Calculate expiration date
    let calculatedExpiresAt = null;
    if (customExpiresAt) {
      const dateObj = new Date(customExpiresAt);
      if (isNaN(dateObj.getTime())) {
        return res.status(400).json({ error: 'Invalid expiration date format' });
      }
      calculatedExpiresAt = dateObj.toISOString();
    } else if (durationDays && durationDays !== 'lifetime' && !isNaN(parseInt(durationDays, 10))) {
      const days = parseInt(durationDays, 10);
      if (days > 0) {
        calculatedExpiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      }
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const newUser = db.createUser({
      name,
      phoneNumber,
      username: cleanUser,
      passwordHash,
      role: role === 'admin' ? 'admin' : 'user',
      expiresAt: calculatedExpiresAt,
      notes: notes || ''
    });

    return res.status(201).json({
      message: 'User created successfully',
      user: newUser
    });
  } catch (err) {
    console.error('Admin user creation error:', err);
    return res.status(500).json({ error: 'Failed to create user' });
  }
}

export async function handleAdminUpdateUser(req, res) {
  try {
    const { id } = req.params;
    const { name, phoneNumber, username, role, isActive, durationDays, expiresAt: customExpiresAt, notes } = req.body;

    const user = db.findUserById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updates = {};

    if (name !== undefined) updates.name = name;
    if (phoneNumber !== undefined) updates.phoneNumber = phoneNumber;

    if (username && username.trim()) {
      const cleanUser = username.trim();
      if (cleanUser.toLowerCase() !== user.username.toLowerCase()) {
        const existing = db.findUserByUsername(cleanUser);
        if (existing && existing.id !== id) {
          return res.status(409).json({ error: 'Username already taken by another account' });
        }
      }
      updates.username = cleanUser;
    }

    if (role && (role === 'admin' || role === 'user')) {
      if (id === req.user.id && role !== 'admin') {
        return res.status(400).json({ error: 'Cannot demote your own administrator account' });
      }
      updates.role = role;
    }

    if (isActive !== undefined) {
      if (id === req.user.id && !isActive) {
        return res.status(400).json({ error: 'Cannot block your own administrator account' });
      }
      updates.isActive = !!isActive;
    }

    if (notes !== undefined) {
      updates.notes = notes;
    }

    // Handle duration / expiration updates
    if (customExpiresAt !== undefined) {
      if (customExpiresAt) {
        const dateObj = new Date(customExpiresAt);
        if (isNaN(dateObj.getTime())) {
          return res.status(400).json({ error: 'Invalid expiration date format' });
        }
        updates.expiresAt = dateObj.toISOString();
      } else {
        updates.expiresAt = null;
      }
    } else if (durationDays !== undefined) {
      if (durationDays === 'lifetime') {
        updates.expiresAt = null;
      } else {
        const days = parseInt(durationDays, 10);
        if (!isNaN(days) && days > 0) {
          const baseTime = (user.expiresAt && new Date(user.expiresAt) > new Date())
            ? new Date(user.expiresAt).getTime()
            : Date.now();
          updates.expiresAt = new Date(baseTime + days * 24 * 60 * 60 * 1000).toISOString();
        }
      }
    }

    const updatedUser = db.updateUserDetails(id, updates);
    return res.json({
      message: 'User details updated successfully',
      user: updatedUser
    });
  } catch (err) {
    console.error('Admin user update error:', err);
    return res.status(500).json({ error: 'Failed to update user details. Internal server error.' });
  }
}

export async function handleAdminGetAllGroups(req, res) {
  try {
    const groups = db.getAllGroupsWithUsers();
    return res.json(groups);
  } catch (err) {
    console.error('Admin get groups error:', err);
    return res.status(500).json({ error: 'Failed to retrieve groups. Internal server error.' });
  }
}

export async function handleAdminResetPassword(req, res) {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 5) {
      return res.status(400).json({ error: 'New password must be at least 5 characters' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);
    const updated = db.updateUserPassword(id, passwordHash);
    if (!updated) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ message: 'Password updated successfully and active session was reset' });
  } catch (err) {
    console.error('Admin reset password error:', err);
    return res.status(500).json({ error: 'Failed to reset password. Internal server error.' });
  }
}

export async function handleAdminToggleUser(req, res) {
  try {
    const { id } = req.params;
    if (id === req.user.id) {
      return res.status(400).json({ error: 'Cannot deactivate your own admin account' });
    }
    const result = db.toggleUserActive(id);
    if (!result) return res.status(404).json({ error: 'User not found' });
    return res.json({ message: 'User status updated', user: result });
  } catch (err) {
    console.error('Admin toggle user error:', err);
    return res.status(500).json({ error: 'Failed to toggle user status. Internal server error.' });
  }
}

export async function handleAdminKickUser(req, res) {
  try {
    const { id } = req.params;
    db.clearUserSession(id);
    // Destroy their WhatsApp connection from memory and disk instantly
    whatsappManager.logout(id).catch(() => {});
    return res.json({ message: 'User device session terminated successfully' });
  } catch (err) {
    console.error('Admin kick user error:', err);
    return res.status(500).json({ error: 'Failed to kick user session. Internal server error.' });
  }
}

export async function handleAdminDeleteUser(req, res) {
  try {
    const { id } = req.params;
    if (id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own admin account' });
    }
    const removed = db.deleteUser(id);
    if (!removed) return res.status(404).json({ error: 'User not found' });
    
    // Clean up WhatsApp session files
    whatsappManager.logout(id).catch(() => {});
    
    return res.json({ message: 'User deleted permanently' });
  } catch (err) {
    console.error('Admin delete user error:', err);
    return res.status(500).json({ error: 'Failed to delete user. Internal server error.' });
  }
}
