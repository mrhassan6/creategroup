import React from 'react';
import { ShieldAlert, LogOut, X, Lock } from 'lucide-react';

export default function AdminSidebar({
  isOpen,
  onClose,
  activeTab,
  onSelectTab,
  user,
  onLogout
}) {
  if (!isOpen) return null;

  const menuItems = [
    {
      id: 'admin',
      label: 'User Management',
      icon: ShieldAlert,
      badge: 'Admin',
      badgeClass: 'pairing'
    }
  ];

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      display: 'flex'
    }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          transition: 'opacity 0.25s ease'
        }}
      />

      {/* Drawer */}
      <div style={{
        position: 'relative',
        width: '82%',
        maxWidth: '320px',
        height: '100%',
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '10px 0 35px rgba(0, 0, 0, 0.7)',
        zIndex: 101,
        animation: 'slideInLeft 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        {/* Drawer Header */}
        <div style={{
          padding: '1.25rem',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #a855f7, #6366f1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ShieldAlert size={18} color="#fff" strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#fff' }}>GC Admin</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Pro Edition</div>
            </div>
          </div>

          <button
            onClick={onClose}
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

        {/* User Card */}
        <div style={{
          padding: '1.25rem',
          background: 'rgba(255, 255, 255, 0.02)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '1.1rem',
            color: '#fff',
            boxShadow: '0 0 15px rgba(168, 85, 247, 0.3)'
          }}>
            {user?.username?.charAt(0).toUpperCase() || 'A'}
          </div>

          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {user?.username}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <span style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: '1px 6px',
                borderRadius: '4px',
                background: 'rgba(168, 85, 247, 0.2)',
                color: '#c084fc',
                border: '1px solid rgba(168, 85, 247, 0.3)'
              }}>
                ADMIN
              </span>
            </div>
          </div>
        </div>

        {/* Menu Navigation */}
        <div style={{ padding: '1rem 0.75rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isSelected = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  onClose();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.8rem 0.95rem',
                  borderRadius: 'var(--radius-sm)',
                  border: isSelected ? '1px solid #c084fc' : '1px solid transparent',
                  background: isSelected ? 'rgba(168, 85, 247, 0.12)' : 'transparent',
                  color: isSelected ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: isSelected ? 700 : 500,
                  fontSize: '0.92rem',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Icon size={18} color={isSelected ? '#c084fc' : 'var(--text-muted)'} />
                  <span>{item.label}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Security Info Card */}
        <div style={{
          margin: '0.75rem',
          padding: '0.85rem',
          borderRadius: 'var(--radius-sm)',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-color)',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-primary)', fontWeight: 600 }}>
            <Lock size={12} color="#c084fc" />
            <span>Admin Restricted Area</span>
          </div>
          <div>All actions are strictly monitored.</div>
        </div>

        {/* Logout Button */}
        <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)' }}>
          <button
            onClick={onLogout}
            className="btn btn-danger"
            style={{ width: '100%', padding: '0.75rem', fontSize: '0.88rem' }}
          >
            <LogOut size={16} />
            <span>Log Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
