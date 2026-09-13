import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import adminApi from '../services/adminApi';
import ConfirmDialog from '../components/ConfirmDialog';

export const AdminDevicesPage = () => {
  const [devices, setDevices] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [deviceType, setDeviceType] = useState('all');
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

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        search: search.trim() || undefined,
        status: status !== 'all' ? status : undefined,
        deviceType: deviceType !== 'all' ? deviceType : undefined,
      };
      const data = await adminApi.getDevices(params);
      if (data.success) {
        setDevices(data.devices);
      }
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  }, [search, status, deviceType]);

  useEffect(() => {
    let ignore = false;
    const params = {
      search: search.trim() || undefined,
      status: status !== 'all' ? status : undefined,
      deviceType: deviceType !== 'all' ? deviceType : undefined,
    };
    adminApi.getDevices(params).then((data) => {
      if (!ignore && data.success) {
        setDevices(data.devices);
      }
    }).catch((err) => {
      if (!ignore) {
        setMessage(err.response?.data?.message || 'Failed to load devices');
      }
    });
    return () => { ignore = true; };
  }, [search, status, deviceType]);

  const handleRevokeDevice = (dev) => {
    setDialogState({
      isOpen: true,
      title: 'Revoke Device Sessions',
      message: `Revoke all sessions originating from device "${dev.deviceName}" (${dev.browser} / ${dev.os}) for ${dev.userEmail}?`,
      danger: true,
      confirmText: 'Revoke Device',
      onConfirm: async () => {
        try {
          const res = await adminApi.revokeDevice(dev.deviceId, dev.userId);
          setMessage(res.message);
          setDialogState((prev) => ({ ...prev, isOpen: false }));
          fetchDevices();
        } catch (err) {
          setMessage(err.response?.data?.message || 'Failed to revoke device');
          setDialogState((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const formatTime = (iso) => {
    if (!iso) return '—';
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
          <h1 className="admin-page-title">Device Management</h1>
          <p className="admin-page-desc">Fingerprint telemetry and parsed user agents across client devices</p>
        </div>
        <button
          type="button"
          className="admin-btn admin-btn-sm"
          onClick={fetchDevices}
        >
          Refresh
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

      {/* Filter Bar */}
      <div className="admin-filter-bar">
        <input
          type="text"
          placeholder="Search by user, IP, browser, OS..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: '240px' }}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">Status: All</option>
          <option value="active">Active Now</option>
          <option value="inactive">Inactive</option>
        </select>
        <select value={deviceType} onChange={(e) => setDeviceType(e.target.value)}>
          <option value="all">Device Type: All</option>
          <option value="desktop">Desktop</option>
          <option value="mobile">Mobile</option>
          <option value="tablet">Tablet</option>
        </select>
        <button
          type="button"
          className="admin-btn admin-btn-sm"
          onClick={fetchDevices}
        >
          Filter
        </button>
      </div>

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Browser</th>
              <th>Version</th>
              <th>Operating System</th>
              <th>Device Type</th>
              <th>Last IP</th>
              <th>First Seen</th>
              <th>Last Active</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && devices.length === 0 ? (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '24px', color: '#656d76' }}>
                  Loading device directory...
                </td>
              </tr>
            ) : devices.length === 0 ? (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '24px', color: '#656d76' }}>
                  No devices recorded.
                </td>
              </tr>
            ) : (
              devices.map((dev, idx) => (
                <tr key={`${dev.userId}_${dev.deviceId}_${idx}`}>
                  <td>
                    <Link
                      to={`/admin/users/${dev.userId}`}
                      style={{ color: '#1f2328', textDecoration: 'underline', fontWeight: '500' }}
                    >
                      {dev.userName}
                    </Link>
                    <div className="admin-mono" style={{ fontSize: '11px', color: '#656d76' }}>
                      {dev.userEmail}
                    </div>
                  </td>
                  <td>{dev.browser}</td>
                  <td className="admin-mono">{dev.browserVersion || '—'}</td>
                  <td>{dev.os} {dev.osVersion}</td>
                  <td>
                    <span className="admin-badge">{dev.deviceType}</span>
                  </td>
                  <td className="admin-mono">{dev.ip}</td>
                  <td className="admin-mono">{formatTime(dev.firstSeen)}</td>
                  <td className="admin-mono">{formatTime(dev.lastSeen)}</td>
                  <td>
                    <span
                      className={`admin-badge ${
                        dev.isActive ? 'admin-badge-success' : 'admin-badge-disabled'
                      }`}
                    >
                      {dev.isActive ? 'Active' : 'Idle'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {dev.isActive && (
                      <button
                        type="button"
                        className="admin-btn admin-btn-sm admin-btn-danger"
                        onClick={() => handleRevokeDevice(dev)}
                      >
                        Revoke
                      </button>
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

export default AdminDevicesPage;
