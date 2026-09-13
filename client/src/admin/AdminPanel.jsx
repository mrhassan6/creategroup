import React, { useState, useEffect } from 'react';
import { api } from '../api';
import {
  ShieldAlert,
  UserPlus,
  Users,
  Smartphone,
  Layers,
  Power,
  Trash2,
  Lock,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Key,
  Edit,
  X
} from 'lucide-react';

export default function AdminPanel({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // New User Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [newName, setNewName] = useState('');
  const [newPhoneNumber, setNewPhoneNumber] = useState('');
  const [newDurationDays, setNewDurationDays] = useState('lifetime');

  // Edit User Modal State
  const [editTargetUser, setEditTargetUser] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPhoneNumber, setEditPhoneNumber] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editRole, setEditRole] = useState('user');
  const [editDurationDays, setEditDurationDays] = useState('lifetime');

  // Password Reset Modal State
  const [resetTargetUser, setResetTargetUser] = useState(null);
  const [resetNewPassword, setResetNewPassword] = useState('');

  const loadAdminData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.adminGetUsers();
      setUsers(res.users || []);
      setStats(res.stats || null);
    } catch (err) {
      setError(err.message || 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setError(null);
    try {
      await api.adminCreateUser({
        name: newName.trim(),
        phoneNumber: newPhoneNumber.trim(),
        username: newUsername.trim(),
        password: newPassword,
        role: newRole,
        durationDays: newDurationDays === 'lifetime' ? 'lifetime' : parseInt(newDurationDays, 10) || 'lifetime'
      });
      setSuccessMsg(`User "${newUsername}" created successfully!`);
      setTimeout(() => setSuccessMsg(null), 3500);
      setNewName('');
      setNewPhoneNumber('');
      setNewUsername('');
      setNewPassword('');
      setNewDurationDays('lifetime');
      setNewRole('user');
      setShowAddModal(false);
      loadAdminData();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    if (!editTargetUser) return;
    setActionLoading(true);
    setError(null);
    try {
      await api.adminUpdateUser(editTargetUser.id, {
        name: editName.trim(),
        phoneNumber: editPhoneNumber.trim(),
        username: editUsername.trim(),
        role: editRole,
        durationDays: editDurationDays === 'lifetime' ? 'lifetime' : parseInt(editDurationDays, 10) || 'lifetime'
      });
      setSuccessMsg(`User "${editUsername}" updated successfully!`);
      setTimeout(() => setSuccessMsg(null), 3500);
      setEditTargetUser(null);
      loadAdminData();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetTargetUser) return;
    setActionLoading(true);
    setError(null);
    try {
      await api.adminResetPassword(resetTargetUser.id, resetNewPassword);
      setSuccessMsg(`Password for "${resetTargetUser.username}" updated and active device session reset!`);
      setTimeout(() => setSuccessMsg(null), 3500);
      setResetTargetUser(null);
      setResetNewPassword('');
      loadAdminData();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleUser = async (userId, username) => {
    setActionLoading(true);
    try {
      await api.adminToggleUser(userId);
      setSuccessMsg(`Updated access status for "${username}"`);
      setTimeout(() => setSuccessMsg(null), 3500);
      loadAdminData();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleKickDevice = async (userId, username) => {
    if (!window.confirm(`Force log out "${username}" from their active phone/device?`)) return;
    setActionLoading(true);
    try {
      await api.adminKickUser(userId);
      setSuccessMsg(`Terminated active device session for "${username}"`);
      setTimeout(() => setSuccessMsg(null), 3500);
      loadAdminData();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (!window.confirm(`Permanently delete account "${username}" and all their group records?`)) return;
    setActionLoading(true);
    try {
      await api.adminDeleteUser(userId);
      setSuccessMsg(`Deleted user "${username}"`);
      setTimeout(() => setSuccessMsg(null), 3500);
      loadAdminData();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Admin Title Card */}
      <div className="glass-panel" style={{ border: '1.5px solid rgba(168, 85, 247, 0.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(168, 85, 247, 0.35)'
            }}>
              <ShieldAlert size={24} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>
                Admin Control Center
              </h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Administrator: Mr. Hassan (+923107612528)
              </p>
            </div>
          </div>

          <button
            onClick={loadAdminData}
            disabled={loading}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.78rem'
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '0.75rem',
            marginTop: '1.25rem'
          }}>
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.75rem',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Users</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginTop: '2px' }}>
                {stats.totalUsers}
              </div>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.75rem',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Active Accounts</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#34d399', marginTop: '2px' }}>
                {stats.activeUsers}
              </div>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.75rem',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Logged In Devices</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#60a5fa', marginTop: '2px' }}>
                {stats.loggedDevices}
              </div>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.75rem',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Groups Created</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--wa-green)', marginTop: '2px' }}>
                {stats.totalGroups}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#fca5a5',
          padding: '0.75rem 1rem',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          color: '#34d399',
          padding: '0.75rem 1rem',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>
          User Accounts ({users.length})
        </h3>

        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary"
          style={{ padding: '0.55rem 1rem', fontSize: '0.82rem' }}
        >
          <UserPlus size={16} />
          <span>Create User</span>
        </button>
      </div>

      {/* Users List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {users.map((u) => {
          const isSelf = currentUser && (u.id === currentUser.id || u.username.toLowerCase() === currentUser.username.toLowerCase());
          return (
          <div
            key={u.id}
            className="glass-panel"
            style={{
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: u.role === 'admin' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(37, 211, 102, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  color: u.role === 'admin' ? '#c084fc' : '#34d399'
                }}>
                  {u.username.charAt(0).toUpperCase()}
                </div>

                <div>
                  <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{u.username}</span>
                    {isSelf && (
                      <span style={{ fontSize: '0.68rem', color: 'var(--wa-green)', fontWeight: 600 }}>(You)</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Created: {new Date(u.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: u.role === 'admin' ? 'rgba(168, 85, 247, 0.18)' : 'rgba(255, 255, 255, 0.05)',
                  color: u.role === 'admin' ? '#c084fc' : 'var(--text-secondary)',
                  border: `1px solid ${u.role === 'admin' ? 'rgba(168, 85, 247, 0.3)' : 'var(--border-color)'}`
                }}>
                  {u.role.toUpperCase()}
                </span>

                <span className={`status-badge ${u.isActive ? 'connected' : 'unlinked'}`} style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
                  {u.isActive ? 'Active' : 'Suspended'}
                </span>
              </div>
            </div>

            {/* Device Session Info */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              background: 'rgba(0, 0, 0, 0.25)',
              padding: '0.45rem 0.65rem',
              borderRadius: '6px'
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Smartphone size={13} color={u.hasActiveSession ? '#34d399' : 'var(--text-muted)'} />
                {u.hasActiveSession ? 'Device Session Active' : 'No Active Device'}
              </span>

              {u.lastLoginAt && (
                <span>Last login: {new Date(u.lastLoginAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              )}
            </div>

            {/* Actions Bar */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
              {/* Edit User */}
              <button
                type="button"
                onClick={() => {
                  setEditTargetUser(u);
                  setEditName(u.name || '');
                  setEditPhoneNumber(u.phoneNumber || '');
                  setEditUsername(u.username);
                  setEditRole(u.role || 'user');
                  setEditDurationDays(u.daysRemaining !== null ? u.daysRemaining.toString() : 'lifetime');
                }}
                disabled={actionLoading}
                className="btn btn-secondary"
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                title="Edit this user"
              >
                <Edit size={13} color="var(--wa-green)" />
                <span>Edit</span>
              </button>

              {/* Reset Password */}
              <button
                type="button"
                onClick={() => {
                  setResetTargetUser(u);
                  setResetNewPassword('');
                }}
                disabled={actionLoading}
                className="btn btn-secondary"
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                title="Reset password for this user"
              >
                <Key size={13} color="var(--wa-green)" />
                <span>Reset Password</span>
              </button>

              {/* Kick Session */}
              {u.hasActiveSession && (
                <button
                  type="button"
                  onClick={() => handleKickDevice(u.id, u.username)}
                  disabled={actionLoading}
                  className="btn btn-secondary"
                  style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                  title="Kick current device session"
                >
                  <Power size={13} color="#fbbf24" />
                  <span>Kick Device</span>
                </button>
              )}

              {/* Toggle Active / Suspended (Disabled on self) */}
              {!isSelf && (
                <button
                  type="button"
                  onClick={() => handleToggleUser(u.id, u.username)}
                  disabled={actionLoading}
                  className="btn btn-secondary"
                  style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                >
                  {u.isActive ? 'Suspend' : 'Activate'}
                </button>
              )}

              {/* Delete User (Disabled on self) */}
              {!isSelf && (
                <button
                  type="button"
                  onClick={() => handleDeleteUser(u.id, u.username)}
                  disabled={actionLoading}
                  className="btn btn-danger"
                  style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                  title="Delete User"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>
        );
        })}
      </div>

      {/* CREATE USER MODAL */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.25rem'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '380px',
            border: '1.5px solid var(--wa-green)'
          }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', marginBottom: '1rem' }}>
              Create New User Login
            </h3>

            <form onSubmit={handleCreateUser}>
              <div className="form-group">
                <label className="form-label">Name</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. John Doe"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. 923107612528"
                  value={newPhoneNumber}
                  onChange={(e) => setNewPhoneNumber(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. client_ali"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="Set password (min 5 chars)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Account Role</label>
                <select
                  className="input-field"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  style={{ cursor: 'pointer' }}
                >
                  <option value="user">Standard User (Group Creator &amp; Linking)</option>
                  <option value="admin">Administrator (Full Access)</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Duration (Days)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. 30 or 'lifetime'"
                  value={newDurationDays}
                  onChange={(e) => setNewDurationDays(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1.5 }}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {resetTargetUser && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.25rem'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '380px',
            border: '1.5px solid var(--wa-green)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff' }}>
                Reset Password
              </h3>
              <button
                onClick={() => setResetTargetUser(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Setting a new password for: <strong style={{ color: '#fff' }}>{resetTargetUser.username}</strong>
            </p>

            <form onSubmit={handleResetPassword}>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">New Password</label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="Enter new password (min 5 chars)"
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setResetTargetUser(null)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1.5 }}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editTargetUser && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.25rem'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '380px',
            border: '1.5px solid var(--wa-green)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff' }}>
                Edit User Details
              </h3>
              <button
                onClick={() => setEditTargetUser(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditUser}>
              <div className="form-group">
                <label className="form-label">Name</label>
                <input
                  type="text"
                  className="input-field"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  type="text"
                  className="input-field"
                  value={editPhoneNumber}
                  onChange={(e) => setEditPhoneNumber(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  type="text"
                  className="input-field"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Account Role</label>
                <select
                  className="input-field"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  style={{ cursor: 'pointer' }}
                >
                  <option value="user">Standard User</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Duration (Days remaining)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. 30 or 'lifetime'"
                  value={editDurationDays}
                  onChange={(e) => setEditDurationDays(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setEditTargetUser(null)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1.5 }}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
