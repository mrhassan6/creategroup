const API_BASE = '/api';

export function getStoredToken() {
  return localStorage.getItem('gc_agent_token');
}

export function setStoredToken(token) {
  localStorage.setItem('gc_agent_token', token);
}

export function clearStoredToken() {
  localStorage.removeItem('gc_agent_token');
}

async function request(endpoint, options = {}) {
  const token = getStoredToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await res.json().catch(() => ({}));

  // SINGLE DEVICE TERMINATION DETECTOR
  if (res.status === 401 && (data.error === 'SESSION_TERMINATED' || data.error === 'INVALID_TOKEN' || data.error === 'USER_NOT_FOUND')) {
    clearStoredToken();
    window.dispatchEvent(new CustomEvent('gc_agent_session_terminated', { detail: data }));
    throw new Error(data.message || 'Session ended: Logged in from another device.');
  }

  if (res.status === 403 && (data.error === 'ACCOUNT_SUSPENDED' || data.error === 'ACCOUNT_EXPIRED' || data.error === 'ADMIN_REQUIRED')) {
    clearStoredToken();
    window.dispatchEvent(new CustomEvent('gc_agent_session_terminated', { detail: data }));
    throw new Error(data.message || 'Account suspended or expired.');
  }

  if (!res.ok) {
    throw new Error(data.message || data.error || `Request failed with status ${res.status}`);
  }
  return data;
}

export const api = {
  async login(username, password) {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    if (data.token) setStoredToken(data.token);
    return data;
  },

  async getMe() {
    return request('/user/me');
  },

  async getWhatsAppStatus() {
    return request('/whatsapp/status');
  },

  async requestPairingCode(phoneNumber) {
    return request('/whatsapp/pair-code', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber })
    });
  },

  async unlinkDevice() {
    return request('/whatsapp/logout', {
      method: 'POST'
    });
  },

  async getGroupsHistory() {
    return request('/whatsapp/groups');
  },

  async stopGroupCreation() {
    return request('/whatsapp/stop-create', {
      method: 'POST'
    });
  },

  // ADMIN APIS
  async adminGetUsers() {
    return request('/admin/users');
  },

  async adminCreateUser({ name, phoneNumber, username, password, role, durationDays }) {
    return request('/admin/users', {
      method: 'POST',
      body: JSON.stringify({ name, phoneNumber, username, password, role, durationDays })
    });
  },

  async adminUpdateUser(userId, data) {
    return request(`/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async adminResetPassword(userId, newPassword) {
    return request(`/admin/users/${userId}/password`, {
      method: 'PUT',
      body: JSON.stringify({ newPassword })
    });
  },

  async adminToggleUser(userId) {
    return request(`/admin/users/${userId}/toggle`, {
      method: 'PUT'
    });
  },

  async adminKickUser(userId) {
    return request(`/admin/users/${userId}/kick`, {
      method: 'POST'
    });
  },

  async adminDeleteUser(userId) {
    return request(`/admin/users/${userId}`, {
      method: 'DELETE'
    });
  },

  streamGroupCreation({ baseName, quantity, targetNumber, delaySeconds, onProgress, onComplete, onError }) {
    const token = getStoredToken();
    const params = new URLSearchParams({
      token,
      baseName,
      quantity,
      targetNumber,
      delaySeconds
    });

    const eventSource = new EventSource(`${API_BASE}/whatsapp/stream-create?${params.toString()}`);

    eventSource.addEventListener('start', (e) => {
      const data = JSON.parse(e.data);
      if (onProgress) onProgress({ step: 'start', message: data.message, current: 0, total: data.quantity });
    });

    eventSource.addEventListener('progress', (e) => {
      const data = JSON.parse(e.data);
      if (onProgress) onProgress(data);
    });

    eventSource.addEventListener('complete', (e) => {
      const data = JSON.parse(e.data);
      eventSource.close();
      if (onComplete) onComplete(data);
    });

    eventSource.addEventListener('error', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.error === 'SESSION_TERMINATED') {
          clearStoredToken();
          window.dispatchEvent(new CustomEvent('gc_agent_session_terminated', { detail: data }));
        }
        if (onError) onError(data.message || 'Stream error occurred');
      } catch (err) {
        if (onError) onError('Connection lost or creation interrupted');
      }
      eventSource.close();
    });

    return () => {
      eventSource.close();
    };
  }
};
