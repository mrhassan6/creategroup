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
  ArrowRight,
  Plus
} from 'lucide-react';

export default function DeviceLink({ waStatus, onStatusChange }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pairingCode, setPairingCode] = useState(null);
  const [linkedNumber, setLinkedNumber] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const [timeLeft, setTimeLeft] = useState(120);
  const [showAddForm, setShowAddForm] = useState(false);

  const statuses = Array.isArray(waStatus) ? waStatus : [];
  const connectedCount = statuses.length;

  useEffect(() => {
    let interval = null;
    if (pairingCode && timeLeft > 0) {
      interval = setInterval(async () => {
        try {
          const status = await api.getWhatsAppStatus();
          onStatusChange(status);
          const currentPairing = status.find(s => s.phoneNumber === linkedNumber);
          if (currentPairing?.isConnected) {
            setPairingCode(null);
            setShowAddForm(false);
            clearInterval(interval);
          }
        } catch (e) {}
      }, 2500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [pairingCode, linkedNumber, timeLeft]);

  useEffect(() => {
    let timer = null;
    if (pairingCode && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (timeLeft <= 0) {
      setPairingCode(null);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [pairingCode, timeLeft]);

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
      const textArea = document.createElement("textarea");
      textArea.value = clean;
      textArea.style.position = "absolute";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.select();
      try { document.execCommand('copy'); } catch (err) {}
      document.body.removeChild(textArea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUnlink = async (phone) => {
    if (!window.confirm(`Are you sure you want to unlink +${phone}?`)) return;
    setLoading(true);
    try {
      await api.unlinkDevice(phone);
      if (linkedNumber === phone) setPairingCode(null);
      const updatedStatus = await api.getWhatsAppStatus();
      onStatusChange(updatedStatus);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getPreviewNumber = (raw) => {
    let cleaned = raw.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('00')) cleaned = cleaned.substring(2);
    if (cleaned.startsWith('03') && cleaned.length === 11) cleaned = '92' + cleaned.substring(1);
    if (cleaned.startsWith('3') && cleaned.length === 10) cleaned = '92' + cleaned;
    if (cleaned.startsWith('920') && cleaned.length === 13) cleaned = '92' + cleaned.substring(3);
    return cleaned;
  };
  const preview = getPreviewNumber(phoneNumber);

  return (
    <div className="glass-panel" style={{ marginBottom: '1.5rem', borderColor: 'var(--border-glow)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>Linked Devices</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Manage up to 5 WhatsApp companion devices.
          </p>
        </div>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: connectedCount >= 5 ? '#f87171' : 'var(--wa-green)' }}>
          {connectedCount} / 5 Linked
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#fca5a5', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)',
          fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem'
        }}>
          <AlertCircle size={16} /><span>{error}</span>
        </div>
      )}

      {/* List of Connected Devices */}
      {statuses.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {statuses.map(status => (
            <div key={status.phoneNumber} style={{
              background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)', padding: '0.85rem 1rem', display: 'flex',
              justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: status.isConnected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(251, 191, 36, 0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `1px solid ${status.isConnected ? 'rgba(16, 185, 129, 0.4)' : 'rgba(251, 191, 36, 0.4)'}`
                }}>
                  <Smartphone size={18} color={status.isConnected ? "#34d399" : "#fbbf24"} />
                </div>
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#fff' }}>
                    +{status.phoneNumber}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: status.isConnected ? '#34d399' : '#fbbf24' }}>
                    {status.isConnected ? 'Online' : status.status === 'connecting' ? 'Connecting...' : 'Offline'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleUnlink(status.phoneNumber)}
                disabled={loading}
                style={{
                  background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: '#f87171', borderRadius: '6px', padding: '0.35rem 0.75rem',
                  fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', display: 'flex', gap: '5px'
                }}
              >
                <Unlink size={13} /> Unlink
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add New Device Form */}
      {(!pairingCode && connectedCount < 5) && (
        <>
          {!showAddForm ? (
            <button
              onClick={() => setShowAddForm(true)}
              className="btn btn-secondary"
              style={{ width: '100%', padding: '0.85rem', display: 'flex', gap: '8px', justifyContent: 'center' }}
            >
              <Plus size={18} /> Link New Device
            </button>
          ) : (
            <form onSubmit={handleGetCode} style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div className="form-group">
                <label className="form-label">
                  <span>WhatsApp Phone Number</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Include Country Code</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="tel" className="input-field" style={{ width: '100%', paddingLeft: '2.6rem' }}
                    placeholder="e.g. 923256540880" value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)} required
                  />
                  <Smartphone size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                </div>
                {preview && preview !== phoneNumber && (
                  <div style={{ fontSize: '0.76rem', color: 'var(--wa-green)', marginTop: '4px' }}>
                    Normalized format: <strong>+{preview}</strong>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowAddForm(false)} className="btn btn-secondary" style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={loading}>
                  {loading ? 'Generating Code...' : 'Get Pairing Code'}
                </button>
              </div>
            </form>
          )}
        </>
      )}

      {/* Pairing Code Display */}
      {pairingCode && (
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
              <button type="button" className="btn btn-secondary" onClick={handleCopy} style={{ padding: '0.45rem 1.25rem', fontSize: '0.85rem' }}>
                {copied ? <><Check size={16} color="#34d399" /> <span style={{ color: '#34d399' }}>Copied!</span></> : <><Copy size={16} /> <span>Copy Code</span></>}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => handleGetCode()} disabled={loading} style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}>
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> <span>New Code</span>
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', fontSize: '0.75rem', color: timeLeft < 30 ? '#f87171' : 'var(--text-muted)', marginTop: '0.75rem' }}>
              <Clock size={13} /> <span>Expires in {timeLeft}s</span>
            </div>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '1rem', fontSize: '0.85rem' }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <HelpCircle size={16} color="var(--wa-green)" /> Steps to Link:
            </div>
            <ol style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)', lineHeight: '1.7' }}>
              <li>Open <strong>WhatsApp</strong> on your phone (+{linkedNumber}).</li>
              <li>Tap <strong>Settings</strong> &gt; <strong>Linked Devices</strong> &gt; <strong>Link a device</strong>.</li>
              <li>Tap <strong>"Link with phone number instead"</strong>.</li>
              <li>Type the code: <strong style={{ color: 'var(--wa-green)' }}>{pairingCode}</strong>.</li>
            </ol>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
            <button type="button" onClick={() => { setPairingCode(null); setTimeLeft(120); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
