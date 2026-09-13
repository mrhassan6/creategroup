import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Loader2,
  Share2
} from 'lucide-react';

export default function ExecutionMonitor({ job, onReset, onStop }) {
  const [copiedId, setCopiedId] = useState(null);

  if (!job) return null;

  const total = job.total || 1;
  const current = job.current || 0;
  const percent = Math.min(100, Math.round((current / total) * 100));

  const handleCopyLink = (id, link) => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="glass-panel" style={{ marginBottom: '1.5rem', border: '1px solid var(--border-glow)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {job.isComplete ? (
            <CheckCircle2 size={22} color="#34d399" />
          ) : (
            <Loader2 size={22} color="var(--wa-green)" className="animate-spin" />
          )}
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
            {job.isComplete ? 'Group Creation Complete' : 'Agent In Action'}
          </h3>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {!job.isComplete && onStop && (
            <button
              onClick={onStop}
              className="btn btn-secondary"
              style={{
                color: '#f87171',
                borderColor: 'rgba(248, 113, 113, 0.3)',
                padding: '0.2rem 0.6rem',
                fontSize: '0.75rem',
                height: 'auto',
                minHeight: '0'
              }}
            >
              Stop
            </button>
          )}
          <span className={`status-badge ${job.isComplete ? 'connected' : 'pairing'}`}>
            {job.isComplete ? 'Finished' : `${current} / ${total}`}
          </span>
        </div>
      </div>

      {/* Progress Track */}
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${percent}%` }}></div>
      </div>

      {/* Live Status Message */}
      <div style={{
        background: 'rgba(0, 0, 0, 0.3)',
        borderRadius: 'var(--radius-sm)',
        padding: '0.75rem 1rem',
        fontSize: '0.85rem',
        color: job.isComplete ? '#34d399' : 'var(--text-primary)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '1.25rem'
      }}>
        {!job.isComplete && <span className="pulse-dot green"></span>}
        <span>{job.message || 'Processing groups...'}</span>
      </div>

      {/* Created Groups List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          Generated Groups &amp; Links:
        </div>

        {job.results?.length === 0 && (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
            Creating the first group, please wait...
          </div>
        )}

        {job.results?.map((group, idx) => (
          <div
            key={group.id || idx}
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.85rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.92rem' }}>
                {group.groupName}
              </div>
              <span style={{
                fontSize: '0.75rem',
                color: group.status === 'created' ? '#34d399' : '#f87171',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                {group.status === 'created' ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                {group.status === 'created' ? 'Created' : 'Failed'}
              </span>
            </div>

            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Added: +{group.targetNumber}
            </div>

            {group.inviteLink && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                <input
                  type="text"
                  readOnly
                  value={group.inviteLink}
                  style={{
                    flex: 1,
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    color: 'var(--wa-green)',
                    fontSize: '0.75rem',
                    padding: '0.35rem 0.6rem',
                    fontFamily: 'monospace'
                  }}
                />

                <button
                  type="button"
                  onClick={() => handleCopyLink(group.id || idx, group.inviteLink)}
                  className="btn btn-secondary"
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                >
                  {copiedId === (group.id || idx) ? (
                    <Check size={14} color="#34d399" />
                  ) : (
                    <Copy size={14} />
                  )}
                  <span>{copiedId === (group.id || idx) ? 'Copied' : 'Copy'}</span>
                </button>

                <a
                  href={group.inviteLink}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary"
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                >
                  <ExternalLink size={14} />
                  <span>Open</span>
                </a>
              </div>
            )}
          </div>
        ))}
      </div>

      {job.isComplete && (
        <button
          onClick={onReset}
          className="btn btn-secondary"
          style={{ width: '100%', marginTop: '1.25rem' }}
        >
          Create More Groups
        </button>
      )}
    </div>
  );
}
