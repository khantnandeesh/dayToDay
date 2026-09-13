import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import adminApi from '../services/adminApi';
import ConfirmDialog from '../components/ConfirmDialog';

export const AdminMcpPage = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Register Modal
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    clientName: '',
    redirectUris: '',
    description: '',
  });
  const [newCredentials, setNewCredentials] = useState(null);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState('');

  const [dialogState, setDialogState] = useState({
    isOpen: false,
    title: '',
    message: '',
    danger: false,
    confirmText: 'Confirm',
    onConfirm: () => {},
  });

  const fetchClients = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getMcpClients();
      if (data.success) {
        setClients(data.clients);
      }
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to fetch MCP clients');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    adminApi.getMcpClients().then((data) => {
      if (!ignore && data.success) {
        setClients(data.clients);
      }
    }).catch((err) => {
      if (!ignore) {
        setMessage(err.response?.data?.message || 'Failed to fetch MCP clients');
      }
    });
    return () => { ignore = true; };
  }, []);

  const handleToggleStatus = async (client) => {
    try {
      const res = await adminApi.toggleClientStatus(client._id);
      setMessage(res.message);
      fetchClients();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to toggle client status');
    }
  };

  const handleDeleteClient = (client) => {
    setDialogState({
      isOpen: true,
      title: 'Delete OAuth Client',
      message: `Permanently delete client "${client.clientName}" (${client.clientId})? Any active AI agent connections using these credentials will be severed immediately.`,
      danger: true,
      confirmText: 'Delete Client',
      onConfirm: async () => {
        try {
          const res = await adminApi.deleteMcpClient(client._id);
          setMessage(res.message);
          setDialogState((prev) => ({ ...prev, isOpen: false }));
          fetchClients();
        } catch (err) {
          setMessage(err.response?.data?.message || 'Failed to delete client');
          setDialogState((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setRegisterError('');
    setRegisterLoading(true);

    try {
      const urisArray = registerForm.redirectUris
        .split('\n')
        .map((u) => u.trim())
        .filter(Boolean);

      const res = await adminApi.registerMcpClient({
        clientName: registerForm.clientName,
        redirectUris: urisArray,
        description: registerForm.description,
      });

      if (res.success && res.credentials) {
        setNewCredentials(res.credentials);
        fetchClients();
      }
    } catch (err) {
      setRegisterError(err.response?.data?.message || 'Failed to register client');
    } finally {
      setRegisterLoading(false);
    }
  };

  const formatTime = (iso) => {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <section>
      <header className="admin-page-header">
        <div>
          <h1 className="admin-page-title">MCP & Connected Apps</h1>
          <p className="admin-page-desc">Manage Model Context Protocol (MCP) OAuth clients, AI agent tokens, and redirect URIs</p>
        </div>
        <button
          type="button"
          className="admin-btn admin-btn-primary admin-btn-sm"
          onClick={() => {
            setNewCredentials(null);
            setRegisterForm({ clientName: '', redirectUris: '', description: '' });
            setShowRegisterModal(true);
          }}
        >
          + Register OAuth Client
        </button>
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

      {/* Protocol info block */}
      <div
        style={{
          border: '1px solid #d0d7de',
          backgroundColor: '#f6f8fa',
          padding: '12px 16px',
          marginBottom: '20px',
          fontSize: '13px',
          borderRadius: '3px',
        }}
      >
        <div style={{ fontWeight: '600', marginBottom: '4px' }}>
          MCP Endpoints for AI Agents (Claude Desktop, Cursor, Gemini Studio)
        </div>
        <div className="admin-mono" style={{ fontSize: '12px', color: '#1f2328' }}>
          <div>Streamable HTTP: <span style={{ fontWeight: '600' }}>/mcp</span></div>
          <div>SSE Transport: <span style={{ fontWeight: '600' }}>/mcp/sse</span></div>
          <div>OAuth Authorization Server: <span style={{ fontWeight: '600' }}>/.well-known/oauth-authorization-server</span></div>
        </div>
      </div>

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Client Name</th>
              <th>Client ID</th>
              <th>Redirect URIs</th>
              <th>Created</th>
              <th>Last Used</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && clients.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: '#656d76' }}>
                  Loading registered OAuth clients...
                </td>
              </tr>
            ) : clients.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: '#656d76' }}>
                  No OAuth clients registered.
                </td>
              </tr>
            ) : (
              clients.map((c) => (
                <tr key={c._id}>
                  <td>
                    <Link
                      to={`/admin/mcp/clients/${c._id}`}
                      style={{ color: '#1f2328', textDecoration: 'underline', fontWeight: '500' }}
                    >
                      {c.clientName}
                    </Link>
                    {c.description && (
                      <div style={{ fontSize: '11px', color: '#656d76' }}>{c.description}</div>
                    )}
                  </td>
                  <td className="admin-mono">{c.maskedClientId}</td>
                  <td className="admin-mono" style={{ fontSize: '11px' }}>
                    {Array.isArray(c.redirectUris) ? c.redirectUris.join(', ') : c.redirectUris}
                  </td>
                  <td className="admin-mono">{formatTime(c.createdAt)}</td>
                  <td className="admin-mono">{formatTime(c.lastUsed)}</td>
                  <td>
                    <span
                      className={`admin-badge ${
                        c.status === 'active' ? 'admin-badge-success' : 'admin-badge-disabled'
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '4px' }}>
                      <Link
                        to={`/admin/mcp/clients/${c._id}`}
                        className="admin-btn admin-btn-sm"
                      >
                        Details
                      </Link>
                      <button
                        type="button"
                        className="admin-btn admin-btn-sm"
                        onClick={() => handleToggleStatus(c)}
                      >
                        {c.status === 'active' ? 'Revoke' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn-sm admin-btn-danger"
                        onClick={() => handleDeleteClient(c)}
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

      <ConfirmDialog
        isOpen={dialogState.isOpen}
        title={dialogState.title}
        message={dialogState.message}
        danger={dialogState.danger}
        confirmText={dialogState.confirmText}
        onConfirm={dialogState.onConfirm}
        onCancel={() => setDialogState((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Register Client Modal */}
      {showRegisterModal && (
        <div className="admin-modal-overlay" role="dialog" aria-modal="true">
          <div className="admin-modal" style={{ maxWidth: '540px' }}>
            <h3 className="admin-modal-title">Register OAuth Client</h3>

            {newCredentials ? (
              <div>
                <div
                  style={{
                    padding: '10px 12px',
                    border: '1px solid #000000',
                    backgroundColor: '#f6f8fa',
                    marginBottom: '16px',
                    fontSize: '13px',
                  }}
                >
                  <div style={{ fontWeight: '700', marginBottom: '4px' }}>
                    Save These Credentials Securely
                  </div>
                  <div>
                    The Client Secret is hashed and will NEVER be shown again.
                  </div>
                </div>

                <div className="admin-form-group">
                  <label className="admin-label">Client ID</label>
                  <input
                    type="text"
                    readOnly
                    className="admin-input admin-mono"
                    value={newCredentials.clientId}
                    onClick={(e) => e.target.select()}
                  />
                </div>

                <div className="admin-form-group">
                  <label className="admin-label">Client Secret</label>
                  <input
                    type="text"
                    readOnly
                    className="admin-input admin-mono"
                    value={newCredentials.clientSecret}
                    onClick={(e) => e.target.select()}
                  />
                </div>

                <div className="admin-modal-actions" style={{ marginTop: '20px' }}>
                  <button
                    type="button"
                    className="admin-btn admin-btn-primary admin-btn-sm"
                    onClick={() => {
                      setNewCredentials(null);
                      setShowRegisterModal(false);
                    }}
                  >
                    I have saved my secret
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRegisterSubmit}>
                {registerError && (
                  <div
                    style={{
                      padding: '6px 10px',
                      border: '1px solid #000000',
                      marginBottom: '12px',
                      fontSize: '12px',
                    }}
                  >
                    {registerError}
                  </div>
                )}
                <div className="admin-form-group">
                  <label className="admin-label">Application / Client Name</label>
                  <input
                    type="text"
                    className="admin-input"
                    required
                    placeholder="e.g., Claude Desktop, Cursor Agent"
                    value={registerForm.clientName}
                    onChange={(e) =>
                      setRegisterForm({ ...registerForm, clientName: e.target.value })
                    }
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-label">
                    Allowed Redirect URIs (One URI per line)
                  </label>
                  <textarea
                    rows="3"
                    className="admin-textarea admin-mono"
                    required
                    placeholder="http://localhost:3000/callback&#10;https://oauth.pstmn.io/v1/callback"
                    value={registerForm.redirectUris}
                    onChange={(e) =>
                      setRegisterForm({ ...registerForm, redirectUris: e.target.value })
                    }
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-label">Description (Optional)</label>
                  <input
                    type="text"
                    className="admin-input"
                    placeholder="e.g., Local dev agent access"
                    value={registerForm.description}
                    onChange={(e) =>
                      setRegisterForm({ ...registerForm, description: e.target.value })
                    }
                  />
                </div>
                <div className="admin-modal-actions" style={{ marginTop: '16px' }}>
                  <button
                    type="button"
                    className="admin-btn admin-btn-sm"
                    onClick={() => setShowRegisterModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="admin-btn admin-btn-primary admin-btn-sm"
                    disabled={registerLoading}
                  >
                    {registerLoading ? 'Registering...' : 'Register Client'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default AdminMcpPage;
