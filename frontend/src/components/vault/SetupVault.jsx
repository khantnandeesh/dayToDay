import { useState } from 'react';
import { Shield, Lock, CheckCircle, AlertCircle } from 'lucide-react';
import { useVault } from '../../context/VaultContext';

const SetupVault = () => {
    const { initializeVault, error } = useVault();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [validationError, setValidationError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setValidationError('');

        if (password.length < 8) {
            setValidationError('Master password must be at least 8 characters long');
            return;
        }

        if (password !== confirmPassword) {
            setValidationError('Passwords do not match');
            return;
        }

        setLoading(true);
        await initializeVault(password);
        setLoading(false);
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg shadow-slate-900/20">
                        <Shield className="w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">Setup Your Vault</h1>
                    <p className="text-center text-slate-500 mt-2">
                        Create a strong Master Password. This password is the <strong>only way</strong> to unlock your data. We cannot recover it for you.
                    </p>
                </div>

                {(error || validationError) && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-600 text-sm">
                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <span>{error || validationError}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Master Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-all outline-none"
                                placeholder="At least 8 characters"
                                required
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Confirm Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-all outline-none"
                                placeholder="Repeat password"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full mt-2 py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/10 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <CheckCircle className="w-5 h-5" />
                                Create Vault
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default SetupVault;
