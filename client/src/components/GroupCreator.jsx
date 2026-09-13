import React, { useState } from 'react';
import { Users, Hash, PhoneCall, ShieldAlert, Play, Sparkles } from 'lucide-react';

export default function GroupCreator({ isLinked, onStartCreation, disabled }) {
  const [baseName, setBaseName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [targetNumber, setTargetNumber] = useState('');
  const [delaySeconds, setDelaySeconds] = useState(12);

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
    if (!isLinked) {
      alert('Please link your WhatsApp device first!');
      return;
    }

    onStartCreation({
      baseName: baseName.trim(),
      quantity: Math.max(1, Math.min(50, parseInt(quantity, 10) || 1)),
      targetNumber: targetNumber.trim(),
      delaySeconds: Math.max(1, Math.min(60, parseInt(delaySeconds, 10) || 12))
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
            Group Creation Agent
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Configure group details and quantity for automated creation
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Group Base Name */}
        <div className="form-group">
          <label className="form-label">
            <span>Group Name / Base Subject</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {quantity > 1 ? `Will be: "${baseName || 'Group'} #1", "#2"...` : ''}
            </span>
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              maxLength={75}
              className="input-field"
              style={{ width: '100%', paddingLeft: '2.5rem' }}
              placeholder="e.g. VIP Club 2026"
              value={baseName}
              onChange={(e) => setBaseName(e.target.value)}
              required
              disabled={disabled || !isLinked}
            />
            <Users size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
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
              Anti-Detection Interval Delay:
            </span>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--wa-green)' }}>
              {delaySeconds} seconds
            </span>
          </div>

          <input
            type="range"
            min="1"
            max="35"
            step="1"
            value={delaySeconds}
            onChange={(e) => setDelaySeconds(e.target.value)}
            style={{ width: '100%', accentColor: 'var(--wa-green)', cursor: 'pointer' }}
            disabled={disabled || !isLinked}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            <span>1s (Risk of Ban)</span>
            <span>12-15s (Recommended Safe)</span>
            <span>35s (Ultra Safe)</span>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: '100%', padding: '0.95rem' }}
          disabled={disabled || !isLinked}
        >
          <Play size={18} fill="#032512" />
          <span>Launch Group Creation Agent</span>
        </button>

        {!isLinked && (
          <div style={{ textAlign: 'center', fontSize: '0.78rem', color: '#fbbf24', marginTop: '0.75rem' }}>
            Please link your WhatsApp companion phone number first.
          </div>
        )}
      </form>
    </div>
  );
}
