import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import StickyNotes from '../components/StickyNotes';
import WorldTimeExplorer from '../components/WorldTimeExplorer';
import { useAuth } from '../context/AuthContext';
import { Shield, HardDrive, Sparkles } from 'lucide-react';

const Dashboard = () => {
    const { user } = useAuth();

    return (
        <div className="min-h-screen bg-slate-50">
            <Navbar />

            <div className="max-w-7xl mx-auto p-4 md:p-8 animate-fade-in space-y-8">
                {/* Top Welcome Banner & Quick Actions */}
                <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-md shadow-slate-900/10 shrink-0">
                            {user?.name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div>
                            <div className="flex items-center gap-2 text-indigo-600 font-semibold text-xs tracking-wider uppercase mb-1">
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Personal Command Center</span>
                            </div>
                            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
                                Hello, {user?.name}!
                            </h1>
                            <p className="text-slate-500 text-sm mt-0.5">
                                Welcome back. Everything is synchronized and ready for you.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        <Link
                            to="/passwords"
                            className="btn btn-primary px-5 py-2.5 text-sm shadow-sm shadow-slate-900/10 flex items-center gap-2"
                        >
                            <Shield className="w-4 h-4" />
                            <span>Password Manager</span>
                        </Link>

                        <Link
                            to="/drive"
                            className="bg-white text-slate-700 border border-slate-200 px-5 py-2.5 rounded-lg text-sm font-medium shadow-xs hover:bg-slate-50 hover:text-slate-900 transition-all flex items-center gap-2"
                        >
                            <HardDrive className="w-4 h-4" />
                            <span>Secure Drive</span>
                        </Link>
                    </div>
                </div>

                {/* World Time Zone Map & 3D Interactive Rotating Globe */}
                <WorldTimeExplorer />
            </div>

            <StickyNotes />
        </div>
    );
};

export default Dashboard;

