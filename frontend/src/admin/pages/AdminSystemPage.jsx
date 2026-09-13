import React, { useState, useEffect } from 'react';
import adminApi from '../services/adminApi';

export const AdminSystemPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchSystem = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getSystemInfo();
      if (res.success) {
        setData(res);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load system information');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    adminApi.getSystemInfo().then((res) => {
      if (!ignore && res.success) {
        setData(res);
      }
    }).catch((err) => {
      if (!ignore) {
        setError(err.response?.data?.message || 'Failed to load system information');
      }
    });
    return () => { ignore = true; };
  }, []);

  return (
    <section>
      <header className="admin-page-header">
        <div>
          <h1 className="admin-page-title">System Status</h1>
          <p className="admin-page-desc">Runtime diagnostics, service health, host environment, and variable inspection</p>
        </div>
        <button
          type="button"
          className="admin-btn admin-btn-sm"
          onClick={fetchSystem}
        >
          Refresh Diagnostics
        </button>
      </header>

      {error && (
        <div style={{ padding: '8px 12px', border: '1px solid #24292f', marginBottom: '16px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {loading && !data ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: '#656d76' }}>
          Loading system telemetry...
        </div>
      ) : data ? (
        <>
          <div className="admin-details-grid">
            {/* Host and Runtime */}
            <div className="admin-detail-box">
              <h3>Runtime Environment</h3>
              <div className="admin-detail-row">
                <span className="admin-detail-key">Node.js Version</span>
                <span className="admin-detail-val admin-mono">{data.system.nodeVersion}</span>
              </div>
              <div className="admin-detail-row">
                <span className="admin-detail-key">Environment</span>
                <span className="admin-detail-val admin-mono">{data.system.environment}</span>
              </div>
              <div className="admin-detail-row">
                <span className="admin-detail-key">Process Uptime</span>
                <span className="admin-detail-val admin-mono">{data.system.uptime}</span>
              </div>
              <div className="admin-detail-row">
                <span className="admin-detail-key">Platform</span>
                <span className="admin-detail-val admin-mono">{data.system.platform}</span>
              </div>
              <div className="admin-detail-row">
                <span className="admin-detail-key">Server Time</span>
                <span className="admin-detail-val admin-mono">{data.system.serverTime}</span>
              </div>
            </div>

            {/* Database & Storage */}
            <div className="admin-detail-box">
              <h3>Database Health</h3>
              <div className="admin-detail-row">
                <span className="admin-detail-key">MongoDB State</span>
                <span className="admin-detail-val">
                  <span className="admin-badge admin-badge-success">{data.database.status}</span>
                </span>
              </div>
              <div className="admin-detail-row">
                <span className="admin-detail-key">Database Engine</span>
                <span className="admin-detail-val">{data.database.engine}</span>
              </div>
              <div className="admin-detail-row">
                <span className="admin-detail-key">Connection Target</span>
                <span className="admin-detail-val admin-mono">{data.database.host}</span>
              </div>
              <div className="admin-detail-row">
                <span className="admin-detail-key">Mongoose ReadyState</span>
                <span className="admin-detail-val admin-mono">{data.database.readyState}</span>
              </div>
            </div>

            {/* MCP & Communications */}
            <div className="admin-detail-box">
              <h3>Integrations & Protocol</h3>
              <div className="admin-detail-row">
                <span className="admin-detail-key">MCP Protocol State</span>
                <span className="admin-detail-val">
                  <span className="admin-badge admin-badge-success">{data.mcp.status}</span>
                </span>
              </div>
              <div className="admin-detail-row">
                <span className="admin-detail-key">MCP Protocol Spec</span>
                <span className="admin-detail-val admin-mono">{data.versions.mcpProtocol}</span>
              </div>
              <div className="admin-detail-row">
                <span className="admin-detail-key">Streamable Transport</span>
                <span className="admin-detail-val admin-mono">{data.mcp.streamableEndpoint}</span>
              </div>
              <div className="admin-detail-row">
                <span className="admin-detail-key">SSE Transport</span>
                <span className="admin-detail-val admin-mono">{data.mcp.sseEndpoint}</span>
              </div>
              <div className="admin-detail-row">
                <span className="admin-detail-key">Email Service Mode</span>
                <span className="admin-detail-val">{data.email.mode}</span>
              </div>
            </div>

            {/* Memory Usage */}
            <div className="admin-detail-box">
              <h3>Memory Utilization</h3>
              <div className="admin-detail-row">
                <span className="admin-detail-key">Resident Set (RSS)</span>
                <span className="admin-detail-val admin-mono">{data.memory.rssMb} MB</span>
              </div>
              <div className="admin-detail-row">
                <span className="admin-detail-key">Heap Allocated</span>
                <span className="admin-detail-val admin-mono">{data.memory.heapTotalMb} MB</span>
              </div>
              <div className="admin-detail-row">
                <span className="admin-detail-key">Heap Used</span>
                <span className="admin-detail-val admin-mono">{data.memory.heapUsedMb} MB</span>
              </div>
              <div className="admin-detail-row">
                <span className="admin-detail-key">External Memory</span>
                <span className="admin-detail-val admin-mono">{data.memory.externalMb} MB</span>
              </div>
            </div>
          </div>

          {/* Environment Variables Verification Checklist */}
          <section style={{ marginTop: '24px' }}>
            <div style={{ marginBottom: '12px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: '600', margin: '0 0 4px 0' }}>
                Environment Configuration Status
              </h2>
              <p style={{ margin: 0, fontSize: '13px', color: '#656d76' }}>
                Audits presence of critical application environment variables. Plaintext secret values are never exposed.
              </p>
            </div>

            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Variable Identifier</th>
                    <th>Audit Status</th>
                    <th>Readiness</th>
                  </tr>
                </thead>
                <tbody>
                  {data.envChecklist.map((item) => (
                    <tr key={item.key}>
                      <td className="admin-mono" style={{ fontWeight: '500' }}>
                        {item.key}
                      </td>
                      <td>
                        <span
                          className={`admin-badge ${
                            item.configured ? 'admin-badge-success' : 'admin-badge-disabled'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td style={{ color: item.configured ? '#1f2328' : '#656d76', fontSize: '12px' }}>
                        {item.configured ? 'Ready for production workloads' : 'Missing or fallback defaults in use'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </section>
  );
};

export default AdminSystemPage;
