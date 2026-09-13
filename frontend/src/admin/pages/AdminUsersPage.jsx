import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import adminApi from '../services/adminApi';
import Pagination from '../components/Pagination';
import ConfirmDialog from '../components/ConfirmDialog';

export const AdminUsersPage = () => {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // User Registration Policy state
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [policyLoading, setPolicyLoading] = useState(false);

  // Dialog state
  const [dialogState, setDialogState] = useState({
    isOpen: false,
    title: '',
    message: '',
    danger: false,
    confirmText: 'Confirm',
    onConfirm: () => {},
  });

  // Create User modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user',
    twoFactorEnabled: false,
  });
  const [createError, setCreateError] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  const fetchUsers = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const params = {
          page,
          limit: 15,
          search: search.trim() || undefined,
          role: role !== 'all' ? role : undefined,
          status: status !== 'all' ? status : undefined,
        };
        const data = await adminApi.getUsers(params);
        if (data.success) {
          setUsers(data.users);
          setPagination(data.pagination);
        }
      } catch (err) {
        setMessage(err.response?.data?.message || 'Failed to load users');
      } finally {
        setLoading(false);
      }
    },
    [search, role, status]
  );

  useEffect(() => {
    let ignore = false;
    const params = {
      page: 1,
      limit: 15,
      search: search.trim() || undefined,
      role: role !== 'all' ? role : undefined,
      status: status !== 'all' ? status : undefined,
    };
    adminApi.getUsers(params).then((data) => {
      if (!ignore && data.success) {
        setUsers(data.users);
        setPagination(data.pagination);
      }
    }).catch((err) => {
      if (!ignore) {
        setMessage(err.response?.data?.message || 'Failed to load users');
      }
    });
    return () => { ignore = true; };
  }, [search, role, status]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchUsers(1);
  };

  useEffect(() => {
    let ignore = false;
    adminApi.getSettings().then((data) => {
      if (!ignore && data?.success && data?.settings) {
        setRegistrationEnabled(Boolean(data.settings.allowUserRegistration));
      }
    }).catch(() => {});
    return () => { ignore = true; };
  }, []);

  const handleToggleRegistration = async () => {
    const nextState = !registrationEnabled;
    setPolicyLoading(true);
    try {
      const res = await adminApi.updateSettings({ allowUserRegistration: nextState });
      if (res.success) {
        setRegistrationEnabled(Boolean(res.settings?.allowUserRegistration));
        setMessage(res.message || `Public registration ${nextState ? 'enabled' : 'disabled'}`);
      }
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to update registration policy');
    } finally {
      setPolicyLoading(false);
    }
  };

  const handleToggleStatus = async (user) => {
    try {
      const res = await adminApi.toggleUserStatus(user._id);
      setMessage(res.message);
      fetchUsers(pagination.page);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to update user status');
    }
  };

  const handleLogoutAllSessions = (user) => {
    setDialogState({
      isOpen: true,
      title: 'Terminate All Sessions',
      message: `Are you sure you want to force sign out all active sessions for ${user.email}?`,
      danger: true,
      confirmText: 'Terminate Sessions',
      onConfirm: async () => {
        try {
          const res = await adminApi.logoutUserSessions(user._id);
          setMessage(res.message);
          setDialogState((prev) => ({ ...prev, isOpen: false }));
          fetchUsers(pagination.page);
        } catch (err) {
          setMessage(err.response?.data?.message || 'Failed to terminate sessions');
          setDialogState((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleDeleteUser = (user) => {
    setDialogState({
      isOpen: true,
      title: 'Delete User Account',
      message: `Are you sure you want to permanently delete user account ${user.email}? This action cannot be undone and will purge all sessions and personal records.`,
      danger: true,
      confirmText: 'Delete Permanently',
      onConfirm: async () => {
        try {
          const res = await adminApi.deleteUser(user._id);
          setMessage(res.message);
          setDialogState((prev) => ({ ...prev, isOpen: false }));
          fetchUsers(pagination.page);
        } catch (err) {
          setMessage(err.response?.data?.message || 'Failed to delete user');
          setDialogState((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleReset2FA = async (user) => {
    try {
      const res = await adminApi.resetUser2fa(user._id);
      setMessage(res.message);
      fetchUsers(pagination.page);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to reset 2FA');
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreateError('');
    setCreateLoading(true);

    try {
      const res = await adminApi.createUser(createForm);
      setMessage(res.message);
      setShowCreateModal(false);
      setCreateForm({ name: '', email: '', password: '', role: 'user', twoFactorEnabled: false });
      fetchUsers(1);
    } catch (err) {
      setCreateError(err.response?.data?.message || 'Failed to create user');
    } finally {
      setCreateLoading(false);
    }
  };

  const formatDate = (iso) => {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <section>
      <header className="admin-page-header">
        <div>
          <h1 className="admin-page-title">User Management</h1>
          <p className="admin-page-desc">Manage registered user accounts, roles, access status, and sessions</p>
        </div>
        <button
          type="button"
          className="admin-btn admin-btn-primary admin-btn-sm"
          onClick={() => setShowCreateModal(true)}
        >
          + Create User
        </button>
      </header>

      {message && (
        <div
          style={{
            padding: '8px 12px',
            border: '1px solid #24292f',
            marginBottom: '16px',
            fontSize: '13px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{message}</span>
          <button
            type="button"
            onClick={() => setMessage('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}
          >
            &times;
          </button>
        </div>
      )}

      {/* User Registration Policy Banner */}
      <div
        style={{
          padding: '12px 16px',
          border: '1px solid #24292f',
          marginBottom: '16px',
          background: registrationEnabled ? '#f6f8fa' : '#fff8f2',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#24292f', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>New User Registration Policy</span>
              <span
                className={`admin-badge ${registrationEnabled ? 'admin-badge-success' : 'admin-badge-danger'}`}
                style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}
              >
                {registrationEnabled ? 'Open / Allowed' : 'Closed / Blocked'}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#656d76', marginTop: '3px' }}>
              {registrationEnabled
                ? 'Public sign-up is ACTIVE. Visitors can create new accounts via the /register page.'
                : 'Public sign-up is BLOCKED. New account registrations are currently rejected by the server.'}
            </div>
          </div>
        </div>
        <button
          type="button"
          className={`admin-btn admin-btn-sm ${registrationEnabled ? 'admin-btn-danger' : 'admin-btn-primary'}`}
          onClick={handleToggleRegistration}
          disabled={policyLoading}
        >
          {policyLoading
            ? 'Updating Policy...'
            : registrationEnabled
            ? 'Disable New Sign-ups'
            : 'Enable New Sign-ups'}
        </button>
      </div>

      {/* Filter and Search Bar */}
      <form onSubmit={handleSearchSubmit} className="admin-filter-bar">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: '240px' }}
        />
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="all">Role: All</option>
          <option value="admin">Role: Admin</option>
          <option value="user">Role: User</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">Status: All</option>
          <option value="active">Status: Active</option>
          <option value="disabled">Status: Disabled</option>
        </select>
        <button type="submit" className="admin-btn admin-btn-sm">
          Filter
        </button>
        {(search || role !== 'all' || status !== 'all') && (
          <button
            type="button"
            className="admin-btn admin-btn-sm"
            onClick={() => {
              setSearch('');
              setRole('all');
              setStatus('all');
            }}
          >
            Clear
          </button>
        )}
      </form>

      {/* Users Table */}
      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Created</th>
              <th>Last Login</th>
              <th>Sessions</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && users.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '24px', color: '#656d76' }}>
                  Loading users list...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '24px', color: '#656d76' }}>
                  No users found matching query.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u._id}>
                  <td style={{ fontWeight: '500' }}>
                    <Link
                      to={`/admin/users/${u._id}`}
                      style={{ color: '#1f2328', textDecoration: 'underline' }}
                    >
                      {u.name}
                    </Link>
                  </td>
                  <td className="admin-mono">{u.email}</td>
                  <td>
                    <span
                      className={`admin-badge ${
                        u.role === 'admin' ? 'admin-badge-active' : ''
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="admin-mono">{formatDate(u.createdAt)}</td>
                  <td className="admin-mono">{formatDate(u.lastLogin)}</td>
                  <td>
                    <span className="admin-mono">
                      {u.activeSessionsCount} active
                    </span>
                  </td>
                  <td>
                    <span
                      className={`admin-badge ${
                        u.isActive ? 'admin-badge-success' : 'admin-badge-disabled'
                      }`}
                    >
                      {u.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '4px' }}>
                      <Link
                        to={`/admin/users/${u._id}`}
                        className="admin-btn admin-btn-sm"
                      >
                        View
                      </Link>
                      <button
                        type="button"
                        className="admin-btn admin-btn-sm"
                        onClick={() => handleToggleStatus(u)}
                        title={u.isActive ? 'Disable account' : 'Enable account'}
                      >
                        {u.isActive ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn-sm"
                        onClick={() => handleLogoutAllSessions(u)}
                        title="Sign out of all devices"
                      >
                        Sign Out
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn-sm"
                        onClick={() => handleReset2FA(u)}
                        title="Reset failed login count and outstanding 2FA"
                      >
                        Reset 2FA
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn-sm admin-btn-danger"
                        onClick={() => handleDeleteUser(u)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        pagination={pagination}
        onPageChange={(p) => fetchUsers(p)}
      />

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={dialogState.isOpen}
        title={dialogState.title}
        message={dialogState.message}
        danger={dialogState.danger}
        confirmText={dialogState.confirmText}
        onConfirm={dialogState.onConfirm}
        onCancel={() => setDialogState((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="admin-modal-overlay" role="dialog" aria-modal="true">
          <div className="admin-modal">
            <h3 className="admin-modal-title">Create New Account</h3>
            {createError && (
              <div
                style={{
                  padding: '6px 10px',
                  border: '1px solid #000000',
                  marginBottom: '12px',
                  fontSize: '12px',
                }}
              >
                {createError}
              </div>
            )}
            <form onSubmit={handleCreateSubmit}>
              <div className="admin-form-group">
                <label className="admin-label">Full Name</label>
                <input
                  type="text"
                  className="admin-input"
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                />
              </div>
              <div className="admin-form-group">
                <label className="admin-label">Email Address</label>
                <input
                  type="email"
                  className="admin-input"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                />
              </div>
              <div className="admin-form-group">
                <label className="admin-label">Password</label>
                <input
                  type="password"
                  className="admin-input"
                  required
                  placeholder="Min 6 characters"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                />
              </div>
              <div className="admin-form-group">
                <label className="admin-label">Account Role</label>
                <select
                  className="admin-select"
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                >
                  <option value="user">User</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              <div className="admin-form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    checked={createForm.twoFactorEnabled}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, twoFactorEnabled: e.target.checked })
                    }
                  />
                  Require Two-Factor Authentication (2FA)
                </label>
              </div>
              <div className="admin-modal-actions" style={{ marginTop: '16px' }}>
                <button
                  type="button"
                  className="admin-btn admin-btn-sm"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="admin-btn admin-btn-primary admin-btn-sm"
                  disabled={createLoading}
                >
                  {createLoading ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default AdminUsersPage;
