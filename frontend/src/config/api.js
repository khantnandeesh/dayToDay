import axios from 'axios';
import { getOrCreateDeviceId, getClientDeviceDisplayName } from '../utils/deviceIdentity';

const getBackendBaseUrl = () => {
  if (import.meta.env.VITE_BACKEND_URL !== undefined && import.meta.env.VITE_BACKEND_URL !== '') {
    return import.meta.env.VITE_BACKEND_URL;
  }
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname.includes('vercel.app') || hostname === 'nandeesh.dev' || hostname.endsWith('.nandeesh.dev')) {
      return 'https://daytoday-backend-90e6c0a7d7b8.herokuapp.com';
    }
  }
  return '';
};

const API_URL = getBackendBaseUrl();

const api = axios.create({
  baseURL: API_URL ? `${API_URL}/api` : '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token and device identification to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Attach persistent client device ID for SSO & device recognition
    try {
      const deviceId = getOrCreateDeviceId();
      if (deviceId) {
        config.headers['X-Device-Id'] = deviceId;
      }
      const deviceName = getClientDeviceDisplayName();
      if (deviceName) {
        config.headers['X-Device-Name'] = deviceName;
      }
    } catch {
      // ignore
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const requestUrl = error.config?.url || '';
      const isAuthEndpoint =
        requestUrl.includes('/auth/login') ||
        requestUrl.includes('/auth/register') ||
        requestUrl.includes('/auth/verify-2fa') ||
        requestUrl.includes('/auth/me');

      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
      const isPublicPage =
        currentPath === '/login' ||
        currentPath === '/register' ||
        currentPath === '/verify-2fa' ||
        currentPath === '/security' ||
        currentPath.startsWith('/share') ||
        currentPath.startsWith('/vault/access');

      if (!isAuthEndpoint && !isPublicPage) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
