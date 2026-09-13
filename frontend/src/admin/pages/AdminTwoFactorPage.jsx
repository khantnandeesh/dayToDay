import React, { useState, useEffect } from 'react';
import adminApi from '../services/adminApi';
import ConfirmDialog from '../components/ConfirmDialog';

export const AdminTwoFactorPage = () => {
  const [challenges, setChallenges] = useState([]);
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

  const fetchChallenges = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getTwoFactorChallenges();
      if (data.success) {
        setChallenges(data.challenges);
      }
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to fetch 2FA challenges');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    adminApi.getTwoFactorChallenges().then((data) => {
      if (!ignore && data.success) {
        setChallenges(data.challenges);
      }
    }).catch((err) => {
      if (!ignore) {
        setMessage(err.response?.data?.message || 'Failed to fetch 2FA challenges');
      }
    });
    return () => { ignore = true; };
  }, []);

  const handleInvalidate = (user) => {
    setDialogState({
      isOpen: true,
      title: 'Invalidate 2FA Challenge',
      message: `Revoke the active two-factor verification challenge for ${user.email}? The user will be required to authenticate with password again.`,
      danger: true,
      confirmText: 'Revoke Challenge',
      onConfirm: async () => {
        try {
          const res = await adminApi.invalidate2faChallenge(user.userId);
          setMessage(res.message);
          setDialogState((prev) => ({ ...prev, isOpen: false }));
          fetchChallenges();
        } catch (err) {
          setMessage(err.response?.data?.message || 'Failed to invalidate 2FA');
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
          <h1 className="admin-page-title">2FA Management</h1>
          <p className="admin-page-desc">Inspect multi-factor authentication statuses, challenge lifecycles, and revoke active challenges</p>
        </div>
        <button
          type="button"
          className="admin-btn admin-btn-sm"
          onClick={fetchChallenges}
        >
          Refresh
        </button>
      </header>

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
          Zero-Knowledge 2FA Security Architecture
        </div>
        <div style={{ color: '#656d76', lineHeight: 1.4 }}>
          Verification codes are securely digested with SHA-256 prior to storage and compared using constant-time cryptographic primitives. Plaintext verification tokens are never stored, displayed, or accessible via the admin interface.
        </div>
      </div>

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

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>User Account</th>
              <th>2FA Enforced</th>
              <th>Status</th>
              <th>Code Issued</th>
              <th>Expires At</th>
              <th>Attempts</th>
              <th>Originated IP</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && challenges.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '24px', color: '#656d76' }}>
                  Loading 2FA challenges...
                </td>
              </tr>
            ) : challenges.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '24px', color: '#656d76' }}>
                  No active or configured 2FA users found.
                </td>
              </tr>
            ) : (
              challenges.map((c) => (
                <tr key={c.userId}>
                  <td>
                    <span style={{ fontWeight: '500' }}>{c.name}</span>
                    <div className="admin-mono" style={{ fontSize: '11px', color: '#656d76' }}>
                      {c.email}
                    </div>
                  </td>
                  <td>
                    <span
                      className={`admin-badge ${
                        c.twoFactorEnabled ? 'admin-badge-active' : ''
                      }`}
                    >
                      {c.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`admin-badge ${
                        c.status === 'Pending Verification'
                          ? 'admin-badge-warn'
                          : c.status === 'Verified'
                          ? 'admin-badge-success'
                          : ''
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="admin-mono">{formatTime(c.codeCreatedAt)}</td>
                  <td className="admin-mono">{formatTime(c.expiresAt)}</td>
                  <td className="admin-mono">{c.attempts} / 5</td>
                  <td className="admin-mono">{c.createdFromIp}</td>
                  <td style={{ textAlign: 'right' }}>
                    {c.hasPendingChallenge ? (
                      <button
                        type="button"
                        className="admin-btn admin-btn-sm admin-btn-danger"
                        onClick={() => handleInvalidate(c)}
                      >
                        Revoke Challenge
                      </button>
                    ) : (
                      <span style={{ color: '#656d76', fontSize: '12px' }}>—</span>
                    )}
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
    </section>
  );
};

export default AdminTwoFactorPage;
