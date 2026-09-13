import React, { useState } from 'react';
import { api, clearStoredToken } from '../api';
import {
  KeyRound,
  User,
  ArrowRight,
  ShieldAlert,
  AlertCircle,
  Lock,
  Smartphone
} from 'lucide-react';

export default function AdminAuthModal({ onLoginSuccess, terminationNotice }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.login(username, password);
      if (res.user.role !== 'admin') {
        clearStoredToken();
        throw new Error('Access Denied. Administrator privileges required.');
      }
      onLoginSuccess(res.user);
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      padding: '2rem 1.5rem',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      minHeight: '85vh',
      position: 'relative'
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{
          width: '68px',
          height: '68px',
          borderRadius: '20px',
          background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(99, 102, 241, 0.35) 100%)',
          border: '1.5px solid #a855f7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.25rem',
          boxShadow: '0 0 30px rgba(168, 85, 247, 0.3)'
        }}>
          <ShieldAlert size={38} color="#c084fc" />
        </div>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 800, marginBottom: '0.4rem', color: '#fff' }}>
          GC Admin Portal
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Restricted Access Control Panel
        </p>
      </div>

      {/* Single Device Termination Notice Banner */}
      {terminationNotice && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.18)',
          border: '1.5px solid rgba(239, 68, 68, 0.45)',
          color: '#fca5a5',
          padding: '0.9rem 1rem',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.86rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          marginBottom: '1.5rem',
          boxShadow: 'var(--shadow-danger)'
        }}>
          <Smartphone size={20} color="#f87171" style={{ flexShrink: 0 }} />
          <span>{terminationNotice}</span>
        </div>
      )}

      {/* Login Card */}
      <div className="glass-panel" style={{ padding: '1.75rem', borderColor: 'rgba(168, 85, 247, 0.3)' }}>
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
            gap: '0.5rem',
            marginBottom: '1.25rem'
          }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">
              <span>Admin Username</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="input-field"
                style={{ width: '100%', paddingLeft: '2.6rem', borderColor: 'rgba(168, 85, 247, 0.4)' }}
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />
              <User size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.75rem' }}>
            <label className="form-label">
              <span>Admin Password</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                className="input-field"
                style={{ width: '100%', paddingLeft: '2.6rem', borderColor: 'rgba(168, 85, 247, 0.4)' }}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <KeyRound size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.95rem', background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)', borderColor: '#a855f7' }}
            disabled={loading}
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>Secure Log In</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
        
        <div style={{
          marginTop: '1.5rem',
          paddingTop: '1.25rem',
          borderTop: '1px solid var(--border-color)',
          textAlign: 'center',
          fontSize: '0.88rem',
          color: 'var(--text-secondary)'
        }}>
          <a href="/" style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}>Back to User Login</a>
        </div>
      </div>

      {/* Security Footer Notice */}
      <div style={{
        marginTop: '1.5rem',
        textAlign: 'center',
        fontSize: '0.74rem',
        color: 'var(--text-muted)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '5px'
      }}>
        <Lock size={12} />
        <span>Admin Restricted Portal &bull; Audited Session</span>
      </div>
    </div>
  );
}
