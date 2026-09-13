import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import adminApi from '../services/adminApi';
import ConfirmDialog from '../components/ConfirmDialog';

export const AdminMcpDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [client, setClient] = useState(null);
  const [activity, setActivity] = useState([]);
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

  const loadClient = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.getMcpClientDetails(id);
      if (data.success) {
        setClient(data.client);
        setActivity(data.activity || []);
      }
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to load client details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let ignore = false;
    adminApi.getMcpClientDetails(id).then((data) => {
      if (!ignore && data.success) {
        setClient(data.client);
        setActivity(data.activity || []);
      }
    }).catch((err) => {
      if (!ignore) {
        setMessage(err.response?.data?.message || 'Failed to load client details');
      }
    });
    return () => { ignore = true; };
  }, [id]);

  const handleToggleStatus = async () => {
    try {
      const res = await adminApi.toggleClientStatus(id);
      setMessage(res.message);
      loadClient();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to toggle client status');
    }
  };

  const handleDeleteClient = () => {
    setDialogState({
      isOpen: true,
      title: 'Delete OAuth Client',
      message: `Permanently delete client "${client.clientName}"? Any AI agent relying on this client ID will lose access.`,
      danger: true,
      confirmText: 'Delete Permanently',
      onConfirm: async () => {
        try {
          await adminApi.deleteMcpClient(id);
          navigate('/admin/mcp');
        } catch (err) {
          setMessage(err.response?.data?.message || 'Failed to delete client');
          setDialogState((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const formatTime = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString();
  };

  if (loading && !client) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center', color: '#656d76' }}>
        Loading OAuth client data...
      </div>
    );
  }

  if (!client) {
    return (
      <div style={{ padding: '24px 0' }}>
        <p>OAuth Client not found.</p>
        <Link to="/admin/mcp" className="admin-btn admin-btn-sm">
          &larr; Back to MCP Clients
        </Link>
      </div>
    );
  }

  return (
    <section>
      <header className="admin-page-header">
        <div>
          <div style={{ marginBottom: '4px' }}>
            <Link to="/admin/mcp" style={{ color: '#656d76', textDecoration: 'none', fontSize: '12px' }}>
              &larr; Back to MCP & Connected Apps
            </Link>
          </div>
          <h1 className="admin-page-title">{client.clientName}</h1>
          <p className="admin-page-desc admin-mono">{client.clientId}</p>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            className="admin-btn admin-btn-sm"
            onClick={handleToggleStatus}
          >
            {client.status === 'active' ? 'Revoke Client' : 'Activate Client'}
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-sm admin-btn-danger"
            onClick={handleDeleteClient}
          >
            Delete Client
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
          <h3>OAuth Configuration</h3>
          <div className="admin-detail-row">
            <span className="admin-detail-key">Client ID</span>
            <span className="admin-detail-val admin-mono">{client.clientId}</span>
          </div>
          <div className="admin-detail-row">
            <span className="admin-detail-key">Client Secret</span>
            <span className="admin-detail-val admin-mono">•••••••••••••••• (Hashed)</span>
          </div>
          <div className="admin-detail-row">
            <span className="admin-detail-key">Status</span>
            <span className="admin-detail-val">
              <span
                className={`admin-badge ${
                  client.status === 'active' ? 'admin-badge-success' : 'admin-badge-disabled'
                }`}
              >
                {client.status}
              </span>
            </span>
          </div>
          <div className="admin-detail-row">
            <span className="admin-detail-key">Created Date</span>
            <span className="admin-detail-val admin-mono">{formatTime(client.createdAt)}</span>
          </div>
          <div className="admin-detail-row">
            <span className="admin-detail-key">Last Used</span>
            <span className="admin-detail-val admin-mono">{formatTime(client.lastUsed)}</span>
          </div>
        </div>

        <div className="admin-detail-box">
          <h3>Grant & Endpoint Settings</h3>
          <div className="admin-detail-row">
            <span className="admin-detail-key">Grant Types</span>
            <span className="admin-detail-val admin-mono">
              {client.grantTypes ? client.grantTypes.join(', ') : 'authorization_code'}
            </span>
          </div>
          <div className="admin-detail-row">
            <span className="admin-detail-key">Response Types</span>
            <span className="admin-detail-val admin-mono">
              {client.responseTypes ? client.responseTypes.join(', ') : 'code'}
            </span>
          </div>
          <div style={{ marginTop: '10px' }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#656d76', marginBottom: '4px' }}>
              Configured Redirect URIs
            </div>
            <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px' }} className="admin-mono">
              {client.redirectUris && client.redirectUris.map((uri, idx) => (
                <li key={idx} style={{ wordBreak: 'break-all' }}>{uri}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Activity table */}
      <section>
        <h2 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '10px' }}>
          Recent OAuth Usage & Authorization Logs
        </h2>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Event</th>
                <th>User / Agent</th>
                <th>Origin IP</th>
                <th>Result</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {activity.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '16px', color: '#656d76' }}>
                    No recorded authorization requests for this client yet.
                  </td>
                </tr>
              ) : (
                activity.map((item, idx) => (
                  <tr key={item._id || idx}>
                    <td className="admin-mono">{formatTime(item.timestamp)}</td>
                    <td>
                      <span className="admin-badge">{item.event}</span>
                    </td>
                    <td className="admin-mono">{item.user || 'AI Agent'}</td>
                    <td className="admin-mono">{item.ip || '127.0.0.1'}</td>
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

export default AdminMcpDetailsPage;
