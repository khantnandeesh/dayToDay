import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import '../admin.css';

export const AdminPublicRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAdminAuth();

  if (isLoading) {
    return (
      <div className="admin-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <p className="admin-mono" style={{ color: '#656d76' }}>
          Loading...
        </p>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/admin" replace />;
  }

  return children;
};

export default AdminPublicRoute;
