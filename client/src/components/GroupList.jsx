import React, { useState } from 'react';
import { Layers, Copy, Check, ExternalLink, RefreshCw } from 'lucide-react';

export default function GroupList({ groups, onRefresh, loading }) {
  const [copiedId, setCopiedId] = useState(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const copyToClipboard = (text) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text);
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "absolute";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
      } catch (err) {}
      document.body.removeChild(textArea);
    }
  };

  const handleCopy = (id, link) => {
    if (!link) return;
    copyToClipboard(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAll = () => {
    const successfulGroups = groups.filter((g) => g.inviteLink);
    if (successfulGroups.length === 0) return;

    const linksText = successfulGroups
      .map((g, index) => `${index + 1}. ${g.inviteLink}`)
      .join('\n\n');

    copyToClipboard(linksText);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  return (
    <div className="glass-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={18} color="var(--accent-cyan)" />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>
            History ({groups.length})
          </h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {groups.filter(g => g.inviteLink).length > 0 && (
            <button
              onClick={handleCopyAll}
              className="btn btn-secondary"
              style={{
                padding: '0.35rem 0.6rem',
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              {copiedAll ? <Check size={13} color="#34d399" /> : <Copy size={13} />}
              {copiedAll ? 'Copied!' : 'Copy All Links'}
            </button>
          )}

          <button
            onClick={onRefresh}
            disabled={loading}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.78rem'
            }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {groups.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '2rem 1rem',
          color: 'var(--text-muted)',
          fontSize: '0.85rem'
        }}>
          No groups created yet. Launch your first group creation above!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '320px', overflowY: 'auto', paddingRight: '4px' }}>
          {groups.map((g) => (
            <div
              key={g.id}
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.75rem 0.85rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.88rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {g.groupName}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Target: +{g.targetNumber} • {new Date(g.createdAt).toLocaleDateString()}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                {g.inviteLink ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleCopy(g.id, g.inviteLink)}
                      className="btn btn-secondary"
                      style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
                      title="Copy Invite Link"
                    >
                      {copiedId === g.id ? <Check size={13} color="#34d399" /> : <Copy size={13} />}
                    </button>
                    <a
                      href={g.inviteLink}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-primary"
                      style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
                      title="Open in WhatsApp"
                    >
                      <ExternalLink size={13} />
                    </a>
                  </>
                ) : (
                  <span style={{ fontSize: '0.72rem', color: '#f87171' }}>Failed</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
