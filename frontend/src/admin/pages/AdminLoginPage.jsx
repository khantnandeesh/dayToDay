import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import '../admin.css';

export const AdminLoginPage = () => {
  const { login } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('nandeesh@nandeesh.dev');
  const [password, setPassword] = useState('Admin@123456');
  const [error, setError] = useState(
    location.search.includes('session_expired') ? 'Your administrative session has expired. Please sign in again.' : ''
  );
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Administrative login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="admin-root"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#ffffff',
        padding: '16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '380px',
          border: '1px solid #24292f',
          padding: '24px',
          borderRadius: '3px',
          backgroundColor: '#ffffff',
        }}
      >
        <div style={{ marginBottom: '20px', borderBottom: '1px solid #d0d7de', pb: '12px', paddingBottom: '12px' }}>
          <h1 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 4px 0' }}>
            nandeesh.dev
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: '#656d76' }}>
            Administrative Control Panel
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: '8px 12px',
              border: '1px solid #24292f',
              backgroundColor: '#f6f8fa',
              color: '#1f2328',
              fontSize: '13px',
              marginBottom: '16px',
              borderRadius: '2px',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="admin-form-group">
            <label className="admin-label" htmlFor="admin-email">
              Administrator Email
            </label>
            <input
              id="admin-email"
              type="email"
              className="admin-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="admin-form-group">
            <label className="admin-label" htmlFor="admin-password">
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              className="admin-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div style={{ marginTop: '20px' }}>
            <button
              type="submit"
              className="admin-btn admin-btn-primary"
              style={{ width: '100%', padding: '7px' }}
              disabled={loading}
            >
              {loading ? 'Authenticating...' : 'Sign In as Administrator'}
            </button>
          </div>
        </form>

        <div
          style={{
            marginTop: '20px',
            paddingTop: '12px',
            borderTop: '1px solid #d0d7de',
            fontSize: '12px',
            color: '#656d76',
            lineHeight: 1.4,
          }}
        >
          <div>Default Admin: <code className="admin-mono">nandeesh@nandeesh.dev</code></div>
          <div>Password: <code className="admin-mono">Admin@123456</code></div>
          <div style={{ marginTop: '8px' }}>
            <a href="/login" style={{ color: '#656d76', textDecoration: 'underline' }}>
              &larr; Return to public site
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginPage;
