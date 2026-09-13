import React from 'react';
import { Menu, LogOut, Smartphone, ShieldCheck } from 'lucide-react';

export default function Navbar({ user, waStatus, onOpenSidebar, activeTab }) {
  const getTabTitle = (tab) => {
    switch (tab) {
      case 'link': return 'WhatsApp Link';
      case 'create': return 'Group Creator';
      case 'history': return 'Group History';
      case 'admin': return 'Admin Panel';
      default: return 'GC Agent';
    }
  };

  return (
    <header style={{
      padding: '0.85rem 1.15rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottom: '1px solid var(--border-color)',
      background: 'rgba(10, 14, 20, 0.88)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      backdropFilter: 'blur(16px)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        {user && (
          <button
            onClick={onOpenSidebar}
            title="Open Menu"
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              borderRadius: '8px',
              padding: '0.5rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Menu size={20} />
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '9px',
            background: 'linear-gradient(135deg, var(--wa-green) 0%, var(--wa-dark-green) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 12px rgba(37, 211, 102, 0.35)'
          }}>
            <Smartphone size={19} color="#032512" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontSize: '0.98rem', fontWeight: 800, letterSpacing: '-0.01em', color: '#fff' }}>
              {user ? getTabTitle(activeTab) : 'GC Agent'}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              {user?.role === 'admin' ? 'Admin Access' : 'Single-Device Protected'}
            </div>
          </div>
        </div>
      </div>

      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            background: 'rgba(255, 255, 255, 0.04)',
            padding: '0.35rem 0.65rem',
            borderRadius: 'var(--radius-full)',
            border: '1px solid var(--border-color)'
          }}>
            <span className={`pulse-dot ${Array.isArray(waStatus) && waStatus.some(s => s.isConnected) ? 'green' : 'amber'}`}></span>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: Array.isArray(waStatus) && waStatus.some(s => s.isConnected) ? '#34d399' : '#fbbf24' }}>
              {Array.isArray(waStatus) && waStatus.some(s => s.isConnected) ? 'Linked' : 'Offline'}
            </span>
          </div>
        </div>
      )}
    </header>
  );
}
