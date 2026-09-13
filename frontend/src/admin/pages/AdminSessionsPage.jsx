import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import adminApi from '../services/adminApi';
import Pagination from '../components/Pagination';
import ConfirmDialog from '../components/ConfirmDialog';

export const AdminSessionsPage = () => {
  const [sessions, setSessions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('active');
  const [sortBy, setSortBy] = useState('lastActive');
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

  const fetchSessions = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const params = {
          page,
          limit: 15,
          search: search.trim() || undefined,
          status,
          sortBy,
          sortDir: 'desc',
        };
        const data = await adminApi.getSessions(params);
        if (data.success) {
          setSessions(data.sessions);
          setPagination(data.pagination);
        }
      } catch (err) {
        setMessage(err.response?.data?.message || 'Failed to fetch sessions');
      } finally {
        setLoading(false);
      }
    },
    [search, status, sortBy]
  );

  useEffect(() => {
    let ignore = false;
    const params = {
      page: 1,
      limit: 15,
      search: search.trim() || undefined,
      status,
      sortBy,
      sortDir: 'desc',
    };
    adminApi.getSessions(params).then((data) => {
      if (!ignore && data.success) {
        setSessions(data.sessions);
        setPagination(data.pagination);
      }
    }).catch((err) => {
      if (!ignore) {
        setMessage(err.response?.data?.message || 'Failed to fetch sessions');
      }
    });
    return () => { ignore = true; };
  }, [search, status, sortBy]);

  const handleTerminateSession = (session) => {
    setDialogState({
      isOpen: true,
      title: 'Terminate Session',
      message: `Immediately revoke session for ${session.user.email} on ${session.device} (${session.ip})?`,
      danger: true,
      confirmText: 'Terminate Session',
      onConfirm: async () => {
        try {
          const res = await adminApi.terminateSession(session._id);
          setMessage(res.message);
          setDialogState((prev) => ({ ...prev, isOpen: false }));
          fetchSessions(pagination.page);
        } catch (err) {
          setMessage(err.response?.data?.message || 'Failed to terminate session');
          setDialogState((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleTerminateAllForUser = (session) => {
    setDialogState({
      isOpen: true,
      title: 'Terminate All User Sessions',
      message: `Sign out all sessions across all devices for ${session.user.email}?`,
      danger: true,
      confirmText: 'Revoke User Sessions',
      onConfirm: async () => {
        try {
          const res = await adminApi.terminateUserSessions(session.user.id);
          setMessage(res.message);
          setDialogState((prev) => ({ ...prev, isOpen: false }));
          fetchSessions(pagination.page);
        } catch (err) {
          setMessage(err.response?.data?.message || 'Failed to terminate user sessions');
          setDialogState((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleTerminateAllGlobal = () => {
    setDialogState({
      isOpen: true,
      title: 'Emergency: Terminate All Global Sessions',
      message:
        'WARNING: This will immediately revoke ALL active sessions across all users in the system (except your current admin session). Users will be forced to log in again.',
      danger: true,
      confirmText: 'Revoke All Global Sessions',
      onConfirm: async () => {
        try {
          const res = await adminApi.terminateAllSessions();
          setMessage(res.message);
          setDialogState((prev) => ({ ...prev, isOpen: false }));
          fetchSessions(1);
        } catch (err) {
          setMessage(err.response?.data?.message || 'Failed to terminate all sessions');
          setDialogState((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const formatTime = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <section>
      <header className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Session Management</h1>
          <p className="admin-page-desc">Inspect active JWT sessions, devices, IP origins, and force revocation</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="admin-btn admin-btn-sm"
            onClick={() => fetchSessions(pagination.page)}
          >
            Refresh
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-sm admin-btn-danger"
            onClick={handleTerminateAllGlobal}
          >
            Terminate All Global Sessions
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

      {/* Filter Toolbar */}
      <div className="admin-filter-bar">
        <input
          type="text"
          placeholder="Filter by user, email, IP, browser..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: '260px' }}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="active">Active Sessions Only</option>
          <option value="expired">Expired / Revoked</option>
          <option value="all">All Sessions</option>
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="lastActive">Sort: Latest Activity</option>
          <option value="createdAt">Sort: Created Date</option>
          <option value="expiresAt">Sort: Expiration Date</option>
        </select>
        <button
          type="button"
          className="admin-btn admin-btn-sm"
          onClick={() => fetchSessions(1)}
        >
          Filter
        </button>
        {(search || status !== 'active' || sortBy !== 'lastActive') && (
          <button
            type="button"
            className="admin-btn admin-btn-sm"
            onClick={() => {
              setSearch('');
              setStatus('active');
              setSortBy('lastActive');
            }}
          >
            Reset
          </button>
        )}
      </div>

      {/* Sessions Table */}
      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>User</th>
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
            {loading && sessions.length === 0 ? (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '24px', color: '#656d76' }}>
                  Loading session data...
                </td>
              </tr>
            ) : sessions.length === 0 ? (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '24px', color: '#656d76' }}>
                  No sessions found matching current filter.
                </td>
              </tr>
            ) : (
              sessions.map((s) => (
                <tr key={s._id}>
                  <td>
                    {s.user.id ? (
                      <Link
                        to={`/admin/users/${s.user.id}`}
                        style={{ color: '#1f2328', textDecoration: 'underline', fontWeight: '500' }}
                      >
                        {s.user.name}
                      </Link>
                    ) : (
                      <span>{s.user.name}</span>
                    )}
                    <div className="admin-mono" style={{ fontSize: '11px', color: '#656d76' }}>
                      {s.user.email}
                    </div>
                  </td>
                  <td>{s.device}</td>
                  <td>{s.browser} {s.browserVersion}</td>
                  <td>{s.os} {s.osVersion}</td>
                  <td className="admin-mono">{s.ip}</td>
                  <td className="admin-mono">{formatTime(s.createdAt)}</td>
                  <td className="admin-mono">{formatTime(s.lastActive)}</td>
                  <td className="admin-mono">{formatTime(s.expiresAt)}</td>
                  <td>
                    <span
                      className={`admin-badge ${
                        s.isActive ? 'admin-badge-success' : 'admin-badge-disabled'
                      }`}
                    >
                      {s.isActive ? 'Active' : 'Expired'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '4px' }}>
                      {s.isActive && (
                        <button
                          type="button"
                          className="admin-btn admin-btn-sm"
                          onClick={() => handleTerminateSession(s)}
                          title="Revoke this session token"
                        >
                          Revoke
                        </button>
                      )}
                      {s.user.id && s.isActive && (
                        <button
                          type="button"
                          className="admin-btn admin-btn-sm admin-btn-danger"
                          onClick={() => handleTerminateAllForUser(s)}
                          title="Revoke all user sessions"
                        >
                          Sign Out User
                        </button>
                      )}
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
        onPageChange={(p) => fetchSessions(p)}
      />

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

export default AdminSessionsPage;
