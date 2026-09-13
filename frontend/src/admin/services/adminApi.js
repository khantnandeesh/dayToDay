import axios from 'axios';
import { getBackendBaseUrl } from '../../config/api';

const getAdminBaseUrl = () => {
  const backendBase = getBackendBaseUrl();
  return backendBase ? `${backendBase}/api/admin` : '/api/admin';
};

const api = axios.create({
  baseURL: getAdminBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Attach dynamic baseURL and admin token from localStorage or cookie if present
api.interceptors.request.use((config) => {
  config.baseURL = getAdminBaseUrl();
  const token = localStorage.getItem('admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Intercept 401/403 to trigger clean admin logout if expired
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      if (window.location.pathname.startsWith('/admin') && window.location.pathname !== '/admin/login') {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        window.location.href = '/admin/login?session_expired=1';
      }
    }
    return Promise.reject(error);
  }
);

export const adminApi = {
  // Auth
  login: async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    return res.data;
  },
  getMe: async () => {
    const res = await api.get('/auth/me');
    return res.data;
  },
  logout: async () => {
    try {
      const res = await api.post('/auth/logout');
      return res.data;
    } finally {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
    }
  },

  // Dashboard
  getDashboardStats: async (page = 1, limit = 15) => {
    const res = await api.get(`/dashboard?page=${page}&limit=${limit}`);
    return res.data;
  },

  // Users
  getUsers: async (params = {}) => {
    const res = await api.get('/users', { params });
    return res.data;
  },
  getUserDetails: async (id) => {
    const res = await api.get(`/users/${id}`);
    return res.data;
  },
  createUser: async (userData) => {
    const res = await api.post('/users', userData);
    return res.data;
  },
  toggleUserStatus: async (id) => {
    const res = await api.patch(`/users/${id}/status`);
    return res.data;
  },
  deleteUser: async (id) => {
    const res = await api.delete(`/users/${id}`);
    return res.data;
  },
  logoutUserSessions: async (id) => {
    const res = await api.post(`/users/${id}/logout-all`);
    return res.data;
  },
  resetUser2fa: async (id) => {
    const res = await api.post(`/users/${id}/reset-2fa`);
    return res.data;
  },

  // Sessions
  getSessions: async (params = {}) => {
    const res = await api.get('/sessions', { params });
    return res.data;
  },
  terminateSession: async (id) => {
    const res = await api.delete(`/sessions/${id}`);
    return res.data;
  },
  terminateUserSessions: async (userId) => {
    const res = await api.post(`/sessions/logout-user/${userId}`);
    return res.data;
  },
  terminateAllSessions: async () => {
    const res = await api.post('/sessions/logout-all', {
      confirm: 'CONFIRM_GLOBAL_TERMINATE',
    });
    return res.data;
  },

  // Authentication Management
  getAuthEvents: async (params = {}) => {
    const res = await api.get('/auth/events', { params });
    return res.data;
  },
  getAuthStats: async () => {
    const res = await api.get('/auth/stats');
    return res.data;
  },

  // 2FA Management
  getTwoFactorChallenges: async () => {
    const res = await api.get('/2fa/challenges');
    return res.data;
  },
  invalidate2faChallenge: async (userId) => {
    const res = await api.post(`/2fa/invalidate/${userId}`);
    return res.data;
  },

  // Device Management
  getDevices: async (params = {}) => {
    const res = await api.get('/devices', { params });
    return res.data;
  },
  revokeDevice: async (deviceId, userId) => {
    const res = await api.delete(`/devices/${deviceId}`, { data: { userId } });
    return res.data;
  },

  // MCP / OAuth Clients
  getMcpClients: async () => {
    const res = await api.get('/mcp/clients');
    return res.data;
  },
  getMcpClientDetails: async (id) => {
    const res = await api.get(`/mcp/clients/${id}`);
    return res.data;
  },
  registerMcpClient: async (clientData) => {
    const res = await api.post('/mcp/clients', clientData);
    return res.data;
  },
  toggleClientStatus: async (id) => {
    const res = await api.patch(`/mcp/clients/${id}/status`);
    return res.data;
  },
  deleteMcpClient: async (id) => {
    const res = await api.delete(`/mcp/clients/${id}`);
    return res.data;
  },

  // System Information & Settings
  getSystemInfo: async () => {
    const res = await api.get('/system');
    return res.data;
  },
  getSettings: async () => {
    const res = await api.get('/settings');
    return res.data;
  },
  updateSettings: async (settings) => {
    const res = await api.patch('/settings', settings);
    return res.data;
  },

  // Logs
  getLogs: async (params = {}) => {
    const res = await api.get('/logs', { params });
    return res.data;
  },
  clearLogs: async (retentionDays = 0) => {
    const res = await api.post('/logs/clear', { retentionDays });
    return res.data;
  },
};

export default adminApi;
