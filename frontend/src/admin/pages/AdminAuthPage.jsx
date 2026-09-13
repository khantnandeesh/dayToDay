import React, { useState, useEffect, useCallback } from 'react';
import adminApi from '../services/adminApi';
import Pagination from '../components/Pagination';

export const AdminAuthPage = () => {
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [eventFilter, setEventFilter] = useState('all');
  const [resultFilter, setResultFilter] = useState('all');
  const [emailFilter, setEmailFilter] = useState('');
  const [ipFilter, setIpFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchAuthData = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const [eventsData, statsData] = await Promise.all([
          adminApi.getAuthEvents({
            page,
            limit: 20,
            event: eventFilter !== 'all' ? eventFilter : undefined,
            result: resultFilter !== 'all' ? resultFilter : undefined,
            email: emailFilter.trim() || undefined,
            ip: ipFilter.trim() || undefined,
          }),
          adminApi.getAuthStats(),
        ]);

        if (eventsData.success) {
          setEvents(eventsData.events);
          setPagination(eventsData.pagination);
        }
        if (statsData.success) {
          setStats(statsData.stats);
        }
      } catch (err) {
        console.error('Failed to fetch auth data:', err);
      } finally {
        setLoading(false);
      }
    },
    [eventFilter, resultFilter, emailFilter, ipFilter]
  );

  useEffect(() => {
    let ignore = false;
    Promise.all([
      adminApi.getAuthEvents({
        page: 1,
        limit: 20,
        event: eventFilter !== 'all' ? eventFilter : undefined,
        result: resultFilter !== 'all' ? resultFilter : undefined,
        email: emailFilter.trim() || undefined,
        ip: ipFilter.trim() || undefined,
      }),
      adminApi.getAuthStats(),
    ]).then(([eventsData, statsData]) => {
      if (!ignore) {
        if (eventsData.success) {
          setEvents(eventsData.events);
          setPagination(eventsData.pagination);
        }
        if (statsData.success) {
          setStats(statsData.stats);
        }
      }
    }).catch((err) => {
      console.error('Failed to fetch auth data:', err);
    });
    return () => { ignore = true; };
  }, [eventFilter, resultFilter, emailFilter, ipFilter]);

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
          <h1 className="admin-page-title">Authentication Monitoring</h1>
          <p className="admin-page-desc">Track authentication attempts, 2FA verifications, and anomalous login events</p>
        </div>
        <button
          type="button"
          className="admin-btn admin-btn-sm"
          onClick={() => fetchAuthData(pagination.page)}
        >
          Refresh
        </button>
      </header>

      {/* Auth Statistics Grid */}
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-label">Successful Logins</div>
          <div className="admin-stat-value">{stats ? stats.successfulLogins : '—'}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Failed Logins</div>
          <div className="admin-stat-value">{stats ? stats.failedLoginsCount || stats.failedLogins : '—'}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">2FA Requests</div>
          <div className="admin-stat-value">{stats ? stats.twoFactorRequests : '—'}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">2FA Verified</div>
          <div className="admin-stat-value">{stats ? stats.twoFactorSuccess : '—'}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">2FA Failed Attempts</div>
          <div className="admin-stat-value">{stats ? stats.twoFactorFailed : '—'}</div>
        </div>
      </div>

      {/* Suspicious Activity Card */}
      {stats?.suspiciousIps && stats.suspiciousIps.length > 0 && (
        <div
          style={{
            border: '1px solid #24292f',
            padding: '12px 16px',
            marginBottom: '20px',
            backgroundColor: '#f6f8fa',
            borderRadius: '3px',
          }}
        >
          <div style={{ fontWeight: '600', fontSize: '13px', marginBottom: '6px' }}>
            Flagged Suspicious IP Addresses (Repeated Authentication Failures)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {stats.suspiciousIps.map((s, idx) => (
              <div
                key={idx}
                style={{
                  border: '1px solid #d0d7de',
                  padding: '6px 10px',
                  backgroundColor: '#ffffff',
                  fontSize: '12px',
                  borderRadius: '2px',
                }}
              >
                <div className="admin-mono" style={{ fontWeight: '600' }}>{s.ip}</div>
                <div style={{ color: '#656d76' }}>
                  {s.failures} failures &bull; {s.usersCount} user target(s)
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter toolbar */}
      <div className="admin-filter-bar">
        <input
          type="text"
          placeholder="Filter by email..."
          value={emailFilter}
          onChange={(e) => setEmailFilter(e.target.value)}
          style={{ minWidth: '180px' }}
        />
        <input
          type="text"
          placeholder="Filter by IP..."
          value={ipFilter}
          onChange={(e) => setIpFilter(e.target.value)}
          style={{ minWidth: '140px' }}
        />
        <select value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}>
          <option value="all">All Events</option>
          <option value="LOGIN">LOGIN</option>
          <option value="FAILED_LOGIN">FAILED_LOGIN</option>
          <option value="ADMIN_LOGIN">ADMIN_LOGIN</option>
          <option value="ADMIN_LOGIN_FAILED">ADMIN_LOGIN_FAILED</option>
          <option value="2FA_REQUEST">2FA_REQUEST</option>
          <option value="2FA_VERIFY">2FA_VERIFY</option>
          <option value="2FA_VERIFY_FAILED">2FA_VERIFY_FAILED</option>
          <option value="LOGOUT">LOGOUT</option>
          <option value="ADMIN_LOGOUT">ADMIN_LOGOUT</option>
        </select>
        <select value={resultFilter} onChange={(e) => setResultFilter(e.target.value)}>
          <option value="all">All Results</option>
          <option value="Success">Success</option>
          <option value="Failed">Failed</option>
          <option value="Blocked">Blocked</option>
          <option value="Forbidden">Forbidden</option>
        </select>
        <button
          type="button"
          className="admin-btn admin-btn-sm"
          onClick={() => fetchAuthData(1)}
        >
          Filter
        </button>
        {(emailFilter || ipFilter || eventFilter !== 'all' || resultFilter !== 'all') && (
          <button
            type="button"
            className="admin-btn admin-btn-sm"
            onClick={() => {
              setEmailFilter('');
              setIpFilter('');
              setEventFilter('all');
              setResultFilter('all');
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Events Table */}
      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Event</th>
              <th>User Email</th>
              <th>IP Address</th>
              <th>Device</th>
              <th>Result</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {loading && events.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: '#656d76' }}>
                  Loading authentication logs...
                </td>
              </tr>
            ) : events.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: '#656d76' }}>
                  No authentication records found.
                </td>
              </tr>
            ) : (
              events.map((ev) => (
                <tr key={ev._id}>
                  <td className="admin-mono">{formatTime(ev.timestamp)}</td>
                  <td>
                    <span className="admin-badge">{ev.event}</span>
                  </td>
                  <td className="admin-mono">{ev.user || 'Unknown'}</td>
                  <td className="admin-mono">{ev.ip || '127.0.0.1'}</td>
                  <td>{ev.device || 'Browser'}</td>
                  <td>
                    <span
                      className={`admin-badge ${
                        ev.result === 'Success'
                          ? 'admin-badge-success'
                          : ev.result === 'Failed' || ev.result === 'Blocked'
                          ? 'admin-badge-warn'
                          : ''
                      }`}
                    >
                      {ev.result}
                    </span>
                  </td>
                  <td style={{ color: '#656d76', fontSize: '12px' }}>{ev.message || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        pagination={pagination}
        onPageChange={(p) => fetchAuthData(p)}
      />
    </section>
  );
};

export default AdminAuthPage;
