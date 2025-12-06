import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { Shield, HardDrive } from 'lucide-react';

const Dashboard = () => {
    const { user } = useAuth();

    return (
        <div className="min-h-screen bg-slate-50">
            <Navbar />

            <div className="max-w-6xl mx-auto p-4 md:p-8 animate-fade-in">
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
                    <div className="w-24 h-24 bg-slate-900 rounded-3xl flex items-center justify-center text-white text-4xl font-bold shadow-xl shadow-slate-900/20 mb-4">
                        {user?.name?.charAt(0).toUpperCase()}
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight">
                            Hello, {user?.name}!
                        </h1>
                        <p className="text-xl text-slate-500 max-w-lg mx-auto leading-relaxed">
                            Welcome back to your dashboard. Everything is ready for you.
                        </p>
                    </div>

                    <div className="pt-8 flex flex-col md:flex-row gap-4">
                        <Link
                            to="/passwords"
                            className="btn btn-primary px-8 py-3 text-lg shadow-lg shadow-slate-900/10 flex items-center gap-3"
                        >
                            <Shield className="w-5 h-5" />
                            Open Password Manager
                        </Link>

                        <Link
                            to="/drive"
                            className="bg-white text-slate-700 border border-slate-200 px-8 py-3 rounded-lg text-lg font-medium shadow-sm hover:bg-slate-50 hover:text-slate-900 transition-all flex items-center gap-3"
                        >
                            <HardDrive className="w-5 h-5" />
                            Access Secure Drive
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
