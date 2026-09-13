import React, { useState, useEffect } from 'react';
import { api, getStoredToken, clearStoredToken } from '../api';
import AdminAuthModal from './AdminAuthModal';
import AdminSidebar from './AdminSidebar';
import AdminPanel from './AdminPanel';
import { Menu, ShieldAlert } from 'lucide-react';

export default function AdminApp() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [terminationNotice, setTerminationNotice] = useState(null);

  // Check login on startup
  useEffect(() => {
    async function checkAuth() {
      const token = getStoredToken();
      if (!token) {
        setAuthLoading(false);
        return;
      }
      try {
        const userData = await api.getMe();
        if (userData.role !== 'admin') {
          throw new Error('Not an admin');
        }
        setUser(userData);
      } catch (err) {
        clearStoredToken();
        setUser(null);
      } finally {
        setAuthLoading(false);
      }
    }
    checkAuth();
  }, []);

  // Listen for single-device termination event
  useEffect(() => {
    const handleTerminated = (e) => {
      setUser(null);
      setTerminationNotice(
        e.detail?.message || 'Your account was logged in on another device. You were signed out.'
      );
    };

    window.addEventListener('gc_agent_session_terminated', handleTerminated);
    return () => {
      window.removeEventListener('gc_agent_session_terminated', handleTerminated);
    };
  }, []);

  const handleLogout = () => {
    clearStoredToken();
    setUser(null);
    setSidebarOpen(false);
    setTerminationNotice(null);
  };

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="pulse-dot green" style={{ width: '16px', height: '16px', margin: '0 auto 1rem', background: '#c084fc', boxShadow: '0 0 10px #c084fc' }}></div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Loading Admin Portal...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <AdminAuthModal
        onLoginSuccess={(loggedInUser) => {
          setUser(loggedInUser);
          setTerminationNotice(null);
        }}
        terminationNotice={terminationNotice}
      />
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Admin Navbar */}
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
          <button
            onClick={() => setSidebarOpen(true)}
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '9px',
              background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 12px rgba(168, 85, 247, 0.35)'
            }}>
              <ShieldAlert size={19} color="#fff" strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontSize: '0.98rem', fontWeight: 800, letterSpacing: '-0.01em', color: '#fff' }}>
                Admin Portal
              </div>
              <div style={{ fontSize: '0.68rem', color: '#c084fc' }}>
                Secure Access
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Admin Sidebar */}
      <AdminSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeTab={'admin'}
        onSelectTab={() => {}}
        user={user}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main style={{ padding: '1.25rem', flex: 1, paddingBottom: '2rem' }}>
        <AdminPanel currentUser={user} />
      </main>
    </div>
  );
}
