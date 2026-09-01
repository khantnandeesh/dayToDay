import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
    Shield, Key, Lock, CheckCircle2, Clock, Mail, 
    RefreshCw, Loader, Flame, ArrowRight, ShieldCheck, 
    CreditCard, FileText, Send, Sparkles
} from 'lucide-react';
import api from '../config/api';

const VaultAccessPage = () => {
    const { token } = useParams();
    
    // Page state
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [linkInfo, setLinkInfo] = useState(null);
    
    // Resend state
    const [resending, setResending] = useState(false);
    const [resendSuccess, setResendSuccess] = useState('');
    const [resendError, setResendError] = useState('');
    const [resendCooldown, setResendCooldown] = useState(0);

    const [timeLeft, setTimeLeft] = useState(null);

    // Fetch initial link metadata & trigger instant credentials email dispatch
    useEffect(() => {
        let isMounted = true;
        if (!token) return;

        const loadLinkAndSendCreds = async () => {
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
                const msg = err.response?.data?.message || 'This secure link is invalid, expired, or was already opened and burned.';
                setError(msg);
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        loadLinkAndSendCreds();
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

    // Handle resend email
    const handleResend = async () => {
        if (resendCooldown > 0 || resending) return;
        setResending(true);
        setResendSuccess('');
        setResendError('');
        try {
            const res = await api.post(`/vault/access-link/${token}/resend`);
            setResendSuccess(res.data.message || 'Credentials email has been resent to your registered email.');
            setResendCooldown(30); // 30s cooldown
        } catch (err) {
            console.error('Resend error:', err);
            setResendError(err.response?.data?.message || 'Failed to resend credentials email');
        } finally {
            setResending(false);
        }
    };

    const getItemIcon = (type) => {
        switch (type?.toLowerCase()) {
            case 'login':
                return <Key className="w-7 h-7 text-blue-400" />;
            case 'card':
                return <CreditCard className="w-7 h-7 text-emerald-400" />;
            case 'note':
                return <FileText className="w-7 h-7 text-amber-400" />;
            default:
                return <Lock className="w-7 h-7 text-blue-400" />;
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
                <p className="text-slate-500 text-sm mt-1">Decrypting and sending credentials to your email</p>
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
                            DayToDay secure links are single-use and time-bounded to prevent unauthorized credential snooping.
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
                <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
                    {/* Success Icon & Header */}
                    <div className="text-center mb-6">
                        <div className="w-20 h-20 bg-blue-500/10 border border-blue-500/25 rounded-3xl flex items-center justify-center mx-auto mb-4 text-blue-400 shadow-xl relative">
                            <Send className="w-9 h-9 text-blue-400 animate-pulse" />
                            <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-slate-900 text-white shadow-md">
                                <CheckCircle2 className="w-4 h-4" />
                            </div>
                        </div>
                        <h1 className="text-2xl font-bold text-white tracking-tight mb-1">
                            Credentials Sent to Your Email!
                        </h1>
                        <p className="text-sm text-slate-400">
                            The requested vault form values have been dispatched securely.
                        </p>
                    </div>

                    {/* Item Information Card */}
                    <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl mb-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3.5">
                                <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center border border-slate-800 shadow-inner">
                                    {getItemIcon(linkInfo?.itemType)}
                                </div>
                                <div>
                                    <div className="text-base font-bold text-slate-100">
                                        {linkInfo?.title || 'Secure Vault Item'}
                                    </div>
                                    <div className="text-xs text-slate-400 capitalize mt-0.5">
                                        Type: {linkInfo?.itemType || 'Login'} &bull; Form Values Dispatched
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-full text-xs font-medium shrink-0">
                                <Flame className="w-3.5 h-3.5" />
                                <span>Burned</span>
                            </div>
                        </div>
                    </div>

                    {/* Recipient Email Callout */}
                    <div className="p-4 bg-blue-950/40 border border-blue-800/40 rounded-2xl mb-6 flex items-start gap-3.5">
                        <div className="w-9 h-9 bg-blue-600/20 rounded-xl flex items-center justify-center shrink-0 text-blue-400 mt-0.5">
                            <Mail className="w-5 h-5" />
                        </div>
                        <div className="text-xs text-slate-300 leading-relaxed">
                            Full login details (Username, Password, URL, Notes) were sent to the account owner at{' '}
                            <strong className="text-blue-300 font-semibold">{linkInfo?.maskedEmail || 'your registered email'}</strong>.
                        </div>
                    </div>

                    {resendSuccess && (
                        <div className="mb-5 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-start gap-3 text-emerald-300 text-sm">
                            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                            <span>{resendSuccess}</span>
                        </div>
                    )}

                    {resendError && (
                        <div className="mb-5 p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start gap-3 text-rose-300 text-sm">
                            <Shield className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                            <span>{resendError}</span>
                        </div>
                    )}

                    {/* Resend Action */}
                    <div className="space-y-3">
                        <button
                            type="button"
                            onClick={handleResend}
                            disabled={resendCooldown > 0 || resending}
                            className="w-full py-3.5 px-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-medium rounded-2xl border border-slate-700 transition-all flex items-center justify-center gap-2 text-sm"
                        >
                            <RefreshCw className={`w-4 h-4 ${resending ? 'animate-spin' : ''}`} />
                            {resendCooldown > 0 ? `Resend email in ${resendCooldown}s` : 'Resend credentials to my email'}
                        </button>

                        <Link
                            to="/login"
                            className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-2xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 text-sm text-center"
                        >
                            Open DayToDay App <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>

                    {/* Security Footnote */}
                    <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-start gap-2.5 text-xs text-slate-500">
                        <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">
                            No login or master password input is required on this page. This single-use link has been burned and will self-destruct.
                        </span>
                    </div>
                </div>
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
