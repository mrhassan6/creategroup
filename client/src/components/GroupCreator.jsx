import React, { useState, useEffect } from 'react';
import { Users, Hash, PhoneCall, ShieldAlert, Play, Sparkles, Smartphone, Type, Clock } from 'lucide-react';

export default function GroupCreator({ waStatus, isLinked, onStartCreation, disabled }) {
  const [baseName, setBaseName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [targetNumber, setTargetNumber] = useState('');
  const [delaySeconds, setDelaySeconds] = useState(12);
  const [senderNumber, setSenderNumber] = useState('');
  const [creationType, setCreationType] = useState('group');
  const [applyToAll, setApplyToAll] = useState(false);
  const [error, setError] = useState(null);

  const statuses = Array.isArray(waStatus) ? waStatus : [];
  const connectedDevices = statuses.filter(s => s.isConnected);

  useEffect(() => {
    if (connectedDevices.length > 0 && (!senderNumber || !connectedDevices.find(d => d.phoneNumber === senderNumber))) {
      setSenderNumber(connectedDevices[0].phoneNumber);
    }
  }, [connectedDevices, senderNumber]);

  // Real-time phone number normalization helper
  const getNormalizedPreview = (raw) => {
    if (!raw) return '';
    let cleaned = raw.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('00')) cleaned = cleaned.substring(2);
    if (cleaned.startsWith('03') && cleaned.length === 11) cleaned = '92' + cleaned.substring(1);
    if (cleaned.startsWith('3') && cleaned.length === 10) cleaned = '92' + cleaned;
    if (cleaned.startsWith('920') && cleaned.length === 13) cleaned = '92' + cleaned.substring(3);
    if (cleaned.startsWith('07') && cleaned.length === 11) cleaned = '44' + cleaned.substring(1);
    return cleaned;
  };

  const previewTarget = getNormalizedPreview(targetNumber);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    if (!isLinked) {
      setError('Please link your WhatsApp device first!');
      return;
    }
    if (!applyToAll && !senderNumber) {
      setError('Please select a sender device.');
      return;
    }

    onStartCreation({
      baseName: baseName.trim(),
      quantity: Math.max(1, Math.min(50, parseInt(quantity, 10) || 1)),
      targetNumber: targetNumber.trim(),
      delaySeconds: Math.max(1, parseInt(delaySeconds, 10) || 12),
      senderNumber: senderNumber,
      creationType: creationType,
      applyToAll,
      connectedDevices
    });
  };

  return (
    <div className="glass-panel" style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
        <div style={{
          width: '34px',
          height: '34px',
          borderRadius: '8px',
          background: 'rgba(37, 211, 102, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid rgba(37, 211, 102, 0.3)'
        }}>
          <Users size={18} color="var(--wa-green)" />
        </div>
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>
            Creation Agent
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Configure details for automated creation
          </p>
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#fca5a5', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)',
          fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem'
        }}>
          <ShieldAlert size={16} /><span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Sender Device Selection */}
        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label">
              <span>Sender Device</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={applyToAll}
                onChange={(e) => setApplyToAll(e.target.checked)}
                disabled={disabled || !isLinked || connectedDevices.length === 0}
                style={{ accentColor: 'var(--wa-green)' }}
              />
              Apply to all paired numbers
            </label>
          </div>
          <div style={{ position: 'relative', opacity: applyToAll ? 0.5 : 1, transition: 'opacity 0.2s' }}>
            <select
              className="input-field"
              style={{ width: '100%', paddingLeft: '2.5rem', appearance: 'none', backgroundColor: 'rgba(0,0,0,0.2)' }}
              value={applyToAll ? '' : senderNumber}
              onChange={(e) => setSenderNumber(e.target.value)}
              required={!applyToAll}
              disabled={disabled || !isLinked || applyToAll}
            >
              <option value="" disabled>{applyToAll ? `Using all ${connectedDevices.length} connected devices` : 'Select a connected device'}</option>
              {connectedDevices.map(device => (
                <option key={device.phoneNumber} value={device.phoneNumber}>
                  +{device.phoneNumber}
                </option>
              ))}
            </select>
            <Smartphone size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          </div>
        </div>

        {/* Creation Type Selection */}
        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label className="form-label">
            <span>Creation Type</span>
          </label>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name="creationType"
                value="group"
                checked={creationType === 'group'}
                onChange={() => setCreationType('group')}
                disabled={disabled || !isLinked}
              />
              <span>WhatsApp Group</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name="creationType"
                value="community"
                checked={creationType === 'community'}
                onChange={() => setCreationType('community')}
                disabled={disabled || !isLinked}
              />
              <span>WhatsApp Community</span>
            </label>
          </div>
        </div>

        {/* Base Name */}
        <div className="form-group">
          <label className="form-label">
            <span>{creationType === 'group' ? 'Group' : 'Community'} Name / Base Subject</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {quantity > 1 ? `Will be: "${baseName || (creationType === 'group' ? 'Group' : 'Community')} #1", "#2"...` : ''}
            </span>
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              maxLength={75}
              className="input-field"
              style={{ width: '100%', paddingLeft: '2.5rem' }}
              placeholder={creationType === 'group' ? "e.g. VIP Club 2026" : "e.g. Tech Community"}
              value={baseName}
              onChange={(e) => setBaseName(e.target.value)}
              required
              disabled={disabled || !isLinked}
            />
            <Type size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          </div>
        </div>

        {/* Quantity and Target Number Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '0.85rem' }}>
          {/* Quantity */}
          <div className="form-group">
            <label className="form-label">
              <span>Quantity</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                min="1"
                max="50"
                className="input-field"
                style={{ width: '100%', paddingLeft: '2.5rem' }}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                disabled={disabled || !isLinked}
              />
              <Hash size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            </div>
          </div>

          {/* Target Member Phone Number */}
          <div className="form-group">
            <label className="form-label">
              <span>Member to Add</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="tel"
                className="input-field"
                style={{ width: '100%', paddingLeft: '2.5rem' }}
                placeholder="e.g. 923256540880"
                value={targetNumber}
                onChange={(e) => setTargetNumber(e.target.value)}
                required
                disabled={disabled || !isLinked}
              />
              <PhoneCall size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            </div>
            {previewTarget && previewTarget !== targetNumber && (
              <div style={{ fontSize: '0.74rem', color: 'var(--wa-green)', marginTop: '2px' }}>
                Normalized: <strong>+{previewTarget}</strong>
              </div>
            )}
          </div>
        </div>

        {/* Anti-Ban Cooldown Delay Setting */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.85rem 1rem',
          margin: '0.75rem 0 1.25rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldAlert size={16} color="var(--warning)" />
              Anti-Detection Interval Delay (Seconds):
            </span>
          </div>

          <div style={{ position: 'relative' }}>
            <input
              type="number"
              min="1"
              className="input-field"
              style={{ width: '100%', paddingLeft: '2.5rem', accentColor: 'var(--wa-green)' }}
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(e.target.value)}
              required
              disabled={disabled || !isLinked}
            />
            <Clock size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            <span>Recommended minimum: 12 seconds for safety.</span>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: '100%', padding: '0.95rem' }}
          disabled={disabled || !isLinked || (!applyToAll && !senderNumber)}
        >
          <Play size={18} fill="#032512" />
          <span>Launch Creation Agent</span>
        </button>

        {!isLinked && (
          <div style={{ textAlign: 'center', fontSize: '0.78rem', color: '#fbbf24', marginTop: '0.75rem' }}>
            Please link at least one WhatsApp companion phone number first.
          </div>
        )}
      </form>
    </div>
  );
}
