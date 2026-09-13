import React from 'react';
import { Link, useNavigate, Outlet } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import AdminNav from './AdminNav';
import '../admin.css';

export const AdminLayout = () => {
  const { adminUser, logout } = useAdminAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  return (
    <div className="admin-root">
      <header className="admin-header">
        <div className="admin-brand">
          <Link to="/admin" className="admin-brand-title">
            nandeesh.dev
          </Link>
          <span className="admin-brand-badge">Admin</span>
        </div>
        <div className="admin-user-menu">
          <span className="admin-mono" style={{ color: '#656d76' }}>
            {adminUser?.email || 'admin'}
          </span>
          <button
            type="button"
            className="admin-btn admin-btn-sm"
            onClick={handleLogout}
          >
            Sign Out
          </button>
        </div>
      </header>
      <div className="admin-shell">
        <AdminNav />
        <main className="admin-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
