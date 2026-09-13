import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import adminApi from '../services/adminApi';
import ConfirmDialog from '../components/ConfirmDialog';

export const AdminUserDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [userData, setUserData] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loginHistory, setLoginHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const [dialogState, setDialogState] = useState({
    isOpen: false,
    title: '',
    message: '',
    danger: false,
    confirmText: 'Confirm',
    onConfirm: () => {},
  });

  const loadDetails = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.getUserDetails(id);
      if (data.success) {
        setUserData(data.user);
        setSessions(data.sessions || []);
        setLoginHistory(data.loginHistory || []);
      }
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to load user details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let ignore = false;
    adminApi.getUserDetails(id).then((data) => {
      if (!ignore && data.success) {
        setUserData(data.user);
        setSessions(data.sessions || []);
        setLoginHistory(data.loginHistory || []);
      }
    }).catch((err) => {
      if (!ignore) {
        setMessage(err.response?.data?.message || 'Failed to load user details');
      }
    });
    return () => { ignore = true; };
  }, [id]);

  const handleToggleStatus = async () => {
    try {
      const res = await adminApi.toggleUserStatus(id);
      setMessage(res.message);
      loadDetails();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to toggle status');
    }
  };

  const handleReset2FA = async () => {
    try {
      const res = await adminApi.resetUser2fa(id);
      setMessage(res.message);
      loadDetails();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to reset 2FA');
    }
  };

  const handleTerminateSession = (sessionId) => {
    setDialogState({
      isOpen: true,
      title: 'Terminate Session',
      message: 'Terminate this specific login session immediately?',
      danger: true,
      confirmText: 'Terminate',
      onConfirm: async () => {
        try {
          const res = await adminApi.terminateSession(sessionId);
          setMessage(res.message);
          setDialogState((prev) => ({ ...prev, isOpen: false }));
          loadDetails();
        } catch (err) {
          setMessage(err.response?.data?.message || 'Failed to terminate session');
          setDialogState((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleLogoutAll = () => {
    setDialogState({
      isOpen: true,
      title: 'Terminate All Sessions',
      message: `Sign out all active sessions for ${userData.email}?`,
      danger: true,
      confirmText: 'Terminate All',
      onConfirm: async () => {
        try {
          const res = await adminApi.logoutUserSessions(id);
          setMessage(res.message);
          setDialogState((prev) => ({ ...prev, isOpen: false }));
          loadDetails();
        } catch (err) {
          setMessage(err.response?.data?.message || 'Failed to terminate sessions');
          setDialogState((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleDeleteUser = () => {
    setDialogState({
      isOpen: true,
      title: 'Delete User Account',
      message: `Permanently delete ${userData.email}? All associated data and sessions will be destroyed.`,
      danger: true,
      confirmText: 'Delete Permanently',
      onConfirm: async () => {
        try {
          await adminApi.deleteUser(id);
          navigate('/admin/users');
        } catch (err) {
          setMessage(err.response?.data?.message || 'Failed to delete user');
          setDialogState((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const formatTime = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString();
  };

  if (loading && !userData) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center', color: '#656d76' }}>
        Loading user account details...
      </div>
    );
  }

  if (!userData) {
    return (
      <div style={{ padding: '24px 0' }}>
        <p>User record not found.</p>
        <Link to="/admin/users" className="admin-btn admin-btn-sm">
          &larr; Back to Users
        </Link>
      </div>
    );
  }

  return (
    <section>
      <header className="admin-page-header">
        <div>
          <div style={{ marginBottom: '4px' }}>
            <Link to="/admin/users" style={{ color: '#656d76', textDecoration: 'none', fontSize: '12px' }}>
              &larr; Back to User Management
            </Link>
          </div>
          <h1 className="admin-page-title">{userData.name}</h1>
          <p className="admin-page-desc admin-mono">{userData.email}</p>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            className="admin-btn admin-btn-sm"
            onClick={handleToggleStatus}
          >
            {userData.isActive ? 'Disable Account' : 'Enable Account'}
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-sm"
            onClick={handleLogoutAll}
          >
            Sign Out All Sessions
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-sm admin-btn-danger"
            onClick={handleDeleteUser}
          >
            Delete User
          </button>
        </div>
      </header>

      {message && (
        <div
          style={{
            padding: '8px 12px',
            border: '1px solid #24292f',
            marginBottom: '16px',
            fontSize: '13px',
          }}
        >
          {message}
        </div>
      )}

      {/* Details Grid */}
      <div className="admin-details-grid">
        <div className="admin-detail-box">
          <h3>Account Information</h3>
          <div className="admin-detail-row">
            <span className="admin-detail-key">User ID</span>
            <span className="admin-detail-val admin-mono">{userData._id}</span>
          </div>
          <div className="admin-detail-row">
            <span className="admin-detail-key">Role</span>
            <span className="admin-detail-val">
              <span className={`admin-badge ${userData.role === 'admin' ? 'admin-badge-active' : ''}`}>
                {userData.role}
              </span>
            </span>
          </div>
          <div className="admin-detail-row">
            <span className="admin-detail-key">Status</span>
            <span className="admin-detail-val">
              <span className={`admin-badge ${userData.isActive ? 'admin-badge-success' : 'admin-badge-disabled'}`}>
                {userData.isActive ? 'Active' : 'Disabled'}
              </span>
            </span>
          </div>
          <div className="admin-detail-row">
            <span className="admin-detail-key">Account Created</span>
            <span className="admin-detail-val admin-mono">{formatTime(userData.createdAt)}</span>
          </div>
        </div>

        <div className="admin-detail-box">
          <h3>Authentication Status</h3>
          <div className="admin-detail-row">
            <span className="admin-detail-key">2FA Configured</span>
            <span className="admin-detail-val">
              {userData.twoFactorEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div className="admin-detail-row">
            <span className="admin-detail-key">Pending 2FA Challenge</span>
            <span className="admin-detail-val">
              {userData.hasPending2fa ? 'Active Challenge' : 'None'}
            </span>
          </div>
          <div className="admin-detail-row">
            <span className="admin-detail-key">Failed Login Count</span>
            <span className="admin-detail-val admin-mono">{userData.failedLoginAttempts || 0}</span>
          </div>
          <div className="admin-detail-row">
            <span className="admin-detail-key">Last Successful Login</span>
            <span className="admin-detail-val admin-mono">{formatTime(userData.lastLogin)}</span>
          </div>
          <div style={{ marginTop: '12px', textAlign: 'right' }}>
            <button
              type="button"
              className="admin-btn admin-btn-sm"
              onClick={handleReset2FA}
            >
              Reset 2FA & Failed Count
            </button>
          </div>
        </div>
      </div>

      {/* Active Sessions */}
      <section style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '600', margin: 0 }}>
            Active & Recent Sessions ({sessions.length})
          </h2>
        </div>

        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Device</th>
                <th>Browser</th>
                <th>OS</th>
                <th>IP Address</th>
                <th>Created</th>
                <th>Last Active</th>
                <th>Expires</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '16px', color: '#656d76' }}>
                    No sessions recorded for this user.
                  </td>
                </tr>
              ) : (
                sessions.map((s) => {
                  const isAlive = s.isActive && new Date(s.expiresAt) > new Date();
                  return (
                    <tr key={s._id}>
                      <td style={{ fontWeight: '500' }}>
                        {s.deviceInfo?.deviceName || s.deviceId || 'Generic Device'}
                      </td>
                      <td>{s.deviceInfo?.browser || s.deviceInfo?.browserName || 'Unknown'}</td>
                      <td>{s.deviceInfo?.os || s.deviceInfo?.osName || 'Unknown'}</td>
                      <td className="admin-mono">{s.deviceInfo?.ip || '127.0.0.1'}</td>
                      <td className="admin-mono">{formatTime(s.createdAt)}</td>
                      <td className="admin-mono">{formatTime(s.lastActive || s.updatedAt)}</td>
                      <td className="admin-mono">{formatTime(s.expiresAt)}</td>
                      <td>
                        <span className={`admin-badge ${isAlive ? 'admin-badge-success' : 'admin-badge-disabled'}`}>
                          {isAlive ? 'Active' : 'Terminated'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {isAlive && (
                          <button
                            type="button"
                            className="admin-btn admin-btn-sm admin-btn-danger"
                            onClick={() => handleTerminateSession(s._id)}
                          >
                            Terminate
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent Authentication Events */}
      <section>
        <h2 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '10px' }}>
          Authentication Audit History
        </h2>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Event</th>
                <th>IP Address</th>
                <th>Device</th>
                <th>Result</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {loginHistory.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '16px', color: '#656d76' }}>
                    No authentication events recorded for this user.
                  </td>
                </tr>
              ) : (
                loginHistory.map((item, idx) => (
                  <tr key={item._id || idx}>
                    <td className="admin-mono">{formatTime(item.timestamp)}</td>
                    <td>
                      <span className="admin-badge">{item.event}</span>
                    </td>
                    <td className="admin-mono">{item.ip || '127.0.0.1'}</td>
                    <td>{item.device || 'Web Browser'}</td>
                    <td>
                      <span
                        className={`admin-badge ${
                          item.result === 'Success' ? 'admin-badge-success' : 'admin-badge-warn'
                        }`}
                      >
                        {item.result}
                      </span>
                    </td>
                    <td style={{ color: '#656d76', fontSize: '12px' }}>{item.message || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <ConfirmDialog
        isOpen={dialogState.isOpen}
        title={dialogState.title}
        message={dialogState.message}
        danger={dialogState.danger}
        confirmText={dialogState.confirmText}
        onConfirm={dialogState.onConfirm}
        onCancel={() => setDialogState((prev) => ({ ...prev, isOpen: false }))}
      />
    </section>
  );
};

export default AdminUserDetailsPage;
