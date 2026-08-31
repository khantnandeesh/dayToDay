import { useState, useEffect } from 'react';
import {
    Shield, Key, Lock, Unlock, Clock, AlertCircle,
    CheckCircle2, Copy, Check, Sparkles, X, RefreshCw, PowerOff
} from 'lucide-react';
import { useVault } from '../../context/VaultContext';

const McpVaultAuthModal = ({ isOpen, onClose }) => {
    const {
        mcpSession,
        authorizeMcpSession,
        generateMcpOneTimeToken,
        revokeMcpSession,
        checkMcpSessionStatus
    } = useVault();

    const [tab, setTab] = useState('session'); // 'session' | 'token'
    const [password, setPassword] = useState('');
    const [durationMinutes, setDurationMinutes] = useState(15);
    const [tokenTtlMinutes, setTokenTtlMinutes] = useState(10);
    const [tokenMaxUses, setTokenMaxUses] = useState(1);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [generatedToken, setGeneratedToken] = useState(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (isOpen) {
            checkMcpSessionStatus();
            setError('');
            setSuccessMessage('');
            setGeneratedToken(null);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleAuthorizeSession = async (e) => {
        e.preventDefault();
        if (!password) {
            setError('Please enter your master password');
            return;
        }
        setLoading(true);
        setError('');
        setSuccessMessage('');

        const res = await authorizeMcpSession(password, durationMinutes);
        setLoading(false);
        if (res.success) {
            setSuccessMessage(res.message || `AI MCP Session successfully authorized for ${durationMinutes} minutes.`);
            setPassword('');
        } else {
            setError(res.message || 'Failed to authorize session');
        }
    };

    const handleGenerateToken = async (e) => {
        e.preventDefault();
        if (!password && !mcpSession?.isAuthorized) {
            setError('Please enter your master password');
            return;
        }
        setLoading(true);
        setError('');
        setSuccessMessage('');

        const res = await generateMcpOneTimeToken(password, tokenTtlMinutes, tokenMaxUses);
        setLoading(false);
        if (res.success) {
            setGeneratedToken(res.token);
            setSuccessMessage('Secure One-Time Token created!');
            setPassword('');
        } else {
            setError(res.message || 'Failed to generate token');
        }
    };

    const handleRevoke = async () => {
        setLoading(true);
        setError('');
        await revokeMcpSession();
        setLoading(false);
        setSuccessMessage('AI MCP Vault access revoked immediately.');
    };

    const handleCopyToken = () => {
        if (!generatedToken) return;
        navigator.clipboard.writeText(generatedToken);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 bg-slate-900 text-white flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                AI MCP Vault Security
                            </h2>
                            <p className="text-xs text-slate-400">
                                Authorize ChatGPT & AI agents without exposing raw passwords in chat
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Session Status Banner */}
                <div className="p-4 bg-slate-50 border-b border-slate-200">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${mcpSession?.isAuthorized ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                            <span className="text-sm font-semibold text-slate-800">
                                Status:{' '}
                                {mcpSession?.isAuthorized ? (
                                    <span className="text-emerald-700">Active AI Session ({mcpSession.remainingMinutes}m left)</span>
                                ) : (
                                    <span className="text-slate-500">Locked / No active session</span>
                                )}
                            </span>
                        </div>

                        {mcpSession?.isAuthorized && (
                            <button
                                onClick={handleRevoke}
                                disabled={loading}
                                className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
                            >
                                <PowerOff className="w-3.5 h-3.5" />
                                Revoke Now
                            </button>
                        )}
                    </div>
                </div>

                {/* Tab Switcher */}
                <div className="px-6 pt-4 flex gap-2 border-b border-slate-100">
                    <button
                        type="button"
                        onClick={() => { setTab('session'); setError(''); setSuccessMessage(''); }}
                        className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${tab === 'session'
                            ? 'border-slate-900 text-slate-900'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <Shield className="w-4 h-4" />
                        Session Authorization
                    </button>
                    <button
                        type="button"
                        onClick={() => { setTab('token'); setError(''); setSuccessMessage(''); }}
                        className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${tab === 'token'
                            ? 'border-slate-900 text-slate-900'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <Key className="w-4 h-4" />
                        One-Time Token
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-6 overflow-y-auto space-y-4">
                    {/* Alerts */}
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2.5 text-red-600 text-xs">
                            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}
                    {successMessage && (
                        <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-2.5 text-emerald-700 text-xs font-medium">
                            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-600" />
                            <span>{successMessage}</span>
                        </div>
                    )}

                    {tab === 'session' ? (
                        <form onSubmit={handleAuthorizeSession} className="space-y-4">
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 leading-relaxed">
                                <p className="font-semibold text-slate-800 mb-1">How this works:</p>
                                When authorized, the AI MCP tools can securely access and decrypt your passwords for the specified duration without ever prompting for your master password in chat conversations.
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Master Password
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter Master Password"
                                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-900 outline-none"
                                        required={!mcpSession?.isAuthorized}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Authorization Duration
                                </label>
                                <div className="grid grid-cols-4 gap-2">
                                    {[5, 15, 30, 60].map((mins) => (
                                        <button
                                            key={mins}
                                            type="button"
                                            onClick={() => setDurationMinutes(mins)}
                                            className={`py-1.5 px-3 rounded-lg text-xs font-medium border transition-colors ${durationMinutes === mins
                                                ? 'bg-slate-900 text-white border-slate-900'
                                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                                }`}
                                        >
                                            {mins} mins
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-slate-900/10 flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                    <>
                                        <Unlock className="w-4 h-4" />
                                        Authorize AI Session ({durationMinutes}m)
                                    </>
                                )}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleGenerateToken} className="space-y-4">
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 leading-relaxed">
                                <p className="font-semibold text-slate-800 mb-1">One-Time Token Access:</p>
                                Generate a single-use token (`mcp_auth_...`) that you can pass as the <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-900">session_token</code> argument in any AI tool call.
                            </div>

                            {!mcpSession?.isAuthorized && (
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Master Password
                                    </label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                        <input
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="Enter Master Password"
                                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-900 outline-none"
                                            required
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Token Validity
                                    </label>
                                    <select
                                        value={tokenTtlMinutes}
                                        onChange={(e) => setTokenTtlMinutes(Number(e.target.value))}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-slate-900 outline-none"
                                    >
                                        <option value={5}>5 Minutes</option>
                                        <option value={10}>10 Minutes</option>
                                        <option value={30}>30 Minutes</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Max Allowed Uses
                                    </label>
                                    <select
                                        value={tokenMaxUses}
                                        onChange={(e) => setTokenMaxUses(Number(e.target.value))}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-slate-900 outline-none"
                                    >
                                        <option value={1}>1 Use (Single-shot)</option>
                                        <option value={3}>3 Uses</option>
                                        <option value={5}>5 Uses</option>
                                    </select>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-slate-900/10 flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                    <>
                                        <Key className="w-4 h-4" />
                                        Generate Token
                                    </>
                                )}
                            </button>

                            {generatedToken && (
                                <div className="mt-4 p-3 bg-indigo-50 border border-indigo-100 rounded-xl space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-indigo-900">Your AI Session Token:</span>
                                        <button
                                            type="button"
                                            onClick={handleCopyToken}
                                            className="flex items-center gap-1 text-xs font-semibold px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                                        >
                                            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                            {copied ? 'Copied!' : 'Copy Token'}
                                        </button>
                                    </div>
                                    <div className="p-2 bg-white rounded-lg border border-indigo-200 font-mono text-xs text-indigo-900 select-all break-all">
                                        {generatedToken}
                                    </div>
                                    <p className="text-[11px] text-indigo-700 leading-tight">
                                        Pass this token to the AI assistant in place of a password. It will automatically expire after use or timeout.
                                    </p>
                                </div>
                            )}
                        </form>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-xl transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default McpVaultAuthModal;
