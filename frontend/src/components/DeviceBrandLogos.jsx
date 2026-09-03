import React from 'react';

/**
 * High-quality SVG brand logos for operating systems and web browsers
 */

export const AppleLogo = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 170 170" fill="currentColor">
    <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.69-7.85-12-14.43-6.28-9.68-11.19-20.61-14.73-32.8-3.53-12.2-5.3-23.75-5.3-34.66 0-16.14 4.14-29.35 12.43-39.63 8.28-10.27 18.7-15.53 31.25-15.77 5.1 0 10.63 1.34 16.59 4.01 5.96 2.68 9.94 4.07 11.94 4.19 1.63 0 5.86-1.46 12.69-4.38 6.83-2.92 12.59-4.14 17.29-3.66 12.7.97 22.8 5.72 30.29 14.25-11.07 6.69-16.48 16.03-16.24 28.02.24 9.49 3.84 17.53 10.8 24.13 6.96 6.6 15.22 10.42 24.78 11.45-2.07 6.33-4.57 12.83-7.51 19.5zM119.22 31.84c0-7.39 2.66-14.36 7.98-20.91 5.32-6.55 11.83-10.43 19.53-11.64.24 1.09.36 2.06.36 2.91 0 7.39-2.78 14.42-8.33 21.09-5.55 6.67-12.18 10.46-19.89 11.37-.12-.85-.18-1.79-.18-2.82z" />
  </svg>
);

export const WindowsLogo = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 88 88" fill="currentColor">
    <path d="M0 12.402l35.689-4.86v33.447H0V12.402zm35.689 32.535v33.46L0 73.54V44.937h35.689zm4.843-38.11L88 0v40.989H40.532V6.827zm47.468 38.11V88L40.532 79.117V44.937H88z" />
  </svg>
);

export const LinuxLogo = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
    <line x1="8" y1="21" x2="16" y2="21"></line>
    <line x1="12" y1="17" x2="12" y2="21"></line>
    <polyline points="6 8 10 12 6 16"></polyline>
    <line x1="13" y1="16" x2="17" y2="16"></line>
  </svg>
);

export const AndroidLogo = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.551 0 .9996.4482.9996.9993.0001.5511-.4486.9997-.9996.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9996.4482.9996.9993 0 .5511-.4485.9997-.9996.9997m11.4045-6.02l1.996-3.4572c.1556-.2696.0633-.6141-.2063-.7698-.2698-.1558-.6142-.0634-.7699.2063l-2.0287 3.5139c-1.4284-.6519-3.0337-1.0152-4.7577-1.0152-1.724 0-3.3292.3633-4.7576 1.0152L4.0886 5.3007c-.1557-.2697-.5001-.3621-.7699-.2063-.2696.1557-.3619.5002-.2063.7698l1.996 3.4572C2.0834 10.9882 0 14.3353 0 18.2562h24c0-3.9209-2.0834-7.268-5.1185-8.9348" />
  </svg>
);

export const ChromeLogo = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path fill="#EA4335" d="M12 2C7.3 2 3.37 5.25 2.29 9.61l5.52 9.56A9.99 9.99 0 0 1 12 2z" />
    <path fill="#4285F4" d="M12 2c5.52 0 10 4.48 10 10 0 1.25-.23 2.45-.65 3.56L12 2z" />
    <path fill="#FBBC05" d="M2.29 9.61A9.96 9.96 0 0 0 2 12c0 5.52 4.48 10 10 10 3.19 0 6.04-1.5 7.85-3.83L12 12H2.29z" />
    <path fill="#34A853" d="M12 22a9.98 9.98 0 0 0 9.35-6.44L12 12v10z" />
    <circle cx="12" cy="12" r="5" fill="#FFFFFF" />
    <circle cx="12" cy="12" r="4" fill="#1A73E8" />
  </svg>
);

export const SafariLogo = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="#007AFF" strokeWidth="2" fill="#007AFF" fillOpacity="0.1" />
    <path
      d="M15.5 8.5L13.2 13.2L8.5 15.5L10.8 10.8L15.5 8.5Z"
      fill="#FF2D55"
      stroke="#FF2D55"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12" r="1.5" fill="#007AFF" />
  </svg>
);

export const FirefoxLogo = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" fill="#FF7139" />
    <circle cx="12" cy="12" r="7" fill="#0A84FF" />
    <path
      d="M12 4C14 4 19 8 18 14C17 19 13 20 12 20C7 20 4 16 5 12C6 8 9 6 12 4Z"
      fill="#FF3B30"
      fillOpacity="0.8"
    />
  </svg>
);

export const EdgeLogo = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" fill="#0078D7" fillOpacity="0.15" />
    <path
      d="M12 3C7.03 3 3 7.03 3 12C3 16.97 7.03 21 12 21C16.97 21 21 16.97 21 12C21 8.5 18 5 13 5C9 5 6 8 6 11C6 14 9 16 12 16C15 16 17 14 17 12"
      stroke="#0078D7"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  </svg>
);

/**
 * Component rendering matching OS logo
 */
export const DeviceOsLogo = ({ os = '', brand = '', className = 'w-5 h-5' }) => {
  const normalized = `${os} ${brand}`.toLowerCase();

  if (normalized.includes('mac') || normalized.includes('apple') || normalized.includes('ios')) {
    return <AppleLogo className={className} />;
  }
  if (normalized.includes('win')) {
    return <WindowsLogo className={className} />;
  }
  if (normalized.includes('android')) {
    return <AndroidLogo className={className} />;
  }
  if (normalized.includes('linux')) {
    return <LinuxLogo className={className} />;
  }

  // Generic fallback
  return <AppleLogo className={className} />;
};

/**
 * Component rendering matching browser logo
 */
export const DeviceBrowserLogo = ({ browser = '', className = 'w-5 h-5' }) => {
  const normalized = (browser || '').toLowerCase();

  if (normalized.includes('chrome')) {
    return <ChromeLogo className={className} />;
  }
  if (normalized.includes('safari')) {
    return <SafariLogo className={className} />;
  }
  if (normalized.includes('firefox')) {
    return <FirefoxLogo className={className} />;
  }
  if (normalized.includes('edge')) {
    return <EdgeLogo className={className} />;
  }

  // Fallback to Chrome
  return <ChromeLogo className={className} />;
};

export default {
  AppleLogo,
  WindowsLogo,
  LinuxLogo,
  AndroidLogo,
  ChromeLogo,
  SafariLogo,
  FirefoxLogo,
  EdgeLogo,
  DeviceOsLogo,
  DeviceBrowserLogo,
};
