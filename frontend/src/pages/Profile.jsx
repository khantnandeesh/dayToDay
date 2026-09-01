import { useState, useEffect } from 'react';
import {
    Monitor, Shield, Activity, Smartphone, Clock, Globe,
    Trash2, AlertCircle, Laptop, Tablet, Command, Terminal, Sparkles, Key, Lock, PowerOff
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useVault } from '../context/VaultContext';
import api from '../config/api';
import Navbar from '../components/Navbar';
import McpVaultAuthModal from '../components/vault/McpVaultAuthModal';

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

    const formatDate = (date) => {
        return new Date(date).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getDeviceIcon = (os, type) => {
        const osLower = (os || '').toLowerCase();
        const typeLower = (type || '').toLowerCase();

        if (typeLower === 'mobile') return <Smartphone className="w-6 h-6" />;
        if (typeLower === 'tablet') return <Tablet className="w-6 h-6" />;

        if (osLower.includes('mac') || osLower.includes('ios')) return <Command className="w-6 h-6" />;
        if (osLower.includes('win')) return <Monitor className="w-6 h-6" />;
        if (osLower.includes('linux')) return <Terminal className="w-6 h-6" />;

        return <Laptop className="w-6 h-6" />;
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
                                <Smartphone className="w-5 h-5 text-slate-500" />
                                Active Sessions
                            </h2>
                            <p className="text-sm text-slate-500 mt-1">Manage devices where you're currently logged in</p>
                        </div>
                        {devices.length > 1 && (
                            <button
                                onClick={handleLogoutAll}
                                disabled={actionLoading === 'all'}
                                className="btn btn-secondary text-sm flex items-center gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                            >
                                <AlertCircle className="w-4 h-4" />
                                {actionLoading === 'all' ? 'Logging out...' : 'Logout All Others'}
                            </button>
                        )}
                    </div>

                    <div className="divide-y divide-slate-100">
                        {loading ? (
                            <div className="p-8 text-center text-slate-500 flex flex-col items-center">
                                <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin mb-3"></div>
                                Loading sessions...
                            </div>
                        ) : devices.length === 0 ? (
                            <div className="p-8 text-center text-slate-500">
                                No active sessions found
                            </div>
                        ) : (
                            devices.map((device) => (
                                <div
                                    key={device.id}
                                    className={`p-6 transition-colors ${device.isCurrent ? 'bg-slate-50/50' : 'hover:bg-slate-50'}`}
                                >
                                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                        <div className="flex item-start gap-4">
                                            <div className={`p-3 rounded-xl ${device.isCurrent ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'}`}>
                                                {getDeviceIcon(device.os, device.deviceType)}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-semibold text-slate-900">{device.os} - {device.browser}</h3>
                                                    {device.isCurrent && (
                                                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                                                            Current Device
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500 mt-2">
                                                    <div className="flex items-center gap-1.5">
                                                        <Globe className="w-4 h-4" />
                                                        {device.ip === '::1' || device.ip === '127.0.0.1' ? 'Localhost' : device.ip}
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <Clock className="w-4 h-4" />
                                                        Last active: {formatDate(device.lastActive)}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {!device.isCurrent && (
                                            <button
                                                onClick={() => handleLogoutDevice(device.id)}
                                                disabled={actionLoading === device.id}
                                                className="self-start md:self-center p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Logout this device"
                                            >
                                                {actionLoading === device.id ? (
                                                    <div className="w-5 h-5 border-2 border-red-200 border-t-red-600 rounded-full animate-spin"></div>
                                                ) : (
                                                    <Trash2 className="w-5 h-5" />
                                                )}
                                            </button>
                                        )}
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
