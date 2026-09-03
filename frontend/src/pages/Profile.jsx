import { useState, useEffect } from 'react';
import {
    Monitor, Shield, Activity, Smartphone, Clock, Globe,
    Trash2, AlertCircle, Sparkles, Key, Lock, PowerOff,
    Fingerprint, ShieldCheck, RefreshCw, CheckCircle2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useVault } from '../context/VaultContext';
import api from '../config/api';
import Navbar from '../components/Navbar';
import McpVaultAuthModal from '../components/vault/McpVaultAuthModal';
import { DeviceOsLogo, DeviceBrowserLogo } from '../components/DeviceBrandLogos';

const formatDate = (date) => {
    return new Date(date).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const formatTimeAgo = (date) => {
    if (!date) return 'Recently';
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatIpAddress = (ip) => {
    if (!ip || ip === 'Unknown') return 'Direct Network';
    const clean = String(ip).replace(/^::ffff:/, '');
    if (clean === '127.0.0.1' || clean === '::1') return '127.0.0.1 (Localhost)';
    if (clean.startsWith('10.') || clean.startsWith('172.16.') || clean.startsWith('192.168.')) {
        return `${clean} (Cloud Proxy/Gateway)`;
    }
    return clean;
};

const Profile = () => {
    const { user, updateUser } = useAuth();
    const { mcpSession, openMcpAuthModal, isMcpAuthModalOpen, closeMcpAuthModal, revokeMcpSession } = useVault();
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);
    const [configLoading, setConfigLoading] = useState(false);

    const fetchDevices = async () => {
        try {
            const response = await api.get('/auth/devices');
            if (response.data.success) {
                setDevices(response.data.devices);
            }
        } catch (error) {
            console.error('Error fetching devices:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let isMounted = true;
        const load = async () => {
            try {
                const response = await api.get('/auth/devices');
                if (isMounted && response.data.success) {
                    setDevices(response.data.devices);
                }
            } catch (error) {
                console.error('Error fetching devices:', error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        load();
        return () => { isMounted = false; };
    }, []);

    const handleToggle2FA = async () => {
        setConfigLoading(true);
        try {
            const response = await api.put('/auth/2fa', { enabled: !user.twoFactorEnabled });
            if (response.data.success) {
                updateUser({ ...user, twoFactorEnabled: response.data.twoFactorEnabled });
            }
        } catch (error) {
            console.error('Error toggling 2FA:', error);
            alert('Failed to update settings');
        } finally {
            setConfigLoading(false);
        }
    };

    const handleLogoutDevice = async (sessionId) => {
        if (!confirm('Are you sure you want to logout this device?')) return;

        setActionLoading(sessionId);
        try {
            const response = await api.delete(`/auth/devices/${sessionId}`);
            if (response.data.success) {
                setDevices(devices.filter((d) => d.id !== sessionId));
            }
        } catch (error) {
            console.error('Error logging out device:', error);
            alert('Failed to logout device');
        } finally {
            setActionLoading(null);
        }
    };

    const handleLogoutAll = async () => {
        if (!confirm('Are you sure you want to logout from all other devices?')) return;

        setActionLoading('all');
        try {
            const response = await api.post('/auth/logout-all');
            if (response.data.success) {
                fetchDevices();
            }
        } catch (error) {
            console.error('Error logging out all devices:', error);
            alert('Failed to logout all devices');
        } finally {
            setActionLoading(null);
        }
    };

    const getSecurityStatus = () => {
        const issues = [];

        if (!user.twoFactorEnabled) {
            issues.push('Enable 2FA');
        }

        if (devices.length > 3) {
            issues.push('Check active sessions');
        }

        if (issues.length === 0) {
            return {
                label: 'Protected',
                colorClass: 'bg-green-100 text-green-700',
                iconColor: 'bg-green-50 text-green-600',
                message: 'No security issues found'
            };
        } else {
            return {
                label: 'Action Needed',
                colorClass: 'bg-amber-100 text-amber-700',
                iconColor: 'bg-amber-50 text-amber-600',
                message: issues.join(', ') || 'Review security settings'
            };
        }
    };

    const securityStatus = getSecurityStatus();


    return (
        <div className="min-h-screen bg-slate-50">
            <Navbar />

            <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8 animate-fade-in">

                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Your Profile</h1>
                        <p className="text-slate-500">Manage your account security and active sessions</p>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Active Devices Stat */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                <Monitor className="w-6 h-6" />
                            </div>
                            <span className="text-2xl font-bold text-slate-900">{devices.length}</span>
                        </div>
                        <h3 className="font-medium text-slate-700">Active Devices</h3>
                        <p className="text-sm text-slate-500 mt-1">Currently logged in sessions</p>
                    </div>

                    {/* 2FA Status */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div className={`p-2 rounded-lg ${user?.twoFactorEnabled ? 'bg-green-50 text-green-600' : 'bg-slate-50 text-slate-500'}`}>
                                <Shield className="w-6 h-6" />
                            </div>

                            <button
                                onClick={handleToggle2FA}
                                disabled={configLoading}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 ${user?.twoFactorEnabled ? 'bg-green-500' : 'bg-slate-200'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${user?.twoFactorEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>
                        <h3 className="font-medium text-slate-700">Two-Factor Auth</h3>
                        <p className="text-sm text-slate-500 mt-1">
                            {user?.twoFactorEnabled ? 'Enhanced security enabled' : 'Security disabled'}
                        </p>
                    </div>

                    {/* Account Status */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div className={`p-2 rounded-lg ${securityStatus.iconColor}`}>
                                <Activity className="w-6 h-6" />
                            </div>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${securityStatus.colorClass}`}>
                                {securityStatus.label}
                            </span>
                        </div>
                        <h3 className="font-medium text-slate-700">Account Status</h3>
                        <p className="text-sm text-slate-500 mt-1">{securityStatus.message}</p>
                    </div>
                </div>

                {/* AI Assistant MCP Vault Security Banner */}
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl border border-indigo-900/40 relative overflow-hidden">
                    <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-indigo-600 rounded-xl text-white shadow-lg shrink-0">
                                <Sparkles className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="flex items-center gap-3">
                                    <h2 className="text-lg font-bold text-white">AI Assistant Vault Authorization</h2>
                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${mcpSession?.isAuthorized ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-700 text-slate-300'}`}>
                                        {mcpSession?.isAuthorized ? `Active (${mcpSession.remainingMinutes}m remaining)` : 'Locked / Inactive'}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-300 mt-1 max-w-xl">
                                    Safely authorize ChatGPT and AI MCP tools with temporary memory tokens or session grants. Your master password is never revealed in AI chat messages.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 w-full md:w-auto">
                            {mcpSession?.isAuthorized ? (
                                <>
                                    <button
                                        onClick={revokeMcpSession}
                                        className="flex-1 md:flex-none px-4 py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
                                    >
                                        <PowerOff className="w-4 h-4" />
                                        Revoke AI Access
                                    </button>
                                    <button
                                        onClick={openMcpAuthModal}
                                        className="flex-1 md:flex-none px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors shadow-lg shadow-indigo-900/30 flex items-center justify-center gap-2"
                                    >
                                        <Key className="w-4 h-4" />
                                        Manage Access / Token
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={openMcpAuthModal}
                                    className="w-full md:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-900/40 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    <Lock className="w-4 h-4" />
                                    Authorize AI MCP Session
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Active Sessions Section */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                <Smartphone className="w-5 h-5 text-indigo-600" />
                                Active Devices & Recognized Sessions
                            </h2>
                            <p className="text-sm text-slate-500 mt-1">
                                Devices authenticated with Single Sign-On (SSO) hardware recognition
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={fetchDevices}
                                disabled={loading}
                                className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                                title="Refresh devices"
                            >
                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                            {devices.length > 1 && (
                                <button
                                    onClick={handleLogoutAll}
                                    disabled={actionLoading === 'all'}
                                    className="px-3.5 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 text-red-600 border border-red-200 hover:bg-red-50 hover:border-red-300 transition-colors"
                                >
                                    <AlertCircle className="w-4 h-4" />
                                    {actionLoading === 'all' ? 'Revoking...' : 'Logout Other Devices'}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* SSO Security Notice */}
                    <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2.5 text-xs text-slate-600">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>
                            <strong>SSO Device Identity:</strong> Each device is assigned a persistent cryptographic signature to reliably differentiate separate hardware across changing IP addresses and proxy networks.
                        </span>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {loading ? (
                            <div className="p-10 text-center text-slate-500 flex flex-col items-center">
                                <div className="w-7 h-7 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin mb-3"></div>
                                <span className="text-sm">Verifying active sessions...</span>
                            </div>
                        ) : devices.length === 0 ? (
                            <div className="p-10 text-center text-slate-500">
                                No active sessions found.
                            </div>
                        ) : (
                            devices.map((device) => (
                                <div
                                    key={device.id}
                                    className={`p-6 transition-colors ${
                                        device.isCurrent
                                            ? 'bg-indigo-50/30'
                                            : 'hover:bg-slate-50/80'
                                    }`}
                                >
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                                        <div className="flex items-start gap-4">
                                            {/* Combined OS & Browser Logos */}
                                            <div className="relative shrink-0">
                                                <div
                                                    className={`w-13 h-13 rounded-2xl flex items-center justify-center border shadow-xs transition-transform ${
                                                        device.isCurrent
                                                            ? 'bg-white border-indigo-200 text-slate-900 ring-2 ring-indigo-500/20'
                                                            : 'bg-white border-slate-200 text-slate-700'
                                                    }`}
                                                >
                                                    <DeviceOsLogo os={device.os} brand={device.brand} className="w-6 h-6" />
                                                </div>
                                                <div
                                                    className="absolute -bottom-1 -right-1 p-1 bg-white rounded-full shadow-md border border-slate-200 flex items-center justify-center"
                                                    title={`Browser: ${device.browser}`}
                                                >
                                                    <DeviceBrowserLogo browser={device.browser} className="w-4 h-4" />
                                                </div>
                                            </div>

                                            {/* Device Info & Identifiers */}
                                            <div className="space-y-2">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h3 className="font-bold text-slate-900 text-base">
                                                        {device.deviceName || `${device.os} Device`}
                                                    </h3>
                                                    {device.isCurrent ? (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                                            Current Device · Active Now
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                                                            <Clock className="w-3 h-3 text-slate-400" />
                                                            Active {formatTimeAgo(device.lastActive)}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Details badges */}
                                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                                    <span className="px-2.5 py-1 rounded-md bg-slate-100 font-medium text-slate-700 border border-slate-200/60">
                                                        {device.os}
                                                    </span>
                                                    <span className="px-2.5 py-1 rounded-md bg-slate-100 font-medium text-slate-700 border border-slate-200/60">
                                                        {device.browser}
                                                    </span>
                                                    <span
                                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-50 font-mono text-indigo-700 border border-indigo-100"
                                                        title={`Unique SSO identifier: ${device.deviceId}`}
                                                    >
                                                        <Fingerprint className="w-3.5 h-3.5 text-indigo-500" />
                                                        SSO ID: {device.deviceId ? device.deviceId.substring(0, 12) + '…' : 'Verified'}
                                                    </span>
                                                </div>

                                                {/* Network and Last Active Metadata */}
                                                <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-xs text-slate-500 pt-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <Globe className="w-3.5 h-3.5 text-slate-400" />
                                                        <span>IP: <strong className="font-mono text-slate-700">{formatIpAddress(device.ip)}</strong></span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                                                        <span>Last seen: {formatDate(device.lastActive)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action buttons */}
                                        <div className="flex items-center self-end md:self-center shrink-0">
                                            {device.isCurrent ? (
                                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                    Active Session
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={() => handleLogoutDevice(device.id)}
                                                    disabled={actionLoading === device.id}
                                                    className="px-3.5 py-2 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 hover:border-red-300 rounded-xl transition-all flex items-center gap-1.5"
                                                    title="Revoke and logout this session"
                                                >
                                                    {actionLoading === device.id ? (
                                                        <div className="w-4 h-4 border-2 border-red-300 border-t-red-600 rounded-full animate-spin"></div>
                                                    ) : (
                                                        <Trash2 className="w-4 h-4" />
                                                    )}
                                                    Revoke Access
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            <McpVaultAuthModal
                isOpen={isMcpAuthModalOpen}
                onClose={closeMcpAuthModal}
            />
        </div>
    );
};

export default Profile;
