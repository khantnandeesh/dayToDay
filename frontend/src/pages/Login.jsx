
import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, CheckCircle, AlertCircle, ShieldCheck, Smartphone, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../config/api';

const Login = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();
    const [showPassword, setShowPassword] = useState(false);

    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const successMessage = location.state?.message;

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!formData.email || !formData.password) {
            setError('Please fill in all fields');
            return;
        }

        setLoading(true);

        try {
            const response = await api.post('/auth/login', formData);

            if (response.data.success) {
                if (response.data.requires2FA) {
                    navigate('/verify-2fa', {
                        state: { userId: response.data.userId, email: formData.email },
                    });
                } else {
                    login(response.data.token, response.data.user);
                    navigate('/dashboard');
                }
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-white rounded-2xl shadow-xl p-8">

                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-12 h-12 bg-slate-900 rounded-xl mb-4">
                            <span className="text-white text-xl font-bold">L</span>
                        </div>

                        <h1 className="text-2xl font-bold text-slate-900 mb-2">
                            Welcome Back
                        </h1>

                        <p className="text-slate-600 text-sm">
                            Sign in to access your secure account
                        </p>
                    </div>

                    {/* Success Message */}
                    {successMessage && (
                        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-start">
                                <CheckCircle className="w-5 h-5 text-green-600 mr-3 mt-0.5" />
                                <p className="text-green-800 text-sm font-medium">{successMessage}</p>
                            </div>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                            <div className="flex items-start">
                                <AlertCircle className="w-5 h-5 text-red-600 mr-3 mt-0.5" />
                                <p className="text-red-800 text-sm font-medium">{error}</p>
                            </div>
                        </div>
                    )}

                    {/* FORM */}
                    <div className="space-y-6">

                        {/* Email */}
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                                Email Address
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    id="email"
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="w-full pl-11 pr-4 py-3 border border-slate-300 rounded-lg 
                                        focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all"
                                    placeholder="you@example.com"
                                    disabled={loading}
                                    autoComplete="email"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="w-full pl-11 pr-11 py-3 border border-slate-300 rounded-lg 
                                        focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all"
                                    placeholder="••••••••"
                                    disabled={loading}
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {/* Submit */}
                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="w-full bg-slate-900 text-white py-3 rounded-lg font-medium 
                                hover:bg-slate-800 active:scale-[0.98] transition-all 
                                disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Signing In...' : 'Sign In'}
                        </button>

                        {/* Divider */}
                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-slate-200"></span>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-4 bg-white text-slate-500">Security</span>
                            </div>
                        </div>

                        {/* Security Icons (cleaner + consistent with your style) */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="flex flex-col items-center p-3 border border-slate-200 
                                rounded-lg hover:bg-slate-50 transition">
                                <div className="mb-2 p-2 bg-slate-50 rounded-full">
                                    <ShieldCheck className="w-6 h-6 text-slate-600" />
                                </div>
                                <p className="text-xs text-slate-600 font-medium">2FA</p>
                            </div>
                            <div className="flex flex-col items-center p-3 border border-slate-200 
                                rounded-lg hover:bg-slate-50 transition">
                                <div className="mb-2 p-2 bg-slate-50 rounded-full">
                                    <Smartphone className="w-6 h-6 text-slate-600" />
                                </div>
                                <p className="text-xs text-slate-600 font-medium">Devices</p>
                            </div>
                            <div className="flex flex-col items-center p-3 border border-slate-200 
                                rounded-lg hover:bg-slate-50 transition">
                                <div className="mb-2 p-2 bg-slate-50 rounded-full">
                                    <Zap className="w-6 h-6 text-slate-600" />
                                </div>
                                <p className="text-xs text-slate-600 font-medium">Fast</p>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-6 text-center">
                        <p className="text-sm text-slate-600">
                            Don’t have an account?{' '}
                            <Link to="/register" className="text-slate-900 font-medium hover:underline">
                                Create one
                            </Link>
                        </p>
                    </div>
                </div>

                {/* Legal */}
                <p className="mt-6 text-center text-xs text-slate-500">
                    Protected by two-factor authentication
                </p>
            </div>
        </div>
    );
};

export default Login;
