import React from 'react';
import { NavLink } from 'react-router-dom';

const navItems = [
  { path: '/admin', label: 'Dashboard', exact: true },
  { path: '/admin/users', label: 'Users' },
  { path: '/admin/sessions', label: 'Sessions' },
  { path: '/admin/auth', label: 'Authentication' },
  { path: '/admin/2fa', label: '2FA Management' },
  { path: '/admin/devices', label: 'Devices' },
  { path: '/admin/mcp', label: 'MCP / Connected Apps' },
  { path: '/admin/system', label: 'System' },
  { path: '/admin/logs', label: 'Logs' },
];

export const AdminNav = () => {
  return (
    <nav className="admin-sidebar" aria-label="Admin Navigation">
      <ul className="admin-nav-list">
        {navItems.map((item) => (
          <li key={item.path}>
            <NavLink
              to={item.path}
              end={item.exact}
              className={({ isActive }) =>
                `admin-nav-link ${isActive ? 'active' : ''}`
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="admin-nav-divider" />
      <div style={{ padding: '4px 10px', fontSize: '12px', color: '#656d76' }}>
        <a
          href="/dashboard"
          style={{ color: '#656d76', textDecoration: 'none' }}
          target="_blank"
          rel="noreferrer"
        >
          &larr; View Main Site
        </a>
      </div>
    </nav>
  );
};

export default AdminNav;
