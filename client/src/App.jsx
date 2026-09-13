import React, { useState, useEffect } from 'react';
import { api, getStoredToken, clearStoredToken } from './api';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import AuthModal from './components/AuthModal';
import DeviceLink from './components/DeviceLink';
import GroupCreator from './components/GroupCreator';
import ExecutionMonitor from './components/ExecutionMonitor';
import GroupList from './components/GroupList';
import { Smartphone, Users, Layers } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [waStatus, setWaStatus] = useState(null);
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [currentJob, setCurrentJob] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('link');
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
      setWaStatus(null);
      setGroups([]);
      setCurrentJob(null);
      setTerminationNotice(
        e.detail?.message || 'Your account was logged in on another device. You were signed out.'
      );
    };

    window.addEventListener('gc_agent_session_terminated', handleTerminated);
    return () => {
      window.removeEventListener('gc_agent_session_terminated', handleTerminated);
    };
  }, []);

  // When user is authenticated, load WhatsApp status and previous groups
  useEffect(() => {
    if (!user) return;

    let isMounted = true;

    async function loadData() {
      try {
        const status = await api.getWhatsAppStatus();
        if (isMounted) {
          setWaStatus(status);
          // If already linked and on default tab, switch to group creator
          if (status.isConnected && activeTab === 'link') {
            setActiveTab('create');
          }
        }
      } catch (err) {
        console.error('Failed to load WA status:', err);
      }

      try {
        setGroupsLoading(true);
        const history = await api.getGroupsHistory();
        if (isMounted) setGroups(history);
      } catch (err) {
        console.error('Failed to load groups history:', err);
      } finally {
        if (isMounted) setGroupsLoading(false);
      }
    }

    loadData();

    // Background interval to refresh WhatsApp link status
    const interval = setInterval(async () => {
      try {
        const status = await api.getWhatsAppStatus();
        if (isMounted) setWaStatus(status);
      } catch (e) {}
    }, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [user]);

  const handleLogout = () => {
    clearStoredToken();
    setUser(null);
    setWaStatus(null);
    setGroups([]);
    setCurrentJob(null);
    setSidebarOpen(false);
    setTerminationNotice(null);
  };

  const handleRefreshGroups = async () => {
    try {
      setGroupsLoading(true);
      const history = await api.getGroupsHistory();
      setGroups(history);
    } catch (e) {
      console.error(e);
    } finally {
      setGroupsLoading(false);
    }
  };

  const handleStartCreation = ({ baseName, quantity, targetNumber, delaySeconds }) => {
    setCurrentJob({
      baseName,
      quantity,
      targetNumber,
      current: 0,
      total: quantity,
      message: 'Initializing WhatsApp Group Agent...',
      results: [],
      isComplete: false
    });

    api.streamGroupCreation({
      baseName,
      quantity,
      targetNumber,
      delaySeconds,
      onProgress: (data) => {
        setCurrentJob((prev) => {
          if (!prev) return null;
          const updatedResults = [...(prev.results || [])];
          if (data.record) {
            updatedResults.push(data.record);
          }
          return {
            ...prev,
            current: data.current !== undefined ? data.current : prev.current,
            total: data.total !== undefined ? data.total : prev.total,
            message: data.message || prev.message,
            results: updatedResults
          };
        });
      },
      onComplete: (data) => {
        setCurrentJob((prev) => ({
          ...(prev || {}),
          isComplete: true,
          message: data.message || 'All groups created successfully!',
          results: data.results || prev?.results || []
        }));
        handleRefreshGroups();
      },
      onError: (errMsg) => {
        setCurrentJob((prev) => ({
          ...(prev || {}),
          isComplete: true,
          message: `Notice: ${errMsg}`
        }));
        handleRefreshGroups();
      }
    });
  };

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="pulse-dot green" style={{ width: '16px', height: '16px', margin: '0 auto 1rem' }}></div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Loading GC Agent...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthModal
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
      {/* Navigation Bar */}
      <Navbar
        user={user}
        waStatus={waStatus}
        onOpenSidebar={() => setSidebarOpen(true)}
        activeTab={activeTab}
      />

      {/* Sliding Sidebar Drawer */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        user={user}
        waStatus={waStatus}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main style={{ padding: '1.25rem', flex: 1, paddingBottom: '5rem' }}>
        {/* TAB 1: WHATSAPP LINK */}
        {activeTab === 'link' && (
          <DeviceLink
            waStatus={waStatus}
            onStatusChange={(newStatus) => {
              setWaStatus(newStatus);
              if (newStatus.isConnected) {
                handleRefreshGroups();
                setActiveTab('create');
              }
            }}
          />
        )}

        {/* TAB 2: GROUP CREATOR */}
        {activeTab === 'create' && (
          <>
            {currentJob && (
              <ExecutionMonitor
                job={currentJob}
                onReset={() => setCurrentJob(null)}
              />
            )}

            {(!currentJob || currentJob.isComplete) && (
              <GroupCreator
                isLinked={waStatus?.isConnected || false}
                onStartCreation={handleStartCreation}
                disabled={!waStatus?.isConnected}
              />
            )}
          </>
        )}

        {/* TAB 3: GROUPS HISTORY */}
        {activeTab === 'history' && (
          <GroupList
            groups={groups}
            onRefresh={handleRefreshGroups}
            loading={groupsLoading}
          />
        )}

      </main>

      {/* Mobile Bottom Quick Navigation Bar */}
      <nav style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: '540px',
          background: 'rgba(10, 14, 20, 0.95)',
          backdropFilter: 'blur(16px)',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-around',
          padding: '0.55rem 0.25rem',
          zIndex: 40
        }}>
          <button
          onClick={() => setActiveTab('link')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'link' ? 'var(--wa-green)' : 'var(--text-muted)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '3px',
            fontSize: '0.7rem',
            fontWeight: activeTab === 'link' ? 700 : 500,
            cursor: 'pointer'
          }}
        >
          <Smartphone size={18} />
          <span>Device</span>
        </button>

        <button
          onClick={() => setActiveTab('create')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'create' ? 'var(--wa-green)' : 'var(--text-muted)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '3px',
            fontSize: '0.7rem',
            fontWeight: activeTab === 'create' ? 700 : 500,
            cursor: 'pointer'
          }}
        >
          <Users size={18} />
          <span>Creator</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'history' ? 'var(--wa-green)' : 'var(--text-muted)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '3px',
            fontSize: '0.7rem',
            fontWeight: activeTab === 'history' ? 700 : 500,
            cursor: 'pointer'
          }}
        >
          <Layers size={18} />
          <span>History</span>
        </button>
      </nav>
    </div>
  );
}
