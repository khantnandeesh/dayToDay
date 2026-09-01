import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
    Shield, Key, Lock, Unlock, Eye, EyeOff, Copy, Check, 
    AlertCircle, CheckCircle2, Clock, Mail, ExternalLink, 
    RefreshCw, Loader, Flame, ArrowRight, ShieldCheck, Globe, User, FileText, CreditCard
} from 'lucide-react';
import api from '../config/api';

const VaultAccessPage = () => {
    const { token } = useParams();
    
    // Page state
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [linkInfo, setLinkInfo] = useState(null);
    
    // Verification state
    const [code, setCode] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [verifyError, setVerifyError] = useState('');
    
    // Resend state
    const [resending, setResending] = useState(false);
    const [resendSuccess, setResendSuccess] = useState('');
    const [resendCooldown, setResendCooldown] = useState(0);

    // Decrypted credential state
    const [decryptedItem, setDecryptedItem] = useState(null);
    const [showPassword, setShowPassword] = useState(false);
    const [copiedField, setCopiedField] = useState(null);
    const [timeLeft, setTimeLeft] = useState(null);

    // Fetch initial link metadata & trigger email code
    useEffect(() => {
        let isMounted = true;
        if (!token) return;

        const loadLink = async () => {
            try {
                const res = await api.get(`/vault/access-link/${token}`);
                if (!isMounted) return;
                setLinkInfo(res.data);
                if (res.data.expiresAt) {
                    const diff = Math.max(0, Math.floor((new Date(res.data.expiresAt).getTime() - Date.now()) / 1000));
                    setTimeLeft(diff);
                }
            } catch (err) {
                if (!isMounted) return;
                console.error('Fetch access link error:', err);
                const msg = err.response?.data?.message || 'This secure link is invalid, expired, or was already burned.';
                setError(msg);
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        loadLink();
        return () => {
            isMounted = false;
        };
    }, [token]);

    // Live countdown timer for expiration
    useEffect(() => {
        if (timeLeft === null || timeLeft <= 0) return;
        const interval = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [timeLeft]);

    // Resend cooldown timer
    useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = setInterval(() => {
            setResendCooldown(prev => prev - 1);
        }, 1000);
        return () => clearInterval(timer);
    }, [resendCooldown]);

    const formatTime = (seconds) => {
        if (seconds === null || seconds === undefined) return '--:--';
        if (seconds <= 0) return 'Expired';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Handle code verification
    const handleVerify = async (e) => {
        if (e) e.preventDefault();
        setVerifyError('');
        if (!code || code.trim().length < 6) {
            setVerifyError('Please enter the complete 6-digit verification code');
            return;
        }

        setVerifying(true);
        try {
            const res = await api.post(`/vault/access-link/${token}/verify`, { code: code.trim() });
            if (res.data.success && res.data.item) {
                setDecryptedItem(res.data.item);
            } else {
                setVerifyError(res.data.message || 'Verification failed');
            }
        } catch (err) {
            console.error('Verify error:', err);
            setVerifyError(err.response?.data?.message || 'Invalid or expired verification code');
        } finally {
            setVerifying(false);
        }
    };

    // Handle resend code
    const handleResendCode = async () => {
        if (resendCooldown > 0 || resending) return;
        setResending(true);
        setResendSuccess('');
        setVerifyError('');
        try {
            const res = await api.post(`/vault/access-link/${token}/resend`);
            setResendSuccess(res.data.message || 'New verification code sent to your email.');
            setResendCooldown(30); // 30s cooldown
        } catch (err) {
            console.error('Resend error:', err);
            setVerifyError(err.response?.data?.message || 'Failed to resend code');
        } finally {
            setResending(false);
        }
    };

    // Copy to clipboard helper
    const handleCopy = (text, fieldName) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedField(fieldName);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const getItemIcon = (type) => {
        switch (type?.toLowerCase()) {
            case 'login':
                return <Key className="w-6 h-6 text-blue-500" />;
            case 'card':
                return <CreditCard className="w-6 h-6 text-emerald-500" />;
            case 'note':
                return <FileText className="w-6 h-6 text-amber-500" />;
            default:
                return <Lock className="w-6 h-6 text-slate-500" />;
        }
    };

    // Loading screen
    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
                <div className="w-16 h-16 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center mb-4 shadow-xl">
                    <Loader className="w-8 h-8 text-blue-400 animate-spin" />
                </div>
                <h2 className="text-lg font-semibold text-slate-200">Verifying Secure Vault Link...</h2>
                <p className="text-slate-500 text-sm mt-1">Connecting to DayToDay Zero-Knowledge Vault</p>
            </div>
        );
    }

    // Expired or Invalid Link Error Screen
    if (error) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center">
                    <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-rose-400">
                        <Flame className="w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-100 mb-2">Link Expired or Burned</h1>
                    <p className="text-slate-400 text-sm leading-relaxed mb-6">
                        {error}
                    </p>
                    <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-2xl mb-6 text-left flex items-start gap-3">
                        <Shield className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                        <div className="text-xs text-slate-400 leading-normal">
                            DayToDay secure links are single-use and time-bounded to prevent unauthorized snooping or credential leakage.
                        </div>
                    </div>
                    <Link
                        to="/login"
                        className="w-full py-3.5 px-6 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                        Go to DayToDay Dashboard <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 selection:bg-blue-500 selection:text-white">
            {/* Header Brand */}
            <div className="w-full max-w-lg mx-auto flex items-center justify-between py-4">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/30">
                        <ShieldCheck className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <span className="font-bold text-base tracking-tight text-white">DayToDay</span>
                        <span className="text-xs text-blue-400 font-medium ml-1.5 px-2 py-0.5 bg-blue-500/10 rounded-full border border-blue-500/20">Secure Link</span>
                    </div>
                </div>
                {timeLeft !== null && (
                    <div className={`flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-full border ${timeLeft < 60 ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 animate-pulse' : 'bg-slate-900 text-slate-400 border-slate-800'}`}>
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatTime(timeLeft)}</span>
                    </div>
                )}
            </div>

            {/* Main Content Area */}
            <div className="w-full max-w-lg mx-auto my-auto py-6">
                {!decryptedItem ? (
                    /* STEP 1: VERIFY CODE */
                    <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-blue-400 shadow-inner">
                                <Lock className="w-8 h-8" />
                            </div>
                            <h1 className="text-2xl font-bold text-white tracking-tight mb-1">
                                {linkInfo?.title || 'Secure Vault Access'}
                            </h1>
                            <p className="text-sm text-slate-400">
                                This credential is protected with one-time 2FA authorization.
                            </p>
                        </div>

                        {/* Email Dispatch Notice */}
                        <div className="p-4 bg-blue-950/40 border border-blue-800/40 rounded-2xl mb-6 flex items-start gap-3.5">
                            <div className="w-9 h-9 bg-blue-600/20 rounded-xl flex items-center justify-center shrink-0 text-blue-400 mt-0.5">
                                <Mail className="w-5 h-5" />
                            </div>
                            <div className="text-xs text-slate-300 leading-relaxed">
                                A 6-digit access code was automatically sent to the account owner at{' '}
                                <strong className="text-blue-300 font-semibold">{linkInfo?.maskedEmail || 'your registered email'}</strong>.
                            </div>
                        </div>

                        {verifyError && (
                            <div className="mb-5 p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start gap-3 text-rose-300 text-sm">
                                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                                <span>{verifyError}</span>
                            </div>
                        )}

                        {resendSuccess && (
                            <div className="mb-5 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-start gap-3 text-emerald-300 text-sm">
                                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                                <span>{resendSuccess}</span>
                            </div>
                        )}

                        <form onSubmit={handleVerify} className="space-y-5">
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                                    Enter 6-Digit Email Code
                                </label>
                                <input
                                    type="text"
                                    maxLength={6}
                                    value={code}
                                    onChange={(e) => {
                                        setCode(e.target.value.replace(/\D/g, ''));
                                        setVerifyError('');
                                    }}
                                    placeholder="••••••"
                                    autoFocus
                                    className="w-full text-center tracking-[0.6em] font-mono text-2xl py-3.5 px-4 bg-slate-950 border border-slate-700/80 rounded-2xl text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={verifying || code.length < 6 || (timeLeft !== null && timeLeft <= 0)}
                                className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-2xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
                            >
                                {verifying ? (
                                    <>
                                        <Loader className="w-5 h-5 animate-spin" />
                                        Verifying Code...
                                    </>
                                ) : (
                                    <>
                                        <Unlock className="w-5 h-5" />
                                        Decrypt & Reveal Credential
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="mt-6 pt-6 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                            <span>Didn't receive the email?</span>
                            <button
                                type="button"
                                onClick={handleResendCode}
                                disabled={resendCooldown > 0 || resending}
                                className="text-blue-400 hover:text-blue-300 font-medium disabled:text-slate-600 transition-colors flex items-center gap-1.5"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
                                {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : 'Resend code'}
                            </button>
                        </div>
                    </div>
                ) : (
                    /* STEP 2: REVEALED DECRYPTED CREDENTIALS */
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-300">
                        {/* Header & Burn notification */}
                        <div className="flex items-center justify-between mb-6 pb-6 border-b border-slate-800">
                            <div className="flex items-center gap-3.5">
                                <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center border border-slate-700">
                                    {getItemIcon(decryptedItem.type)}
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold text-white leading-tight">
                                        {decryptedItem.title || 'Decrypted Item'}
                                    </h1>
                                    <span className="text-xs text-emerald-400 font-medium flex items-center gap-1 mt-0.5">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Decrypted & Verified
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-full text-xs font-medium">
                                <Flame className="w-3.5 h-3.5" />
                                <span>Link Burned</span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {/* Username / Login Field */}
                            {decryptedItem.username && (
                                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl">
                                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                                        <span className="flex items-center gap-1.5 font-medium uppercase tracking-wider">
                                            <User className="w-3.5 h-3.5 text-slate-500" /> Username / Email
                                        </span>
                                        <button
                                            onClick={() => handleCopy(decryptedItem.username, 'username')}
                                            className="text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold text-xs transition-colors"
                                        >
                                            {copiedField === 'username' ? (
                                                <>
                                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                                    <span className="text-emerald-400">Copied</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className="w-3.5 h-3.5" />
                                                    Copy
                                                </>
                                            )}
                                        </button>
                                    </div>
                                    <div className="text-base font-mono text-slate-100 select-all break-all">
                                        {decryptedItem.username}
                                    </div>
                                </div>
                            )}

                            {/* Password Field */}
                            {decryptedItem.password && (
                                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl">
                                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                                        <span className="flex items-center gap-1.5 font-medium uppercase tracking-wider">
                                            <Key className="w-3.5 h-3.5 text-slate-500" /> Password
                                        </span>
                                        <div className="flex items-center gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="text-slate-400 hover:text-slate-300 flex items-center gap-1 text-xs transition-colors"
                                            >
                                                {showPassword ? (
                                                    <>
                                                        <EyeOff className="w-3.5 h-3.5" />
                                                        Hide
                                                    </>
                                                ) : (
                                                    <>
                                                        <Eye className="w-3.5 h-3.5" />
                                                        Show
                                                    </>
                                                )}
                                            </button>
                                            <button
                                                onClick={() => handleCopy(decryptedItem.password, 'password')}
                                                className="text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold text-xs transition-colors"
                                            >
                                                {copiedField === 'password' ? (
                                                    <>
                                                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                                                        <span className="text-emerald-400">Copied</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Copy className="w-3.5 h-3.5" />
                                                        Copy
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="text-lg font-mono text-slate-100 select-all break-all tracking-wide">
                                        {showPassword ? decryptedItem.password : '••••••••••••••••'}
                                    </div>
                                </div>
                            )}

                            {/* Website / URL */}
                            {decryptedItem.url && (
                                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl flex items-center justify-between">
                                    <div className="flex items-center gap-2 overflow-hidden mr-3">
                                        <Globe className="w-4 h-4 text-slate-500 shrink-0" />
                                        <span className="text-sm font-mono text-slate-300 truncate">
                                            {decryptedItem.url}
                                        </span>
                                    </div>
                                    <a
                                        href={decryptedItem.url.startsWith('http') ? decryptedItem.url : `https://${decryptedItem.url}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors shrink-0"
                                        title="Open Website"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                    </a>
                                </div>
                            )}

                            {/* Card Specific Fields */}
                            {decryptedItem.cardNumber && (
                                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl">
                                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                                        <span>CARD NUMBER</span>
                                        <button
                                            onClick={() => handleCopy(decryptedItem.cardNumber, 'card')}
                                            className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1"
                                        >
                                            <Copy className="w-3 h-3" /> Copy
                                        </button>
                                    </div>
                                    <div className="font-mono text-base text-slate-100">
                                        {decryptedItem.cardNumber}
                                    </div>
                                    {(decryptedItem.expiryDate || decryptedItem.cvv) && (
                                        <div className="flex gap-4 mt-3 pt-3 border-t border-slate-900 text-xs text-slate-400">
                                            {decryptedItem.expiryDate && <div>EXP: <span className="text-slate-200 font-mono">{decryptedItem.expiryDate}</span></div>}
                                            {decryptedItem.cvv && <div>CVV: <span className="text-slate-200 font-mono">{decryptedItem.cvv}</span></div>}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Notes Field */}
                            {decryptedItem.notes && (
                                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl">
                                    <div className="text-xs text-slate-400 uppercase tracking-wider mb-2 font-medium">
                                        Secure Notes
                                    </div>
                                    <div className="text-sm text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
                                        {decryptedItem.notes}
                                    </div>
                                </div>
                            )}

                            {/* Custom Fields */}
                            {Array.isArray(decryptedItem.fields) && decryptedItem.fields.length > 0 && (
                                <div className="space-y-2 pt-2">
                                    {decryptedItem.fields.map((f, idx) => (
                                        <div key={idx} className="p-3 bg-slate-950/60 border border-slate-850 rounded-xl flex items-center justify-between">
                                            <span className="text-xs text-slate-400">{f.label || `Field ${idx + 1}`}</span>
                                            <span className="text-sm font-mono text-slate-200">{f.value}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Safety notice */}
                        <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-300/90 leading-relaxed flex items-start gap-2.5">
                            <Shield className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            <span>
                                <strong>Zero-Knowledge Protected:</strong> This single-use link has expired and is now burned. Ensure you have copied your credentials before closing this tab.
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="w-full max-w-lg mx-auto text-center py-4 text-xs text-slate-500">
                <span>Protected by DayToDay Zero-Knowledge Architecture &bull; </span>
                <Link to="/login" className="hover:text-slate-300 transition-colors">Sign In</Link>
            </div>
        </div>
    );
};

export default VaultAccessPage;
