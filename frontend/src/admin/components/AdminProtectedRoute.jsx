import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import AdminLayout from './AdminLayout';
import '../admin.css';

export const AdminProtectedRoute = () => {
  const { isAuthenticated, isLoading } = useAdminAuth();

  if (isLoading) {
    return (
      <div className="admin-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <p className="admin-mono" style={{ color: '#656d76' }}>
          Verifying administrative credentials...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return <AdminLayout />;
};

export default AdminProtectedRoute;
