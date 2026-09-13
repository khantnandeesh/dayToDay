import React, { useState, useEffect } from 'react';
import adminApi from '../services/adminApi';
import Pagination from '../components/Pagination';

export const AdminDashboardPage = () => {
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchDashboard = async (page = 1) => {
    setLoading(true);
    try {
      const data = await adminApi.getDashboardStats(page, 15);
      if (data.success) {
        setStats(data.stats);
        setActivity(data.activity?.data || []);
        setPagination(data.activity?.pagination || { page: 1, totalPages: 1, total: 0 });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    adminApi.getDashboardStats(1, 15).then((data) => {
      if (!ignore && data.success) {
        setStats(data.stats);
        setActivity(data.activity?.data || []);
        setPagination(data.activity?.pagination || { page: 1, totalPages: 1, total: 0 });
      }
    }).catch((err) => {
      if (!ignore) {
        setError(err.response?.data?.message || 'Failed to load dashboard data');
      }
    });
    return () => { ignore = true; };
  }, []);

  const formatTime = (isoString) => {
    if (!isoString) return '—';
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
      ' (' + d.toLocaleDateString() + ')';
  };

  return (
    <section>
      <header className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Dashboard</h1>
          <p className="admin-page-desc">System overview and real-time activity stream</p>
        </div>
        <button
          type="button"
          className="admin-btn admin-btn-sm"
          onClick={() => fetchDashboard(pagination.page)}
        >
          Refresh Data
        </button>
      </header>

      {error && (
        <div style={{ padding: '8px 12px', border: '1px solid #24292f', marginBottom: '16px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* Statistical Blocks */}
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-label">Total Users</div>
          <div className="admin-stat-value">{stats ? stats.usersCount : '—'}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Active Sessions</div>
          <div className="admin-stat-value">{stats ? stats.activeSessionsCount : '—'}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Expiring Soon (6h)</div>
          <div className="admin-stat-value">{stats ? stats.expiringSessionsCount : '—'}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">MCP / Connected Apps</div>
          <div className="admin-stat-value">{stats ? stats.mcpClientsCount : '—'}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Failed Logins</div>
          <div className="admin-stat-value">{stats ? stats.failedLoginsCount : '—'}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">2FA Challenges Pending</div>
          <div className="admin-stat-value">{stats ? stats.active2faChallengesCount : '—'}</div>
        </div>
      </div>

      {/* Recent Activity Section */}
      <section style={{ marginTop: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>Recent Activity</h2>
          <span style={{ fontSize: '12px', color: '#656d76' }}>Audit & Authentication Events</span>
        </div>

        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Event</th>
                <th>User</th>
                <th>IP Address</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {loading && activity.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: '#656d76' }}>
                    Loading activity stream...
                  </td>
                </tr>
              ) : activity.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: '#656d76' }}>
                    No recent activity recorded.
                  </td>
                </tr>
              ) : (
                activity.map((item, idx) => (
                  <tr key={item._id || idx}>
                    <td className="admin-mono" style={{ whiteSpace: 'nowrap' }}>
                      {formatTime(item.timestamp)}
                    </td>
                    <td>
                      <span className="admin-badge">
                        {item.event}
                      </span>
                    </td>
                    <td>
                      <span className="admin-mono">{item.user || 'Anonymous'}</span>
                    </td>
                    <td className="admin-mono">{item.ip || '127.0.0.1'}</td>
                    <td>
                      <span
                        className={`admin-badge ${
                          item.result === 'Success'
                            ? 'admin-badge-success'
                            : item.result === 'Failed' || item.result === 'Blocked'
                            ? 'admin-badge-warn'
                            : ''
                        }`}
                      >
                        {item.result}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          pagination={pagination}
          onPageChange={(newPage) => fetchDashboard(newPage)}
        />
      </section>
    </section>
  );
};

export default AdminDashboardPage;
