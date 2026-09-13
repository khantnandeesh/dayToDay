import React, { createContext, useContext, useState, useEffect } from 'react';
import adminApi from '../services/adminApi';

const AdminAuthContext = createContext(null);

export const AdminAuthProvider = ({ children }) => {
  const [adminUser, setAdminUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('admin_token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const verifyAdmin = async () => {
      const storedToken = localStorage.getItem('admin_token');
      if (!storedToken) {
        setAdminUser(null);
        setIsLoading(false);
        return;
      }

      try {
        const data = await adminApi.getMe();
        if (data.success && data.admin && data.admin.role === 'admin') {
          setAdminUser(data.admin);
          setToken(storedToken);
        } else {
          throw new Error('Not authorized as administrator');
        }
      } catch (err) {
        console.warn('Admin token verification failed:', err.message);
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        setAdminUser(null);
        setToken(null);
      } finally {
        setIsLoading(false);
      }
    };

    verifyAdmin();
  }, []);

  const login = async (email, password) => {
    const data = await adminApi.login(email, password);
    if (data.success && data.token && data.admin) {
      localStorage.setItem('admin_token', data.token);
      localStorage.setItem('admin_user', JSON.stringify(data.admin));
      setToken(data.token);
      setAdminUser(data.admin);
      return data;
    }
    throw new Error(data.message || 'Login failed');
  };

  const logout = async () => {
    try {
      await adminApi.logout();
    } catch {
      /* ignore */
    }
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    setAdminUser(null);
    setToken(null);
  };

  return (
    <AdminAuthContext.Provider
      value={{
        adminUser,
        token,
        isAuthenticated: Boolean(adminUser && token),
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};

export default AdminAuthContext;
