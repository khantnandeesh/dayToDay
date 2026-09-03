import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import StickyNotes from '../components/StickyNotes';
import WorldTimeExplorer from '../components/WorldTimeExplorer';
import { useAuth } from '../context/AuthContext';
import { Shield, HardDrive, Terminal, Circle } from 'lucide-react';

const Dashboard = () => {
    const { user } = useAuth();

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            <Navbar />

            <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
                {/* Minimalist Executive Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2 border-b border-slate-800/80">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400 shrink-0">
                            <Terminal className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-lg md:text-xl font-bold text-white tracking-tight">
                                    {user?.name ? `${user.name}'s Console` : 'System Console'}
                                </h1>
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
                                    <Circle className="w-1.5 h-1.5 fill-current animate-pulse" />
                                    ONLINE
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 font-mono">
                                Precision telemetry & encrypted workspace
                            </p>
                        </div>
                    </div>

                    {/* Quick Access Tools */}
                    <div className="flex items-center gap-2.5">
                        <Link
                            to="/passwords"
                            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-200 transition-all shadow-xs"
                        >
                            <Shield className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Password Vault</span>
                        </Link>

                        <Link
                            to="/drive"
                            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-200 transition-all shadow-xs"
                        >
                            <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
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
