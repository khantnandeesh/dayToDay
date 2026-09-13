import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminAuthProvider } from './context/AdminAuthContext';
import AdminProtectedRoute from './components/AdminProtectedRoute';
import AdminPublicRoute from './components/AdminPublicRoute';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminUserDetailsPage from './pages/AdminUserDetailsPage';
import AdminSessionsPage from './pages/AdminSessionsPage';
import AdminAuthPage from './pages/AdminAuthPage';
import AdminTwoFactorPage from './pages/AdminTwoFactorPage';
import AdminDevicesPage from './pages/AdminDevicesPage';
import AdminMcpPage from './pages/AdminMcpPage';
import AdminMcpDetailsPage from './pages/AdminMcpDetailsPage';
import AdminSystemPage from './pages/AdminSystemPage';
import AdminLogsPage from './pages/AdminLogsPage';

export const AdminApp = () => {
  return (
    <AdminAuthProvider>
      <Routes>
        <Route
          path="login"
          element={
            <AdminPublicRoute>
              <AdminLoginPage />
            </AdminPublicRoute>
          }
        />
        <Route element={<AdminProtectedRoute />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="users/:id" element={<AdminUserDetailsPage />} />
          <Route path="sessions" element={<AdminSessionsPage />} />
          <Route path="auth" element={<AdminAuthPage />} />
          <Route path="2fa" element={<AdminTwoFactorPage />} />
          <Route path="devices" element={<AdminDevicesPage />} />
          <Route path="mcp" element={<AdminMcpPage />} />
          <Route path="mcp/clients/:id" element={<AdminMcpDetailsPage />} />
          <Route path="system" element={<AdminSystemPage />} />
          <Route path="logs" element={<AdminLogsPage />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
      </Routes>
    </AdminAuthProvider>
  );
};

export default AdminApp;
