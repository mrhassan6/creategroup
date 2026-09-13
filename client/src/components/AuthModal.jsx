import React, { useState } from 'react';
import { api } from '../api';
import {
  KeyRound,
  User,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Phone,
  MessageCircle,
  X,
  Lock,
  Smartphone
} from 'lucide-react';

export default function AuthModal({ onLoginSuccess, terminationNotice }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showContactModal, setShowContactModal] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.login(username, password);
      if (res.user.role === 'admin') {
        window.location.href = '/admin';
        return;
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
          background: 'linear-gradient(135deg, rgba(37, 211, 102, 0.2) 0%, rgba(18, 140, 126, 0.35) 100%)',
          border: '1.5px solid var(--wa-green)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.25rem',
          boxShadow: '0 0 30px rgba(37, 211, 102, 0.3)'
        }}>
          <ShieldCheck size={38} color="#25D366" />
        </div>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 800, marginBottom: '0.4rem', color: '#fff' }}>
          GC Agent
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          WhatsApp Automation Pro &amp; Multi-Device Companion
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
      <div className="glass-panel" style={{ padding: '1.75rem' }}>
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
              <span>Username</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="input-field"
                style={{ width: '100%', paddingLeft: '2.6rem' }}
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
              <span>Password</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                className="input-field"
                style={{ width: '100%', paddingLeft: '2.6rem' }}
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
            style={{ width: '100%', padding: '0.95rem' }}
            disabled={loading}
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>Log In</span>
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
          Don't have an account?{' '}
          <button
            type="button"
            onClick={() => setShowContactModal(true)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--wa-green)',
              fontWeight: 700,
              cursor: 'pointer',
              marginLeft: '4px',
              textDecoration: 'underline'
            }}
          >
            Sign Up
          </button>
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
        <span>Single-Device Protected &bull; Encrypted Session</span>
      </div>

      {/* POPUP MODAL: Contact Mr. Hassan */}
      {showContactModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(10px)',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.25rem'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '420px',
            border: '1.5px solid var(--wa-green)',
            boxShadow: '0 0 40px rgba(37, 211, 102, 0.3)',
            animation: 'fadeIn 0.25s ease'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={22} color="var(--wa-green)" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff' }}>
                  Account Registration
                </h3>
              </div>
              <button
                onClick={() => setShowContactModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{
              background: 'rgba(37, 211, 102, 0.08)',
              border: '1px dashed var(--wa-green)',
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
              textAlign: 'center',
              marginBottom: '1.25rem'
            }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                Self-registration is closed. To get your account login, please contact:
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>
                Mr. Hassan
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--wa-green)', marginTop: '4px', letterSpacing: '0.05em' }}>
                +92 310 7612528
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* WhatsApp Direct Chat Button */}
              <a
                href="https://wa.me/923107612528?text=Hello%20Mr.%20Hassan,%20I%20want%20to%20get%20login%20access%20for%20GC%20Agent"
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.85rem' }}
              >
                <MessageCircle size={18} fill="#032512" />
                <span>Chat with Mr. Hassan on WhatsApp</span>
              </a>

              {/* Direct Phone Call Button */}
              <a
                href="tel:+923107612528"
                className="btn btn-secondary"
                style={{ width: '100%', padding: '0.85rem' }}
              >
                <Phone size={18} />
                <span>Call +92 310 7612528</span>
              </a>

              <button
                type="button"
                onClick={() => setShowContactModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  marginTop: '0.25rem',
                  textDecoration: 'underline'
                }}
              >
                Back to Login
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
