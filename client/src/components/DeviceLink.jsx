import React, { useState, useEffect } from 'react';
import { api } from '../api';
import {
  Smartphone,
  Copy,
  Check,
  RefreshCw,
  Unlink,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  Clock,
  ArrowRight
} from 'lucide-react';

export default function DeviceLink({ waStatus, onStatusChange }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pairingCode, setPairingCode] = useState(waStatus?.pairingCode || null);
  const [linkedNumber, setLinkedNumber] = useState(waStatus?.phoneNumber || null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const [timeLeft, setTimeLeft] = useState(120);

  // Poll status every 2 seconds while waiting for user to enter code
  useEffect(() => {
    let interval = null;
    if (pairingCode && !waStatus?.isConnected) {
      interval = setInterval(async () => {
        try {
          const status = await api.getWhatsAppStatus();
          onStatusChange(status);
          if (status.isConnected) {
            clearInterval(interval);
          }
        } catch (e) {}
      }, 2500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [pairingCode, waStatus?.isConnected]);

  // Expiration countdown timer for pairing code
  useEffect(() => {
    let timer = null;
    if (pairingCode && !waStatus?.isConnected && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [pairingCode, waStatus?.isConnected, timeLeft]);

  const handleGetCode = async (e) => {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.requestPairingCode(phoneNumber);
      if (res.pairingCode) {
        setPairingCode(res.pairingCode);
        setLinkedNumber(res.normalizedNumber);
        setTimeLeft(120);
      }
      const updatedStatus = await api.getWhatsAppStatus();
      onStatusChange(updatedStatus);
    } catch (err) {
      setError(err.message || 'Failed to generate pairing code');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!pairingCode) return;
    const clean = pairingCode.replace(/[^A-Za-z0-9]/g, '');
    
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(clean);
    } else {
      // Fallback for non-HTTPS (HTTP) environments like local VPS IPs
      const textArea = document.createElement("textarea");
      textArea.value = clean;
      
      // Move out of screen
      textArea.style.position = "absolute";
      textArea.style.left = "-999999px";
      
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
      } catch (err) {
        console.error('Failed to copy', err);
      }
      document.body.removeChild(textArea);
    }
    
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUnlink = async () => {
    if (!window.confirm('Are you sure you want to unlink your WhatsApp companion device?')) return;
    setLoading(true);
    try {
      await api.unlinkDevice();
      setPairingCode(null);
      const updatedStatus = await api.getWhatsAppStatus();
      onStatusChange(updatedStatus);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Preview formatted number
  const getPreviewNumber = (raw) => {
    let cleaned = raw.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('00')) cleaned = cleaned.substring(2);
    if (cleaned.startsWith('03') && cleaned.length === 11) cleaned = '92' + cleaned.substring(1);
    if (cleaned.startsWith('3') && cleaned.length === 10) cleaned = '92' + cleaned;
    if (cleaned.startsWith('920') && cleaned.length === 13) cleaned = '92' + cleaned.substring(3);
    return cleaned;
  };

  const preview = getPreviewNumber(phoneNumber);

  if (waStatus?.isConnected) {
    return (
      <div className="glass-panel" style={{ marginBottom: '1.5rem', borderColor: 'var(--border-glow)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              boxShadow: '0 0 15px rgba(16, 185, 129, 0.2)'
            }}>
              <CheckCircle2 size={24} color="#34d399" />
            </div>
            <div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>
                WhatsApp Linked &amp; Ready
              </div>
              <div style={{ fontSize: '0.82rem', color: '#34d399', fontWeight: 600 }}>
                +{waStatus.phoneNumber || 'Active Account'}
              </div>
            </div>
          </div>

          <span className="status-badge connected">
            <span className="pulse-dot green"></span>
            Online
          </span>
        </div>

        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.85rem 1rem',
          fontSize: '0.85rem',
          color: 'var(--text-secondary)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>Multi-Device Companion Session Active</span>
          <button
            onClick={handleUnlink}
            disabled={loading}
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#f87171',
              borderRadius: '6px',
              padding: '0.35rem 0.75rem',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <Unlink size={13} />
            Unlink
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>
            Link WhatsApp Companion
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Link via official 8-digit Pairing Code (no QR scanner required)
          </p>
        </div>
        <span className="status-badge unlinked">
          <span className="pulse-dot amber"></span>
          Not Linked
        </span>
      </div>

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
          marginBottom: '1rem'
        }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {!pairingCode ? (
        <form onSubmit={handleGetCode}>
          <div className="form-group">
            <label className="form-label">
              <span>Your WhatsApp Phone Number</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Include Country Code</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="tel"
                className="input-field"
                style={{ width: '100%', paddingLeft: '2.6rem' }}
                placeholder="e.g. 923256540880 or 14155552671"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
              />
              <Smartphone size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            </div>

            {preview && preview !== phoneNumber && (
              <div style={{ fontSize: '0.76rem', color: 'var(--wa-green)', marginTop: '4px' }}>
                Normalized format: <strong>+{preview}</strong>
              </div>
            )}

            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '1.4' }}>
              Examples: Pakistan (92325...), US (+1...), UK (+44...), India (+91...)
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.5rem' }}
            disabled={loading}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <RefreshCw size={18} className="animate-spin" /> Generating Code...
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>Get 8-Digit Pairing Code</span>
                <ArrowRight size={18} />
              </span>
            )}
          </button>
        </form>
      ) : (
        <div>
          <div className="code-display-box">
            <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
              Enter this code in WhatsApp
            </div>
            <div className="code-text">{pairingCode}</div>

            {linkedNumber && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                Generated for: <strong style={{ color: '#fff' }}>+{linkedNumber}</strong>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCopy}
                style={{ padding: '0.45rem 1.25rem', fontSize: '0.85rem' }}
              >
                {copied ? (
                  <>
                    <Check size={16} color="#34d399" />
                    <span style={{ color: '#34d399' }}>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    <span>Copy Code</span>
                  </>
                )}
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleGetCode()}
                disabled={loading}
                style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                <span>New Code</span>
              </button>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              fontSize: '0.75rem',
              color: timeLeft < 30 ? '#f87171' : 'var(--text-muted)',
              marginTop: '0.75rem'
            }}>
              <Clock size={13} />
              <span>Expires in {timeLeft}s</span>
            </div>
          </div>

          {/* Exact Steps Guide */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            padding: '1rem',
            fontSize: '0.85rem'
          }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <HelpCircle size={16} color="var(--wa-green)" />
              Steps to Link on WhatsApp:
            </div>
            <ol style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)', lineHeight: '1.7' }}>
              <li>Open <strong>WhatsApp</strong> on your phone (number <strong>+{linkedNumber || preview}</strong>).</li>
              <li>Tap <strong>Settings</strong> (or ⋮ three dots) &gt; <strong>Linked Devices</strong>.</li>
              <li>Tap <strong>Link a device</strong>.</li>
              <li>Look at the bottom of the scanner screen and tap <strong>"Link with phone number instead"</strong>.</li>
              <li>Type the 8 characters: <strong style={{ color: 'var(--wa-green)' }}>{pairingCode}</strong>.</li>
            </ol>
            <div style={{
              marginTop: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.78rem',
              color: '#34d399'
            }}>
              <span className="pulse-dot green"></span>
              Waiting for you to enter code... Once entered, this screen will instantly transition to Connected!
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
            <button
              type="button"
              onClick={() => {
                setPairingCode(null);
                setTimeLeft(120);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '0.8rem',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              Change Phone Number
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
