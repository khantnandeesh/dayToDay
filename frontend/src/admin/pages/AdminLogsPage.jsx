import React, { useState, useEffect, useCallback } from 'react';
import adminApi from '../services/adminApi';
import Pagination from '../components/Pagination';
import ConfirmDialog from '../components/ConfirmDialog';

export const AdminLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('all');
  const [eventFilter, setEventFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('');
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

  const fetchLogs = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const params = {
          page,
          limit: 25,
          search: search.trim() || undefined,
          level: level !== 'all' ? level : undefined,
          event: eventFilter !== 'all' ? eventFilter : undefined,
          user: userFilter.trim() || undefined,
        };
        const data = await adminApi.getLogs(params);
        if (data.success) {
          setLogs(data.logs);
          setPagination(data.pagination);
        }
      } catch (err) {
        setMessage(err.response?.data?.message || 'Failed to load logs');
      } finally {
        setLoading(false);
      }
    },
    [search, level, eventFilter, userFilter]
  );

  useEffect(() => {
    let ignore = false;
    const params = {
      page: 1,
      limit: 25,
      search: search.trim() || undefined,
      level: level !== 'all' ? level : undefined,
      event: eventFilter !== 'all' ? eventFilter : undefined,
      user: userFilter.trim() || undefined,
    };
    adminApi.getLogs(params).then((data) => {
      if (!ignore && data.success) {
        setLogs(data.logs);
        setPagination(data.pagination);
      }
    }).catch((err) => {
      if (!ignore) {
        setMessage(err.response?.data?.message || 'Failed to load logs');
      }
    });
    return () => { ignore = true; };
  }, [search, level, eventFilter, userFilter]);

  const handleClearLogs = (retentionDays) => {
    const desc = retentionDays === 0 ? 'ALL stored audit logs' : `audit logs older than ${retentionDays} days`;
    setDialogState({
      isOpen: true,
      title: 'Purge Audit Logs',
      message: `Are you sure you want to permanently purge ${desc}? This action cannot be reversed.`,
      danger: true,
      confirmText: 'Purge Records',
      onConfirm: async () => {
        try {
          const res = await adminApi.clearLogs(retentionDays);
          setMessage(res.message);
          setDialogState((prev) => ({ ...prev, isOpen: false }));
          fetchLogs(1);
        } catch (err) {
          setMessage(err.response?.data?.message || 'Failed to clear logs');
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
      second: '2-digit',
    });
  };

  return (
    <section>
      <header className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Audit & System Logs</h1>
          <p className="admin-page-desc">Chronological immutable audit log of administrative and security events</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="admin-btn admin-btn-sm"
            onClick={() => fetchLogs(pagination.page)}
          >
            Refresh
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-sm admin-btn-danger"
            onClick={() => handleClearLogs(7)}
            title="Purge logs older than 7 days"
          >
            Clear &gt;7 Days
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-sm admin-btn-danger"
            onClick={() => handleClearLogs(0)}
            title="Purge all logs"
          >
            Purge All
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

      {/* Filter toolbar */}
      <div className="admin-filter-bar">
        <input
          type="text"
          placeholder="Search log messages, targets, IPs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: '220px' }}
        />
        <input
          type="text"
          placeholder="Filter user..."
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          style={{ minWidth: '150px' }}
        />
        <select value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="all">Level: All</option>
          <option value="INFO">Level: INFO</option>
          <option value="WARN">Level: WARN</option>
          <option value="ERROR">Level: ERROR</option>
        </select>
        <button
          type="button"
          className="admin-btn admin-btn-sm"
          onClick={() => fetchLogs(1)}
        >
          Filter
        </button>
        {(search || userFilter || level !== 'all' || eventFilter !== 'all') && (
          <button
            type="button"
            className="admin-btn admin-btn-sm"
            onClick={() => {
              setSearch('');
              setUserFilter('');
              setLevel('all');
              setEventFilter('all');
            }}
          >
            Reset
          </button>
        )}
      </div>

      {/* Logs Table */}
      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Level</th>
              <th>Event</th>
              <th>User</th>
              <th>IP Address</th>
              <th>Target</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            {loading && logs.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: '#656d76' }}>
                  Loading audit logs...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: '#656d76' }}>
                  No log entries found.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log._id}>
                  <td className="admin-mono" style={{ whiteSpace: 'nowrap' }}>
                    {formatTime(log.timestamp)}
                  </td>
                  <td>
                    <span
                      className={`admin-badge ${
                        log.level === 'ERROR'
                          ? 'admin-badge-danger'
                          : log.level === 'WARN'
                          ? 'admin-badge-warn'
                          : ''
                      }`}
                    >
                      {log.level}
                    </span>
                  </td>
                  <td>
                    <span className="admin-badge">{log.event}</span>
                  </td>
                  <td className="admin-mono">{log.user || '—'}</td>
                  <td className="admin-mono">{log.ip || '127.0.0.1'}</td>
                  <td className="admin-mono" style={{ fontSize: '11px' }}>
                    {log.target || '—'}
                  </td>
                  <td style={{ fontSize: '12px' }}>{log.message}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        pagination={pagination}
        onPageChange={(p) => fetchLogs(p)}
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

export default AdminLogsPage;
