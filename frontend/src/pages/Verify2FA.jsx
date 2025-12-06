import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mail, AlertCircle, Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../config/api';

const Verify2FA = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();
    const [code, setCode] = useState('');
    const [sessionDuration, setSessionDuration] = useState(24);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);

    const userId = location.state?.userId;
    const email = location.state?.email;

    useEffect(() => {
        if (!userId || !email) {
            navigate('/login');
        }
    }, [userId, email, navigate]);

    const handleVerify = async (e) => {
        e.preventDefault();
        setError('');

        if (!code || code.length !== 6) {
            setError('Please enter a valid 6-digit code');
            return;
        }

        setLoading(true);

        try {
            const response = await api.post('/auth/verify-2fa', {
                userId,
                code,
                sessionDuration,
            });

            if (response.data.success) {
                login(response.data.token, response.data.user);
                navigate('/dashboard');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Verification failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        setResending(true);
        setError('');

        try {
            const response = await api.post('/auth/resend-2fa', { userId });
            if (response.data.success) {
                setError('');
                alert('New verification code sent to your email!');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to resend code');
        } finally {
            setResending(false);
        }
    };

    const handleCodeChange = (e) => {
        const value = e.target.value.replace(/\D/g, '').slice(0, 6);
        setCode(value);
        setError('');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-white rounded-2xl shadow-xl p-8">

                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl mb-4">
                            <Mail className="w-6 h-6 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 mb-2">
                            Verify Your Email
                        </h1>
                        <p className="text-slate-600 text-sm">
                            We've sent a 6-digit code to
                        </p>
                        <p className="text-indigo-600 font-medium mt-1 text-sm">{email}</p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                            <div className="flex items-start">
                                <AlertCircle className="w-5 h-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
                                <p className="text-red-800 text-sm font-medium">{error}</p>
                            </div>
                        </div>
                    )}

                    {/* Form */}
                    <div className="space-y-6">

                        {/* Code Input */}
                        <div>
                            <label
                                htmlFor="code"
                                className="block text-sm font-medium text-slate-700 mb-2 text-center"
                            >
                                Enter Verification Code
                            </label>
                            <input
                                type="text"
                                id="code"
                                value={code}
                                onChange={handleCodeChange}
                                className="w-full px-4 py-3 border border-slate-300 rounded-lg text-center text-2xl tracking-widest font-mono focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all"
                                placeholder="000000"
                                maxLength={6}
                                disabled={loading}
                                autoFocus
                            />
                            <p className="text-slate-500 text-xs text-center mt-2">Code expires in 10 minutes</p>
                        </div>

                        {/* Session Duration */}
                        <div>
                            <label
                                htmlFor="duration"
                                className="block text-sm font-medium text-slate-700 mb-2"
                            >
                                Session Duration
                            </label>
                            <select
                                id="duration"
                                value={sessionDuration}
                                onChange={(e) => setSessionDuration(Number(e.target.value))}
                                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all"
                                disabled={loading}
                            >
                                <option value={1}>1 hour</option>
                                <option value={6}>6 hours</option>
                                <option value={12}>12 hours</option>
                                <option value={24}>24 hours (Recommended)</option>
                                <option value={72}>3 days</option>
                                <option value={168}>1 week</option>
                                <option value={720}>30 days</option>
                            </select>
                            <p className="text-slate-500 text-xs mt-2">
                                Choose how long you want to stay logged in on this device
                            </p>
                        </div>

                        {/* Verify Button */}
                        <button
                            onClick={handleVerify}
                            disabled={loading || code.length !== 6}
                            className="w-full bg-slate-900 text-white py-3 rounded-lg font-medium hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Verifying...' : 'Verify & Continue'}
                        </button>

                        {/* Resend Code */}
                        <div className="text-center">
                            <button
                                type="button"
                                onClick={handleResend}
                                disabled={resending}
                                className="text-slate-900 hover:text-slate-700 text-sm font-medium transition-colors disabled:opacity-50"
                            >
                                {resending ? 'Sending...' : "Didn't receive the code? Resend"}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Info Box */}
                <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start">
                        <Info className="w-5 h-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-blue-900 text-sm font-medium mb-1">Security Tip</p>
                            <p className="text-blue-700 text-xs">
                                For shared or public devices, choose a shorter session duration to keep your account secure.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Verify2FA;
